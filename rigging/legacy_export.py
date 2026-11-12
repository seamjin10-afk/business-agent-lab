import struct
class Writer:
 def __init__(self):self.b=bytearray()
 def byte(self,v):self.b.append(v&255)
 def vi(self,v):
  while v>127:self.byte((v&127)|128);v>>=7
  self.byte(v)
 def string(self,s):
  if s is None:self.vi(0);return
  b=s.encode('utf8');self.vi(len(b)+1);self.b.extend(b)
 def f(self,v):self.b.extend(struct.pack('>f',v))
 def u32(self,v):self.b.extend(struct.pack('>I',v))

def binary(data):
 animations=data["animations"];bones=data["bones"];slots=data["slots"];skin=data["skins"]["default"]
 w=Writer();w.string(data['skeleton']['hash']);w.string('2.1.27');w.f(data["skeleton"]["width"]);w.f(data["skeleton"]["height"]);w.byte(0)
 indices={b['name']:i for i,b in enumerate(bones)}
 w.vi(len(bones))
 for b in bones:
  w.string(b['name']);w.vi(indices[b['parent']]+1 if 'parent'in b else 0)
  for key,default in [('x',0),('y',0),('scaleX',1),('scaleY',1),('rotation',0),('length',0)]:w.f(b.get(key,default))
  for v in [0,0,1,1]:w.byte(v)
 w.vi(0);w.vi(len(slots))
 for s in slots:w.string(s['name']);w.vi(indices[s['bone']]);w.u32(0xffffffff);w.string(s['attachment']);w.byte(0)
 w.vi(len(slots))
 for i,s in enumerate(slots):
  n=s['name'];a=skin[n][n];w.vi(i);w.vi(1);w.string(n);w.string(None);w.byte(0);w.string(n)
  for v in [a.get('x',0),a.get('y',0),a.get('scaleX',1),a.get('scaleY',1),a.get('rotation',0),a['width'],a['height']]:w.f(v)
  w.u32(0xffffffff)
 w.vi(0);w.vi(0);w.vi(len(animations))
 for n,a in animations.items():
  w.string(n);w.vi(0);w.vi(len(a['bones']))
  for boneName,timelines in a['bones'].items():
   w.vi(indices[boneName]);w.vi(len(timelines))
   for kind,frames in timelines.items():
    w.byte({'rotate':1,'translate':2}[kind]);w.vi(len(frames))
    for i,f in enumerate(frames):
     w.f(f['time'])
     if kind=='rotate':w.f(f['angle'])
     else:w.f(f.get('x',0));w.f(f.get('y',0))
     if i<len(frames)-1:w.byte(0)
  for _ in range(4):w.vi(0)
 return bytes(w.b)
