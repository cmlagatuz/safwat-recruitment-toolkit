const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {PDFDocument,PDFName,PDFDict,degrees}=require('pdf-lib');
const JSZip=require('jszip');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({acceptDownloads:true});
    await page.route('**/*',route=>route.abort());
    const source=fs.readFileSync('public/index.html','utf8');
    const markup=source.replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<link\b[^>]*>/gi,'');
    await page.setContent(markup);
    await page.addStyleTag({path:'public/css/legacy/001-root.css'});
    await page.addStyleTag({path:'public/css/offer-signing.css'});
    const navigation=fs.readFileSync('public/js/legacy/004-navigation.js','utf8');
    await page.addScriptTag({content:navigation.slice(navigation.indexOf('/* ---------- navigation'),navigation.indexOf('/* ---------- FSA support'))});
    await page.addScriptTag({path:require.resolve('pdf-lib/dist/pdf-lib.min.js')});
    await page.addScriptTag({path:require.resolve('jszip/dist/jszip.min.js')});
    await page.addScriptTag({path:'public/js/offer-signing-core.js'});
    await page.addScriptTag({path:'public/js/offer-signing.js'});
    await page.evaluate(()=>{document.body.classList.add('ent-authenticated');document.getElementById('entAuthGate').classList.remove('open');});
    await page.locator('[data-tab="offer-signing"]').click();
    assert.ok(await page.locator('#panel-offer-signing').isVisible());
    const expected={signature:{x:38,y:68,w:21,h:8},stamp:{x:40,y:74,w:28,h:4.6}};
    const checkDefaults=async()=>{
      for(const [kind,coords] of Object.entries(expected))for(const [axis,value] of Object.entries(coords)){
        const id='#os-'+kind+'-'+axis;
        assert.equal(await page.locator(id).inputValue(),String(value));
        assert.equal(await page.locator(id+'-default').innerText(),'(default)');
        assert.ok(await page.locator(id+'-default').isVisible());
      }
    };
    await checkDefaults();
    await page.locator('#os-signature-x').fill('39');
    assert.ok(!(await page.locator('#os-signature-x-default').isVisible()));
    assert.ok(await page.locator('#os-signature-y-default').isVisible());
    await page.locator('#os-signature-x').fill('');
    assert.ok(!(await page.locator('#os-signature-x-default').isVisible()));
    await page.locator('#os-signature-x').fill('38.0');
    assert.ok(await page.locator('#os-signature-x-default').isVisible());
    await page.locator('#os-stamp-h').fill('5');
    assert.ok(!(await page.locator('#os-stamp-h-default').isVisible()));
    await page.locator('#osPreset').click();
    await checkDefaults();
    await page.locator('#os-signature-w').fill('22');
    await page.locator('#osReset').click();
    await checkDefaults();
    const pdf=await PDFDocument.create();pdf.addPage([595,842]);pdf.addPage([595,842]);const original=Buffer.from(await pdf.save());
    const rotated=await PDFDocument.create();rotated.addPage([595,842]).setRotation(degrees(90));const bad=Buffer.from(await rotated.save());
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkcAAAAASUVORK5CYII=','base64');
    await page.locator('#osPdfs').setInputFiles([{name:'Offer A.pdf',mimeType:'application/pdf',buffer:original},{name:'Offer B.pdf',mimeType:'application/pdf',buffer:original},{name:'Rotated.pdf',mimeType:'application/pdf',buffer:bad}]);
    assert.equal(await page.locator('#osCount').innerText(),'3 PDFs attached');
    assert.match(await page.locator('#osFileList').innerText(),/Offer B\.pdf/);
    await page.locator('#osSignature').setInputFiles({name:'synthetic-signature.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.getElementById('osSignatureName').textContent==='synthetic-signature.png');
    await page.locator('#osStamp').setInputFiles({name:'synthetic-stamp.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.getElementById('osStampName').textContent==='synthetic-stamp.png');
    assert.ok(await page.locator('#osExport').isDisabled());
    await page.locator('#osConfirm').check();
    await page.locator('#osPreview').click();
    await page.waitForSelector('#osPreviewLink:not([hidden])');
    assert.match(await page.locator('#osPreviewLink').getAttribute('href'),/^blob:/);
    const downloading=page.waitForEvent('download');
    await page.locator('#osExport').click();
    const downloaded=await downloading;
    assert.equal(downloaded.suggestedFilename(),'Signed_Offers.zip');
    const zip=await JSZip.loadAsync(fs.readFileSync(await downloaded.path()));
    assert.deepEqual(Object.keys(zip.files).sort(),['Offer A_signed.pdf','Offer B_signed.pdf']);
    for(const entry of Object.values(zip.files)){
      const doc=await PDFDocument.load(await entry.async('uint8array'));
      assert.equal(doc.getPageCount(),2);
      const resources=doc.getPage(0).node.Resources();
      const xobjects=resources.lookup(PDFName.of('XObject'),PDFDict);
      assert.equal(xobjects.keys().length,2);
    }
    assert.match(await page.locator('#osResults').innerText(),/Rotated\.pdf — Skipped/);
    await page.locator('#osPdfs').setInputFiles([{name:'Single.pdf',mimeType:'application/pdf',buffer:original}]);
    await page.locator('#osConfirm').check();
    const one=page.waitForEvent('download');await page.locator('#osExport').click();assert.equal((await one).suggestedFilename(),'Single_signed.pdf');
    await page.evaluate(()=>document.body.classList.remove('ent-authenticated'));
    await page.waitForFunction(()=>document.getElementById('osCount').textContent==='0 PDFs attached');
    assert.ok(await page.locator('#osExport').isDisabled());
    console.log('Offer Signing Chromium PASS: navigation, files, authorization, preview, actual PDF image embedding, ZIP names, skipped rotated file, direct export and sign-out cleanup.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
