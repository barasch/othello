import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES } from '../site/js/appearance.js';
import { engineLevel, randomLegalMove } from '../site/js/play.js';
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;}
test('every curated tile pair has at least 7:1 luminance contrast',()=>{
  for(const p of PALETTES)assert.ok((luminance(p.light)+0.05)/(luminance(p.dark)+0.05)>=7,p.name);
});
test('five difficulties map correctly and random selection covers legal moves',()=>{
  assert.deepEqual([1,2,3,4,5].map(engineLevel),[null,1,4,7,10]);
  const moves=[{move:19},{move:26},{move:37},{move:44}];
  for(let i=0;i<4;i++)assert.equal(randomLegalMove(moves,()=>i/4),moves[i].move);
  assert.equal(randomLegalMove([]),'pass');
});
