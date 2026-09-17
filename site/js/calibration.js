import { CALIBRATION } from './calibration-model.js';
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export function outcomeProbabilities(line, empty, level) {
  if (line.solved) return { black: line.score > 0 ? 1 : 0, white: line.score < 0 ? 1 : 0, draw: line.score === 0 ? 1 : 0 };
  const model = CALIBRATION.models[Math.max(0, Math.min(5, Math.trunc(level) - 1))];
  const phase = (60 - Math.max(0, Math.min(60, empty))) / 60;
  const evaluate = (v) => Math.exp(Math.max(-12, Math.min(12, v[0] + v[1] * phase + v[2] * phase * phase)));
  const a = evaluate(model.a), b = evaluate(model.b);
  const black = sigmoid((line.score - a) / b), white = sigmoid((-line.score - a) / b);
  return { black, white, draw: Math.max(0, 1 - black - white) };
}
export function outcomeIndex(line, empty, level) {
  const p = outcomeProbabilities(line, empty, level);
  const value = 100 * (p.black - p.white);
  // Reserve displayed ±100 for proven results, not rounded heuristic estimates.
  return line.solved ? value : Math.max(-99, Math.min(99, value));
}
export function formatAdvantage(value) {
  const rounded = Math.round(Math.abs(value));
  return rounded === 0 ? 'Even · 0' : `${value > 0 ? 'Black' : 'White'} +${rounded}`;
}
