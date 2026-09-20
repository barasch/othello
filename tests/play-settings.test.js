import test from 'node:test';
import assert from 'node:assert/strict';
import { engineLevel, randomLegalMove } from '../site/js/play.js';

test('five difficulties map correctly and random selection covers legal moves',()=>{
  assert.deepEqual([1,2,3,4,5].map(engineLevel),[null,1,4,7,10]);
  const moves=[{move:19},{move:26},{move:37},{move:44}];
  for(let i=0;i<4;i++)assert.equal(randomLegalMove(moves,()=>i/4),moves[i].move);
  assert.equal(randomLegalMove([]),'pass');
});
