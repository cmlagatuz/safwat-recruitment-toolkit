/* F-10 Offer Signing: transient files, local processing and authorized visual marks only. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=$('panel-offer-signing');
  if(!panel) return;
  const core=window.OfferSigningCore;
  const maxFiles=100,maxTotal=200*1024*1024,maxImage=10*1024*1024;
  let files=[],assets={},busy=false,generation=0,previewUrl=null,owner=null;
  const identity=()=>window.firebase?.auth?.()?.currentUser?.uid||null;
  const signedIn=()=>document.body.classList.contains('ent-authenticated');
  const allowed=()=>signedIn() && (owner===null||owner===identity());
  const status=(msg)=>{$('osStatus').textContent=msg;};
  const inputs=['osPdfs','osSignature','osStamp','osPage','osConfirm','osSelect',
    ...['signature','stamp'].flatMap(k=>['x','y','w','h'].map(p=>'os-'+k+'-'+p))];
  function clearPreview(){
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl=null;
    $('osPreviewLink').hidden=true;
    $('osPreviewLink').removeAttribute('href');
  }
  function setBusy(value){busy=value;render();}
  function clear(){
    generation++; files=[];assets={};busy=false;owner=null;
    clearPreview();
    for(const id of ['osPdfs','osSignature','osStamp']) $(id).value='';
    $('osConfirm').checked=false;
    $('osPage').value='1';
    for(const k of ['signature','stamp']) for(const p of ['x','y','w','h']) $('os-'+k+'-'+p).value=core.defaults[k][p];
    $('osResults').replaceChildren();
    status('Attach offer PDFs and the two image files to begin.');
    render();
  }
  function boxes(){
    const result={};
    for(const k of ['signature','stamp']){
      result[k]={};
      for(const p of ['x','y','w','h']){
        const input=$('os-'+k+'-'+p);
        result[k][p]=input.value.trim()===''?NaN:Number(input.value);
      }
      core.fit(result[k],{width:100,height:100},{width:1,height:1});
    }
    return result;
  }
  function pageNo(){
    const n=Number($('osPage').value);
    if(!Number.isInteger(n)||n<1) throw Error('Page number must be a positive integer.');
    return n;
  }
  function ready(){
    if(!allowed()||busy||!files.length||!assets.signature||!assets.stamp||!$('osConfirm').checked) return false;
    try{boxes();pageNo();return true;}catch{return false;}
  }
  function render(){
    for(const k of ['signature','stamp']) for(const p of ['x','y','w','h']){
      const input=$('os-'+k+'-'+p), marker=$('os-'+k+'-'+p+'-default');
      marker.hidden=!(input.value.trim()!=='' && Number(input.value)===core.defaults[k][p]);
    }
    $('osCount').textContent=files.length+' PDF'+(files.length===1?'':'s')+' attached';
    $('osSignatureName').textContent=assets.signature?.name||'No image attached';
    $('osStampName').textContent=assets.stamp?.name||'No image attached';
    for(const id of inputs) $(id).disabled=busy;
    $('osPreview').disabled=!ready();
    $('osExport').disabled=!ready();
    $('osReset').disabled=false;
  }
  function renderFiles(){
    const list=$('osFileList'), select=$('osSelect');
    list.replaceChildren();select.replaceChildren();
    files.forEach((file,i)=>{
      const li=document.createElement('li');
      li.textContent=file.name+' ('+(file.size/1024).toFixed(1)+' KB)';
      list.append(li);
      const option=document.createElement('option');
      option.value=String(i);option.textContent=file.name;select.append(option);
    });
    if(!files.length){const li=document.createElement('li');li.textContent='No PDF files selected.';list.append(li);}
    render();
  }
  function beginInput(){
    if(!allowed()||busy) return false;
    owner=identity();generation++;clearPreview();$('osConfirm').checked=false;
    $('osResults').replaceChildren();
    return true;
  }
  $('osPdfs').addEventListener('change',()=>{
    if(!beginInput()) return;
    try{
      const next=Array.from($('osPdfs').files);
      if(next.length>maxFiles||next.reduce((n,f)=>n+f.size,0)>maxTotal) throw Error('Select up to 100 PDFs and 200 MB total per batch.');
      const names=new Set();
      for(const f of next){
        const name=core.outputName(f.name).toLowerCase();
        if(names.has(name)) throw Error('Duplicate filenames detected. Rename duplicates before attaching.');
        names.add(name);
        if(f.size===0) throw Error('Empty PDF: '+f.name);
      }
      files=next;
      status(files.length?'PDFs attached. Review placement before exporting.':'Select PDF files to begin.');
    }catch(e){files=[];$('osPdfs').value='';status(e.message);}
    renderFiles();
  });
  async function attachImage(kind,input){
    if(!beginInput()) return;
    const ticket=generation;
    delete assets[kind];
    const f=input.files[0];
    if(!f){render();return;}
    setBusy(true);
    try{
      if(f.size>maxImage||f.size===0) throw Error('Image must be between 1 byte and 10 MB.');
      const bytes=new Uint8Array(await f.arrayBuffer());
      if(ticket!==generation||!allowed()) return;
      const isPng=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
      const isJpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      if(!isPng&&!isJpg) throw Error('Use a PNG or JPEG image. Transparent PNG is recommended.');
      if(!window.PDFLib) throw Error('PDF tools are unavailable. Reload and try again.');
      const doc=await window.PDFLib.PDFDocument.create();
      const img=isPng?await doc.embedPng(bytes):await doc.embedJpg(bytes);
      if(ticket!==generation||!allowed())return;
      if(!img.width||!img.height||img.width*img.height>24000000) throw Error('Image resolution is too large.');
      assets[kind]={name:f.name,type:isPng?'png':'jpeg',bytes};
      status((kind==='signature'?'Signature':'Stamp')+' attached.');
    }catch(e){if(ticket===generation&&allowed()){input.value='';status(e.message);}}
    finally{if(ticket===generation){setBusy(false);}}
  }
  $('osSignature').addEventListener('change',()=>void attachImage('signature',$('osSignature')));
  $('osStamp').addEventListener('change',()=>void attachImage('stamp',$('osStamp')));
  for(const id of inputs.filter(id=>id.startsWith('os-')||id==='osPage')){
    $(id).addEventListener('input',()=>{clearPreview();$('osConfirm').checked=false;render();});
  }
  $('osSelect').addEventListener('change',clearPreview);
  $('osConfirm').addEventListener('change',()=>{if(!$('osConfirm').checked)clearPreview();render();});
  $('osPreset').addEventListener('click',()=>{
    if(!allowed()||busy)return;
    for(const k of ['signature','stamp'])for(const p of ['x','y','w','h'])$('os-'+k+'-'+p).value=core.defaults[k][p];
    $('osPage').value='1';$('osConfirm').checked=false;clearPreview();render();
    status('Default placement restored. Review the selected PDF before exporting.');
  });
  $('osReset').addEventListener('click',()=>{clear();renderFiles();});
  async function signed(file,settings,ticket){
    const bytes=await file.arrayBuffer();
    if(ticket!==generation||!allowed())throw Error('Session or selection changed.');
    const result=await core.apply(window.PDFLib,bytes,settings.assets,settings.page,settings.boxes);
    if(ticket!==generation||!allowed())throw Error('Session or selection changed.');
    return result;
  }
  function settings(){return {assets:{...assets},page:pageNo(),boxes:boxes()};}
  $('osPreview').addEventListener('click',async()=>{
    if(!ready())return;
    if(!window.PDFLib){status('PDF tools are unavailable. Reload and try again.');return;}
    const file=files[Number($('osSelect').value)],ticket=generation,config=settings();
    clearPreview();setBusy(true);status('Preparing local preview…');
    try{
      const bytes=await signed(file,config,ticket);
      if(ticket!==generation||!allowed())return;
      previewUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      const link=$('osPreviewLink');link.href=previewUrl;link.hidden=false;
      status('Preview ready. Open it to inspect the exact placement on the selected offer.');
    }catch(e){if(ticket===generation&&allowed())status('Preview failed: '+e.message);}
    finally{if(ticket===generation)setBusy(false);}
  });
  function result(name,message){
    const li=document.createElement('li');li.textContent=name+' — '+message;$('osResults').append(li);
  }
  function download(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  $('osExport').addEventListener('click',async()=>{
    if(!ready())return;
    if(!window.PDFLib||(files.length>1&&!window.JSZip)){status('PDF/ZIP tools are unavailable. Reload and try again.');return;}
    const ticket=generation,config=settings(),batch=[...files],zip=batch.length>1?new window.JSZip():null;
    let done=0,failed=0,single=null;
    clearPreview();$('osResults').replaceChildren();setBusy(true);
    try{
      for(const file of batch){
        if(ticket!==generation||!allowed())return;
        status('Processing '+(done+failed+1)+' of '+batch.length+'…');
        const name=core.outputName(file.name);
        try{
          const bytes=await signed(file,config,ticket);
          if(ticket!==generation||!allowed())return;
          if(zip)zip.file(name,bytes);else single={name,bytes};
          done++;result(name,'Ready');
        }catch(e){if(ticket!==generation||!allowed())return;failed++;result(file.name,'Skipped: '+e.message);}
      }
      if(!done){status('No PDFs exported. Review the errors below.');return;}
      const blob=zip?await zip.generateAsync({type:'blob'}):new Blob([single.bytes],{type:'application/pdf'});
      if(ticket!==generation||!allowed())return;
      download(blob,zip?'Signed_Offers.zip':single.name);
      status('Exported '+done+' PDF'+(done===1?'':'s')+(failed?'; '+failed+' skipped. Review the results.':'.'));
    }catch(e){if(ticket===generation&&allowed())status('Export failed: '+e.message);}
    finally{if(ticket===generation)setBusy(false);}
  });
  new MutationObserver(()=>{
    if(!allowed()){clear();renderFiles();}else render();
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  clear();renderFiles();
})();
