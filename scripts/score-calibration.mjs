// Score independent reference positions with every supported analysis depth.
// CPU workers are isolated; no engine state or mutable boards are shared.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analyzePosition } from '../site/js/engine.js';
if (!isMainThread) {
  parentPort.on('message', ({id, position}) => {
    const results=[];
    for (let level=1;level<=6;level++) {
      const line=analyzePosition(position.board,position.side,level).lines[0];
      results.push({level,score:line.score,solved:line.solved});
    }
    parentPort.postMessage({id,results});
  });
} else {
  const referencePath=new URL('../calibration/reference-games.json',import.meta.url);
  const complete=existsSync(referencePath);
  const data=complete?JSON.parse(readFileSync(referencePath)):{records:JSON.parse(readFileSync(new URL('../calibration/reference-checkpoint.json',import.meta.url))).games.flatMap(g=>g.samples.map(p=>({...p,game:g.id}))) };
  const cachePath=new URL('../calibration/score-cache.json',import.meta.url);
  const cache=existsSync(cachePath)?JSON.parse(readFileSync(cachePath)):{};
  const key=p=>p.board.join('')+p.side;
  const count=Number(process.env.CALIBRATION_WORKERS||4), rows=Array(data.records.length);
  let next=0,done=0;
  const started=Date.now();
  await Promise.all(Array.from({length:count},()=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url));
    const send=()=>{
      if(next>=data.records.length) {worker.terminate();resolve();return;}
      while(next<data.records.length && cache[key(data.records[next])]) {rows[next]={...data.records[next],results:cache[key(data.records[next])]};next++;done++;}
      if(next>=data.records.length){worker.terminate();resolve();return;}
      const id=next++; worker.postMessage({id,position:data.records[id]});
    };
    worker.on('message',({id,results})=>{
      rows[id]={...data.records[id],results};cache[key(data.records[id])]=results;done++;
      if(done%50===0)writeFileSync(cachePath,JSON.stringify(cache));
      if(done%100===0) process.stdout.write(`${done}/${rows.length} positions, ${((Date.now()-started)/1000).toFixed(0)}s\n`);
      send();
    });worker.on('error',reject);send();
  })));
  writeFileSync(cachePath,JSON.stringify(cache));
  if(complete)writeFileSync(new URL('../calibration/scored-positions.json',import.meta.url),JSON.stringify({reference:data.reference,seed:data.seed,records:rows})+'\n');
  console.log(`Wrote ${rows.length} scored positions.`);
}
