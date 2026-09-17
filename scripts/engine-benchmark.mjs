import { initialBoard, legalMoves, applyMove, opponent, countDiscs } from '../site/js/rules.js';
import { chooseMove } from '../site/js/engine.js';
let board=initialBoard(),side=1;
const positions=[{name:'opening',board,side}];
for(let i=0;i<52;i++){
  const moves=legalMoves(board,side);
  if(moves.length)board=applyMove(board,moves[(i*7)%moves.length].move,side);
  side=opponent(side);
  if(i===21||i===47)positions.push({name:i===21?'middlegame':'endgame',board,side});
}
for(const p of positions){
  for(const level of [1,4,7,10]){
    const result=chooseMove(p.board,p.side,level);
    console.log(JSON.stringify({position:p.name,empty:countDiscs(p.board).empty,level,nodes:result.nodes,ms:Math.round(result.elapsedMs),move:result.move,score:result.lines[0].score}));
  }
}
