
/* ---------- navigation ---------- */
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
  });
});

/* ---------- FSA support check ---------- */
const hasFSA = 'showDirectoryPicker' in window;
if(!hasFSA){ document.getElementById('fsa-banner').style.display='block'; }
['extract','sort','rename','mkfolders','list','merge','delete'].forEach(id=>{
  if(!hasFSA){
    document.querySelectorAll(`#panel-${id} button`).forEach(b=>{ if(b.textContent.includes('Choose')) b.disabled=true; });
  }
});

/* ---------- log helpers ---------- */
function logTo(elId, msg, kind){
  const el = document.getElementById(elId);
  const line = document.createElement('div');
  if(kind==='err') line.className='l-err';
  if(kind==='ok') line.className='l-ok';
  if(kind==='warn') line.className='l-warn';
  line.textContent = msg;
  if(el.firstChild && el.firstChild.nodeType===3) el.textContent=''; // clear placeholder text node
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
function clearLog(elId){ document.getElementById(elId).innerHTML=''; }

/* =========================================================
   F-01 OFFER LETTER CREATION
   ========================================================= */
let offerTemplateBuf = null;
let offerRows = null;
let offerCols = [];
let offerSelected = []; // boolean per row index

document.getElementById('offerTemplate').addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  offerTemplateBuf = await f.arrayBuffer();
  logTo('offerLog', `Template loaded: ${f.name}`, 'ok');
  maybeEnableGenerate();
});

document.getElementById('offerCsv').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  Papa.parse(f, {
    header:true, skipEmptyLines:true,
    complete: (res)=>{
      offerRows = res.data;
      offerCols = res.meta.fields || [];
      offerSelected = offerRows.map(()=>true); // default: everyone selected
      const sel = document.getElementById('offerNameCol');
      sel.innerHTML = offerCols.map(c=>`<option value="${c}">${c}</option>`).join('');
      sel.disabled = false;
      document.getElementById('offerColStatus').textContent = `${offerRows.length} row(s) detected`;
      document.getElementById('offerColStatus').className = 'badge ok';
      logTo('offerLog', `Data loaded: ${offerRows.length} rows, columns: ${offerCols.join(', ')}`, 'ok');
      renderOfferRowsTable();
      maybeEnableGenerate();
    },
    error: (err)=> logTo('offerLog', 'CSV parse error: '+err.message, 'err')
  });
});

document.getElementById('offerNameCol').addEventListener('change', renderOfferRowsTable);

function renderOfferRowsTable(){
  if(!offerRows || !offerRows.length) return;
  const nameCol = document.getElementById('offerNameCol').value;
  const tbody = document.querySelector('#offerRowsTable tbody');
  tbody.innerHTML = offerRows.map((row,i)=>`
    <tr>
      <td><input type="checkbox" class="offerRowChk" data-i="${i}" ${offerSelected[i] ? 'checked' : ''}></td>
      <td>${i+1}</td>
      <td>${(row[nameCol] ?? '').toString().replace(/</g,'&lt;')}</td>
    </tr>`).join('');
  document.querySelectorAll('.offerRowChk').forEach(chk=>{
    chk.addEventListener('change', (e)=>{
      offerSelected[Number(e.target.dataset.i)] = e.target.checked;
      updateOfferSelectedCount();
    });
  });
  document.getElementById('offerRowsWrap').style.display='block';
  document.getElementById('offerSelectBtnsWrap').style.display='flex';
  document.getElementById('offerSelectHint').style.display='none';
  updateOfferSelectedCount();
}

function updateOfferSelectedCount(){
  const n = offerSelected.filter(Boolean).length;
  document.getElementById('offerSelectedCount').textContent = `${n} selected`;
  maybeEnableGenerate();
}

document.getElementById('offerSelectAllBtn').addEventListener('click', ()=>{
  offerSelected = offerSelected.map(()=>true);
  document.querySelectorAll('.offerRowChk').forEach(chk=>chk.checked=true);
  updateOfferSelectedCount();
});
document.getElementById('offerSelectNoneBtn').addEventListener('click', ()=>{
  offerSelected = offerSelected.map(()=>false);
  document.querySelectorAll('.offerRowChk').forEach(chk=>chk.checked=false);
  updateOfferSelectedCount();
});

function maybeEnableGenerate(){
  const anySelected = offerSelected.some(Boolean);
  document.getElementById('offerGenerateBtn').disabled = !(offerTemplateBuf && offerRows && offerRows.length && anySelected);
}

