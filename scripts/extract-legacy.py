"""One-time, lossless extraction of classic JS/CSS blocks in their original order.
Usage: python3 scripts/extract-legacy.py path/to/monolithic-index.html
Run against a copy; refuses to overwrite an existing manifest.
"""
from html.parser import HTMLParser
from pathlib import Path
import hashlib,json,re,sys
source=Path(sys.argv[1]).read_text()
manifest=Path('docs/asset-manifest.json')
if manifest.exists(): raise SystemExit('Manifest exists: extraction already completed.')
lines=source.splitlines(keepends=True); starts=[0]
for line in lines: starts.append(starts[-1]+len(line))
class Blocks(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=False); self.active=None; self.blocks=[]
 def absolute_position(self): row,col=self.getpos(); return starts[row-1]+col
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):
   pos=self.absolute_position(); self.active=(tag,dict(attrs),pos,pos+len(self.get_starttag_text()))
 def handle_endtag(self,tag):
  if self.active and self.active[0]==tag:
   end=self.absolute_position();self.blocks.append((*self.active,end,end+len('</'+tag+'>')));self.active=None
p=Blocks();p.feed(source)
entries=[]; changes=[]; counts={'script':0,'style':0}
for tag,attrs,start,body,end,finish in p.blocks:
 if tag=='script' and ('src' in attrs or attrs.get('type','') not in ('','text/javascript','application/javascript')): continue
 counts[tag]+=1;content=source[body:end];number=counts[tag]
 title=''
 if tag=='script':
  match=re.search(r'\(function\s+([A-Za-z_$][\w$]*)',content)
  if match:title=match.group(1)
 if not title:
  clean=re.sub(r'^[\s/*=\-#]+','',content)
  title=next((l.strip(' /*=-#\t') for l in clean.splitlines() if re.search(r'[A-Za-z]{3}',l)),tag)
 title=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-')[:65].rstrip('-') or tag
 ext='js' if tag=='script' else 'css'; path=f'public/{ext}/legacy/{number:03d}-{title}.{ext}'
 Path(path).parent.mkdir(parents=True,exist_ok=True);Path(path).write_text(content)
 attrs.pop('type',None)
 if tag=='script':
  suffix=''.join(' '+k+'="'+str(v)+'"' for k,v in attrs.items())
  replacement=f'<script src="/{path[7:]}"{suffix}></script>'
 else:
  suffix=''.join(' '+k+'="'+str(v)+'"' for k,v in attrs.items())
  replacement=f'<link rel="stylesheet" href="/{path[7:]}"{suffix}>'
 changes.append((start,finish,replacement))
 entries.append({'kind':ext,'path':path,'sourceLine':source.count('\n',0,start)+1,'sha256':hashlib.sha256(content.encode()).hexdigest(),'lines':len(content.splitlines()),'title':title})
updated=source
for start,end,replacement in reversed(changes):updated=updated[:start]+replacement+updated[end:]
# Keeping comments is intentional: extraction changes only the raw script/style bodies.
Path('public/index.html').write_text(updated)
manifest.write_text(json.dumps({'baseline':'security-prepared-local-beb4ed7','strategy':'classic scripts at original parser positions; CSS in original cascade order','assets':entries},indent=2)+'\n')
print(json.dumps({'scriptFiles':counts['script'],'styleFiles':counts['style'],'htmlLines':len(updated.splitlines()),'originalLines':len(source.splitlines())}))
