import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initialBoard, legalMoves, applyMove, opponent, isTerminal } from '../site/js/rules.js';
import { DEFAULT_STATE } from '../site/js/storage.js';

// Execute the actual application against a DOM with a controllable worker and
// clock, exercising event wiring, cancellation, and rendered state transitions.
test('play UI: five levels, restart, random play, menus, XOT, passes, analysis', async (t) => {
  const dom = new JSDOM(await readFile(new URL('../site/index.html', import.meta.url),'utf8'),{url:'https://example.test/'});
  const {window}=dom;
  Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:(fn)=>fn()});
  let now=0,serial=0,workers=0;const timers=new Map(),requests=[];
  const savedTimeout=globalThis.setTimeout,savedClear=globalThis.clearTimeout;
  const savedCrypto=Object.getOwnPropertyDescriptor(globalThis,"crypto");
  Object.defineProperty(globalThis,"crypto",{configurable:true,value:{getRandomValues:buffer=>buffer.fill(0)}});
  const savedRandom=Math.random; let seed=20260917;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const savedPerformance=globalThis.performance;
  globalThis.setTimeout=(fn,delay)=>{timers.set(++serial,{fn,at:now+delay});return serial;};
  globalThis.clearTimeout=(id)=>timers.delete(id);
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  globalThis.Worker=class {
    constructor(){workers++;this.handlers={};this.stopped=false;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    terminate(){this.stopped=true;}
    postMessage(data){
      requests.push(data);
      if(data.type==='analyze')return;
      const move=legalMoves(data.board,data.side)[0]?.move??'pass';
      queueMicrotask(()=>{if(!this.stopped)this.handlers.message({data:{type:'move',requestId:data.requestId,result:{move}}});});
    }
  };
  const openingText=await readFile(new URL('../site/data/openingslarge.txt',import.meta.url),'utf8');
  const savedFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,text:async()=>openingText});
  localStorage.setItem('sb.othello.v2',JSON.stringify({...DEFAULT_STATE,playSettings:{difficulty:2,color:'black',opening:'standard'}}));
  const tick=async(ms)=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await Promise.resolve();};
  const click=async(selector)=>{const el=document.querySelector(selector);assert.ok(el,selector);el.click();await new Promise(resolve=>setImmediate(resolve));};
  const settings=async(selector,value)=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new window.Event('input',{bubbles:true}));await Promise.resolve();};
  const discs=()=>[...document.querySelectorAll('.board .disc')].map(el=>[el.parentElement.dataset.move,el.className.replace(' changed','')]);
  try {
    await import('../site/js/app.js');
    assert.equal(document.querySelector('#difficulty').max,'5');
    await click('[data-action="start-game"]');
    assert.equal(document.querySelector('.occupancy'),null);
    await click('.square.legal');
    assert.equal(requests.at(-1).level,1);
    assert.equal(discs().length,5);
    await tick(999);assert.equal(discs().length,5);
    await tick(1);assert.equal(discs().length,6);
    await click('[data-action="toggle-menu"]');await click('[data-action="restart"]');
    assert.equal(discs().length,4);assert.ok(document.querySelector('.game-screen'));
    await click('[data-action="toggle-menu"]');await click('[data-action="appearance"]');
    await click('[data-action="tiles"][data-tiles="colors"]');
    assert.notEqual(document.documentElement.style.getPropertyValue('--disc-black'),'#070908');
    await click('[data-action="theme"][data-theme="dark"]');assert.equal(document.documentElement.dataset.theme,'dark');
    await click('[data-action="menu-back"]');await click('[data-action="start-screen"]');
    await settings('#difficulty','1');await settings('input[data-setting="opening"][value="xot"]','xot');
    await click('[data-action="start-game"]');await Promise.resolve();await Promise.resolve();
    const opening=discs();assert.equal(opening.length,12);
    await click('[data-action="toggle-menu"]');await click('[data-action="restart"]');await Promise.resolve();
    assert.deepEqual(discs(),opening);
    const before=workers;await click('.square.legal');await tick(1000);assert.equal(workers,before);
    // Cancel a scheduled computer move by restarting.
    await click('.square.legal');await click('[data-action="toggle-menu"]');await click('[data-action="restart"]');
    await tick(2000);assert.deepEqual(discs(),opening);
    // Play a full game using the UI, observing forced passes when encountered.
    let computerPasses=0,humanPasses=0;
    for(let turn=0;turn<150&&!document.querySelector('.result-dialog');turn++){
      if(document.querySelector('.computer-pass')){
        computerPasses++;const old=discs();assert.equal(document.querySelectorAll('.square.legal').length,0);
        await tick(999);assert.ok(document.querySelector('.computer-pass'));assert.deepEqual(discs(),old);
        await tick(1);assert.equal(document.querySelector('.computer-pass'),null);
      }else if(document.querySelector('[data-action="pass"]')){humanPasses++;await click('[data-action="pass"]');}
      else if(document.querySelector('.square.legal'))await click('.square.legal');
      else await tick(1000);
    }
    assert.ok(document.querySelector('.result-dialog'));
    t.diagnostic(`Observed ${computerPasses} computer passes and ${humanPasses} human passes`);
    assert.ok(computerPasses > 0, 'exercise the one-second computer pass notice');
    await click('[data-action="analyze-finished"]');
    assert.equal(document.querySelector('.analysis-screen .occupancy'),null);
    assert.ok(document.querySelector('.analysis-value strong'));
    assert.match(document.querySelector('.analysis-value strong').textContent,/^(Black \+100|White \+100|Even · 0)$/);
    await click('[data-action="navigate"][data-direction="previous"]');
    assert.equal(requests.at(-1).type,'analyze');
  } finally {
    Object.defineProperty(globalThis,"crypto",savedCrypto);
    Math.random=savedRandom;
    globalThis.setTimeout=savedTimeout;globalThis.clearTimeout=savedClear;globalThis.fetch=savedFetch;
    Object.defineProperty(globalThis,'performance',{configurable:true,value:savedPerformance});
    dom.window.close();
  }
});