document.getElementById('offerGenerateBtn').addEventListener('click', async ()=>{
  clearLog('offerLog');
  const nameCol = document.getElementById('offerNameCol').value;
  const outZip = new JSZip();
  let ok=0, fail=0;
  const rowsToRun = offerRows.filter((_,i)=>offerSelected[i]);
  logTo('offerLog', `Generating ${rowsToRun.length} of ${offerRows.length} candidate(s)…`, 'warn');
  for(const row of rowsToRun){
    const label = (row[nameCol] || `letter_${ok+fail+1}`).toString().replace(/[\\/:*?"<>|]/g,'-').trim() || `letter_${ok+fail+1}`;
    try{
      const zip = new PizZip(offerTemplateBuf);
      const doc = new window.docxtemplater(zip, { paragraphLoop:true, linebreaks:true });
      doc.render(row);
      const out = doc.getZip().generate({ type:'arraybuffer', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      outZip.file(`${label}.docx`, out);
      logTo('offerLog', `Generated: ${label}.docx`, 'ok');
      ok++;
    }catch(err){
      fail++;
      let detail = err.message;
      if(err.properties && err.properties.errors){
        detail = err.properties.errors.map(e=>e.properties && e.properties.explanation ? e.properties.explanation : e.message).join('; ');
      }
      logTo('offerLog', `Failed: ${label} — ${detail}`, 'err');
    }
  }
  if(ok===0){ logTo('offerLog','No letters were generated — check the template placeholders match your CSV columns.','err'); return; }
  const blob = await outZip.generateAsync({type:'blob'});
  saveAs(blob, 'Offer_Letters.zip');
  logTo('offerLog', `Done. ${ok} letter(s) zipped, ${fail} failed.`, ok&&!fail?'ok':'warn');
});

/* =========================================================
   Shared File System Access helpers
   ========================================================= */
async function entryExists(dirHandle, name){
  try{ await dirHandle.getFileHandle(name); return true; }catch(e){}
  try{ await dirHandle.getDirectoryHandle(name); return true; }catch(e){}
  return false;
}
function splitExt(name){
  const m = name.match(/^(.*)(\.[^.]+)$/);
  return m ? [m[1], m[2]] : [name, ''];
}
async function copyFileInto(destDirHandle, name, buf){
  let target = name;
  let i = 1;
  while(await entryExists(destDirHandle, target)){
    const [base, ext] = splitExt(name);
    target = `${base}_${i}${ext}`;
    i++;
  }
  const handle = await destDirHandle.getFileHandle(target, {create:true});
  const w = await handle.createWritable();
  await w.write(buf);
  await w.close();
  return target;
}

/* =========================================================
   F-02 EXTRACT FILES BY TYPE
   ========================================================= */
document.getElementById('extractBtn').addEventListener('click', async ()=>{
  clearLog('extractLog');
  const ext = document.getElementById('extractExt').value.trim().replace(/^\./,'').toLowerCase();
  if(!ext){ logTo('extractLog','Enter a file extension first.','err'); return; }
  let root;
  try{ root = await window.showDirectoryPicker({mode:'readwrite'}); }catch(e){ return; }
  let count=0;
  async function recurse(dirHandle, isRoot){
    const entries = [];
    for await (const [name, handle] of dirHandle.entries()) entries.push([name, handle]);
    for(const [name, handle] of entries){
      if(handle.kind==='directory'){
        await recurse(handle, false);
      } else if(!isRoot && name.toLowerCase().endsWith('.'+ext)){
        const file = await handle.getFile();
        const buf = await file.arrayBuffer();
        const finalName = await copyFileInto(root, name, buf);
        await dirHandle.removeEntry(name);
        logTo('extractLog', `Moved: ${name}${finalName!==name?' → '+finalName:''}`, 'ok');
        count++;
      }
    }
  }
  await recurse(root, true);
  logTo('extractLog', `Done. ${count} file(s) moved to the root folder.`, count?'ok':'warn');
});

/* =========================================================
   F-03 SORT FILES INTO FOLDERS
   ========================================================= */
document.getElementById('sortBtn').addEventListener('click', async ()=>{
  clearLog('sortLog');
  const ext = document.getElementById('sortExt').value.trim().replace(/^\./,'').toLowerCase();
  const autoCreate = document.getElementById('sortAutoCreate').checked;
  if(!ext){ logTo('sortLog','Enter a file extension first.','err'); return; }
  let root;
  try{ root = await window.showDirectoryPicker({mode:'readwrite'}); }catch(e){ return; }
  const entries = [];
  for await (const [name, handle] of root.entries()) entries.push([name, handle]);
  let moved=0, skipped=0, created=0;
  for(const [name, handle] of entries){
    if(handle.kind!=='file' || !name.toLowerCase().endsWith('.'+ext)) continue;
    const [base] = splitExt(name);
    let folderHandle;
    try{ folderHandle = await root.getDirectoryHandle(base); }
    catch(e){
      if(autoCreate){ folderHandle = await root.getDirectoryHandle(base, {create:true}); created++; logTo('sortLog', `Created folder: ${base}`, 'warn'); }
      else{ logTo('sortLog', `Skipped (no matching folder): ${name}`, 'warn'); skipped++; continue; }
    }
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    const finalName = await copyFileInto(folderHandle, name, buf);
    await root.removeEntry(name);
    logTo('sortLog', `Moved ${name} → ${base}/${finalName}`, 'ok');
    moved++;
  }
  logTo('sortLog', `Done. ${moved} moved, ${skipped} skipped, ${created} folder(s) created.`, 'ok');
});

/* =========================================================
   F-04 BATCH RENAME
   ========================================================= */
let renameRootHandle = null;
let renamePairs = [];

document.getElementById('renamePreviewBtn').addEventListener('click', async ()=>{
  clearLog('renameLog');
  document.getElementById('renamePreviewWrap').style.display='none';
  const filter = document.getElementById('renameFilter').value.trim().toLowerCase();
  const ext = document.getElementById('renameExt').value.trim().replace(/^\./,'').toLowerCase();
  const namesRaw = document.getElementById('renameNames').value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(!namesRaw.length){ logTo('renameLog','Enter at least one new name.','err'); return; }
  let root;
  try{ root = await window.showDirectoryPicker({mode:'readwrite'}); }catch(e){ return; }
  renameRootHandle = root;
  let files = [];
  for await (const [name, handle] of root.entries()){
    if(handle.kind!=='file') continue;
    if(ext && !name.toLowerCase().endsWith('.'+ext)) continue;
    if(filter && !name.toLowerCase().includes(filter)) continue;
    files.push(name);
  }
  files.sort((a,b)=> a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
  renamePairs = files.map((name,i)=>({ current:name, next: namesRaw[i] ? namesRaw[i] + splitExt(name)[1] : null }));
  const tbody = document.querySelector('#renameTable tbody');
  tbody.innerHTML = renamePairs.map(p=>`<tr><td class="mono">${p.current}</td><td class="mono">${p.next || '<em>no name left in list</em>'}</td></tr>`).join('');
  document.getElementById('renamePreviewWrap').style.display='block';
  logTo('renameLog', `Found ${files.length} matching file(s), ${namesRaw.length} name(s) provided. Review the table, then confirm.`, 'warn');
});

document.getElementById('renameConfirmBtn').addEventListener('click', async ()=>{
  if(!renameRootHandle) return;
  let done=0, skipped=0;
  for(const p of renamePairs){
    if(!p.next){ skipped++; continue; }
    try{
      const handle = await renameRootHandle.getFileHandle(p.current);
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      const finalName = await copyFileInto(renameRootHandle, p.next, buf);
      await renameRootHandle.removeEntry(p.current);
      logTo('renameLog', `Renamed ${p.current} → ${finalName}`, 'ok');
      done++;
    }catch(e){
      logTo('renameLog', `Failed on ${p.current}: ${e.message}`, 'err');
    }
  }
  logTo('renameLog', `Done. ${done} renamed, ${skipped} skipped (no name left).`, 'ok');
  document.getElementById('renamePreviewWrap').style.display='none';
});

/* =========================================================
   F-05 CREATE FOLDERS FROM LIST
   ========================================================= */
document.getElementById('mkNamesFile').addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const text = await f.text();
  document.getElementById('mkNames').value = text;
});

document.getElementById('mkBtn').addEventListener('click', async ()=>{
  clearLog('mkLog');
  const names = document.getElementById('mkNames').value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(!names.length){ logTo('mkLog','Enter at least one folder name.','err'); return; }
  let root;
  try{ root = await window.showDirectoryPicker({mode:'readwrite'}); }catch(e){ return; }
  let created=0, skipped=0;
  for(const name of names){
    if(await entryExists(root, name)){ logTo('mkLog', `Skipped (already exists): ${name}`, 'warn'); skipped++; continue; }
    await root.getDirectoryHandle(name, {create:true});
    logTo('mkLog', `Created: ${name}`, 'ok');
    created++;
  }
  logTo('mkLog', `Done. ${created} folder(s) created, ${skipped} skipped.`, 'ok');
});

/* =========================================================
   F-06 LIST FILES / FOLDERS
   ========================================================= */
let listResult = [];
document.getElementById('listBtn').addEventListener('click', async ()=>{
  clearLog('listLog');
  document.getElementById('listDownloadWrap').style.display='none';
  const mode = document.getElementById('listMode').value;
  let root;
  try{ root = await window.showDirectoryPicker(); }catch(e){ return; }
  listResult = [];
  for await (const [name, handle] of root.entries()){
    if(mode==='files' && handle.kind==='file') listResult.push(name);
    if(mode==='folders' && handle.kind==='directory') listResult.push(name);
  }
  listResult.sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
  listResult.forEach(n=>logTo('listLog', n));
  logTo('listLog', `— ${listResult.length} ${mode} listed —`, 'ok');
  document.getElementById('listDownloadWrap').style.display='flex';
});
document.getElementById('listDownloadBtn').addEventListener('click', ()=>{
  const blob = new Blob([listResult.join('\n')], {type:'text/plain'});
  saveAs(blob, document.getElementById('listMode').value === 'files' ? 'file_names.txt' : 'folder_names.txt');
});
document.getElementById('listCopyBtn').addEventListener('click', ()=>{
  navigator.clipboard.writeText(listResult.join('\n'));
  logTo('listLog', 'Copied to clipboard.', 'ok');
});

/* =========================================================
   F-07 MERGE PDFS BY FOLDER
   ========================================================= */
document.getElementById('mergeBtn').addEventListener('click', async ()=>{
  clearLog('mergeLog');
  const keep = document.getElementById('mergeKeepOriginals').checked;
  let root;
  try{ root = await window.showDirectoryPicker({mode:'readwrite'}); }catch(e){ return; }
  let mergedCount=0;

  async function processDir(dirHandle, label){
    const pdfEntries = [];
    const subdirs = [];
    for await (const [name, handle] of dirHandle.entries()){
      if(handle.kind==='file' && name.toLowerCase().endsWith('.pdf')) pdfEntries.push([name, handle]);
      if(handle.kind==='directory') subdirs.push([name, handle]);
    }
    const mergedName = `${label}.pdf`;
    const toMerge = pdfEntries.filter(([name])=> name !== mergedName);
    if(toMerge.length >= 2){
      try{
        const merged = await PDFLib.PDFDocument.create();
        for(const [name, handle] of toMerge){
          const file = await handle.getFile();
          const bytes = await file.arrayBuffer();
          const src = await PDFLib.PDFDocument.load(bytes);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p=>merged.addPage(p));
        }
        const mergedBytes = await merged.save();
        const outHandle = await dirHandle.getFileHandle(mergedName, {create:true});
        const w = await outHandle.createWritable();
        await w.write(mergedBytes);
        await w.close();
        logTo('mergeLog', `Merged ${toMerge.length} PDF(s) in "${label}" → ${mergedName}`, 'ok');
        mergedCount++;
        if(!keep){
          for(const [name] of toMerge) await dirHandle.removeEntry(name);
          logTo('mergeLog', `Deleted originals in "${label}"`, 'warn');
        }
      }catch(e){
        logTo('mergeLog', `Failed to merge in "${label}": ${e.message}`, 'err');
      }
    }
    for(const [name, handle] of subdirs){ await processDir(handle, name); }
  }
  await processDir(root, root.name || 'root');
  logTo('mergeLog', `Done. ${mergedCount} folder(s) merged.`, 'ok');
});

/* =========================================================
   F-09 DELETE WORD FILES
   ========================================================= */
let deleteTargets = []; // {dirHandle, name}
document.getElementById('deleteScanBtn').addEventListener('click', async ()=>{
  clearLog('deleteLog');
  document.getElementById('deleteConfirmWrap').style.display='none';
  let root;
  try{ root = await window.showDirectoryPicker({mode:'readwrite'}); }catch(e){ return; }
  deleteTargets = [];
  async function scan(dirHandle, path){
    const entries = [];
    for await (const [name, handle] of dirHandle.entries()) entries.push([name, handle]);
    for(const [name, handle] of entries){
      if(handle.kind==='directory'){ await scan(handle, path+name+'/'); }
      else if(/\.docx?$/i.test(name)){
        deleteTargets.push({dirHandle, name});
        logTo('deleteLog', path+name, 'warn');
      }
    }
  }
  await scan(root, '');
  document.getElementById('deleteCount').textContent = deleteTargets.length;
  if(deleteTargets.length){ document.getElementById('deleteConfirmWrap').style.display='block'; }
  logTo('deleteLog', `— ${deleteTargets.length} Word file(s) found —`, 'ok');
});
document.getElementById('deleteConfirmInput').addEventListener('input', (e)=>{
  document.getElementById('deleteConfirmBtn').disabled = e.target.value.trim() !== 'DELETE';
});
document.getElementById('deleteConfirmBtn').addEventListener('click', async ()=>{
  let done=0;
  for(const t of deleteTargets){
    try{ await t.dirHandle.removeEntry(t.name); done++; }
    catch(e){ logTo('deleteLog', `Failed: ${t.name} — ${e.message}`, 'err'); }
  }
  logTo('deleteLog', `Deleted ${done} file(s).`, 'ok');
  document.getElementById('deleteConfirmWrap').style.display='none';
  deleteTargets = [];
});
