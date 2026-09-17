import test from 'node:test';
import assert from 'node:assert/strict';
import { outcomeProbabilities, outcomeIndex, formatAdvantage } from '../site/js/calibration.js';
import { readFileSync } from 'node:fs';

test('calibration is a valid, symmetric, monotone outcome model at every supported depth and phase',()=>{
  for(let level=1;level<=6;level++)for(let empty=0;empty<=60;empty++){
    let previous=-101;
    for(let score=-1500;score<=1500;score+=25){
      const p=outcomeProbabilities({score,solved:false},empty,level);
      assert.ok(Object.values(p).every(x=>Number.isFinite(x)&&x>=0&&x<=1));
      assert.ok(Math.abs(p.black+p.white+p.draw-1)<1e-12);
      const index=outcomeIndex({score,solved:false},empty,level);
      assert.ok(index>=previous);previous=index;
      assert.ok(Math.abs(index+outcomeIndex({score:-score,solved:false},empty,level))<1e-10);
      assert.ok(Math.abs(index)<=99);
    }
  }
});
test('terminal and proven outcomes use the same index, irrespective of tile margin',()=>{
  for(const score of [8002,8030,8064])assert.equal(outcomeIndex({score,solved:true},12,4),100);
  assert.equal(outcomeIndex({score:-8002,solved:true},12,4),-100);
  assert.equal(outcomeIndex({score:0,solved:true},12,4),0);
  assert.equal(formatAdvantage(0),'Even · 0');
  assert.equal(formatAdvantage(-60),'White +60');
});
test('published validation is held out by game and improves on the outcome-frequency baseline',()=>{
  const report=JSON.parse(readFileSync(new URL('../calibration/validation.json',import.meta.url)));
  const data=JSON.parse(readFileSync(new URL('../calibration/scored-positions.json',import.meta.url)));
  const train=new Set(data.records.filter(p=>p.split==='train').map(p=>p.game));
  assert.ok(data.records.filter(p=>p.split==='validation').every(p=>!train.has(p.game)));
  for(const d of report.depths){
    assert.ok(d.validation.n>100);
    assert.ok(d.validation.logLoss<d.baselineLogLoss,`depth ${d.level}`);
  }
});

test('all stored reference trajectories replay legally and agree with their outcome labels',async()=>{
  const { initialBoard, legalMoves, applyMove, opponent, isTerminal, countDiscs }=await import('../site/js/rules.js');
  const data=JSON.parse(readFileSync(new URL('../calibration/reference-games.json',import.meta.url)));
  for(const g of data.trajectories){
    let board=initialBoard(),side=1;
    const positions=new Set();
    for(const move of [...g.prefix,...g.events]){
      positions.add(board.join('')+side);
      if(move==='pass')assert.equal(legalMoves(board,side).length,0);
      else {board=applyMove(board,move,side);assert.ok(board,`game ${g.id}`);}
      side=opponent(side);
    }
    assert.ok(isTerminal(board),`game ${g.id}`);
    const counts=countDiscs(board);
    assert.equal(Math.sign(counts.black-counts.white),g.outcome);
    for(const p of data.records.filter(p=>p.game===g.id))assert.ok(positions.has(p.board.join('')+p.side),`sample from game ${g.id}`);
  }
});
