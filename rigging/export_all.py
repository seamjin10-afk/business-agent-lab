"""Rebuild Spine 2.1 binaries and the local preview bundle from editable JSON."""
from pathlib import Path
import base64,json
from legacy_export import binary
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
bundle={'rigs':{},'names':manifest['names'],'poses':manifest['poses']}
for rid in manifest['rigs']:
 folder=ROOT/rid
 data=json.loads((folder/(rid+'.json')).read_text(encoding='utf-8'))
 raw=binary(data)
 (folder/(rid+'.skel')).write_bytes(raw)
 page_names=sorted({r['page'] for r in data['regions'].values()})
 pages={p:'data:image/png;base64,'+base64.b64encode((folder/p).read_bytes()).decode('ascii') for p in page_names}
 meta={k:data[k] for k in ['id','name','mounted','durations','footContacts','strideDistance','viewBounds','regions'] if k in data}
 bundle['rigs'][rid]={'binary':base64.b64encode(raw).decode('ascii'),'meta':meta,'pages':pages}
 print(rid+': '+str(len(raw))+' bytes / '+str(len(data['animations']))+' animations')
(ROOT/'rig-bundle.js').write_text('window.WFRP_RIG_BUNDLE='+json.dumps(bundle,ensure_ascii=False)+';',encoding='utf-8')
print('Preview ready: python -m http.server 8000')
