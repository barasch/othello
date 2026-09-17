#!/usr/bin/env python3
"""Generate deterministic Edax 4.6 reference continuations. No Edax code is bundled.
Usage: python scripts/reference-games.py /path/to/edax /path/to/eval.dat
"""
import sys, json, random, subprocess, tempfile, re, pathlib, hashlib, time
from concurrent.futures import ThreadPoolExecutor
ROOT = pathlib.Path(__file__).resolve().parents[1]
EDAX, WEIGHTS = map(lambda s: str(pathlib.Path(s).resolve()), sys.argv[1:3])
N = int(sys.argv[3]) if len(sys.argv)>3 else 256
DIRECTIONS = [(x,y) for y in (-1,0,1) for x in (-1,0,1) if x or y]
def flips(b,m,s):
    if b[m]: return []
    found=[]; x,y=m%8,m//8
    for dx,dy in DIRECTIONS:
        a,c=x+dx,y+dy; line=[]
        while 0<=a<8 and 0<=c<8 and b[c*8+a]==3-s:
            line.append(c*8+a); a+=dx; c+=dy
        if line and 0<=a<8 and 0<=c<8 and b[c*8+a]==s: found+=line
    return found
def legal(b,s): return [m for m in range(64) if flips(b,m,s)]
def apply(b,m,s):
    b=b[:]
    for p in flips(b,m,s)+[m]: b[p]=s
    return b
def coord(s): return (ord(s[0].lower())-97)+(int(s[1])-1)*8
openings=(ROOT/'site/data/openingslarge.txt').read_text().splitlines()
openings=[s.strip() for s in openings if re.fullmatch(r'(?:[a-hA-H][1-8]){8}',s.strip())]
games=[]
for i in range(N):
    rng=random.Random(20260917+i); b=[0]*64; b[27]=b[36]=2; b[28]=b[35]=1; s=1; prefix=[]
    if i%2:
        line=rng.choice(openings)
        for j in range(0,len(line),2):
            m=coord(line[j:j+2]); b=apply(b,m,s); prefix.append(m); s=3-s
    # Varied legal prefixes expose mistakes as well as balanced starts.
    for _ in range(rng.randrange(1,25)):
        moves=legal(b,s)
        if not moves:
            s=3-s; prefix.append('pass'); moves=legal(b,s)
            if not moves: break
        m=rng.choice(moves); b=apply(b,m,s); prefix.append(m); s=3-s
    games.append(dict(id=i,board=b,side=s,prefix=prefix,events=[],samples=[],done=False))
checkpoint=ROOT/"calibration/reference-checkpoint.json"
first_turn=0
if checkpoint.exists():
    saved=json.loads(checkpoint.read_text()); games=saved["games"]; first_turn=saved["turn"]+1
start=time.time()
with tempfile.TemporaryDirectory() as tmp:
    for turn in range(first_turn,125):
        active=[]
        for g in games:
            if g['done']: continue
            b,s=g['board'],g['side']; moves=legal(b,s)
            if not moves:
                if not legal(b,3-s):
                    diff=b.count(1)-b.count(2); g['outcome']=(diff>0)-(diff<0); g['margin']=diff; g['done']=True; continue
                g['events'].append('pass'); g['side']=3-s; s=3-s
            empty=b.count(0)
            if not g['samples'] or empty%8==0 or empty in (6,3):
                g['samples'].append(dict(board=b[:],side=s,empty=empty))
            active.append(g)
        if not active: break
        def solve_batch(pair):
            batchid,batch=pair
            batchfile=pathlib.Path(tmp)/f'batch-{batchid}.obf'
            batchfile.write_text('\n'.join(''.join('-XO'[v] for v in g['board'])+' '+('X' if g['side']==1 else 'O')+';' for g in batch)+'\n')
            run=subprocess.run([EDAX,'-solve',str(batchfile),'-l','12','-n','1','-h','20','-eval-file',WEIGHTS,'-book-usage','off'],capture_output=True,text=True,check=True)
            rows=[]
            for line in run.stdout.splitlines():
                match=re.match(r'^\s*(\d+)\|\s*(\S+)\s+([+-]\d+)\s+.*?\s([a-h][1-8])(?:\s|$)',line,re.I)
                if match: rows.append((int(match[1]),coord(match[4])))
            if len(rows)!=len(batch): raise RuntimeError(f'Expected {len(batch)} rows, got {len(rows)}\n{run.stdout[-6000:]}')
            return [(g,m) for (_,m),g in zip(rows,batch)]
        batches=[active[j:j+16] for j in range(0,len(active),16)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(solve_batch,enumerate(batches)):
                for g,m in result:
                    if not flips(g['board'],m,g['side']): raise RuntimeError('Illegal reference move')
                    g['board']=apply(g['board'],m,g['side']); g['events'].append(m); g['side']=3-g['side']
        checkpoint.write_text(json.dumps(dict(turn=turn,games=games),separators=(',',':')))
        print(f'round {turn}, {len(active)} games, {time.time()-start:.1f}s',flush=True)
    if not all(g['done'] for g in games): raise RuntimeError('Unfinished games')
seen=set(); records=[]
for g in games:
    for p in g['samples']:
        key=tuple(p['board'])+(p['side'],)
        if key in seen: continue
        seen.add(key)
        records.append(dict(game=g['id'],split='validation' if g['id']%5==0 else 'train',**p,outcome=g['outcome']))
output=dict(seed=20260917,reference='Edax 4.6, level 12, one task, book off',games=N,positions=len(records),weightsSha256=hashlib.sha256(pathlib.Path(WEIGHTS).read_bytes()).hexdigest(),records=records,trajectories=[{k:v for k,v in g.items() if k not in ('board','samples','done')} for g in games])
(ROOT/'calibration/reference-games.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
print(f'Wrote {len(records)} positions from {N} games in {time.time()-start:.1f}s',flush=True)

checkpoint.unlink(missing_ok=True)
