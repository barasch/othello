import { analyzePosition, chooseMove } from "./engine.js";

self.addEventListener("message", ({ data }) => {
  if (!data || !Array.isArray(data.board)) return;
  if (data.type === "move") {
    self.postMessage({ type: "move", requestId: data.requestId, result: chooseMove(data.board, data.side, data.level) });
    return;
  }
  if (data.type === "analyze") {
    for (let level = 1; level <= data.maxLevel; level += 1) {
      const result = analyzePosition(data.board, data.side, level, data.multiPv);
      self.postMessage({
        type: "analysis",
        requestId: data.requestId,
        complete: level === data.maxLevel,
        result,
      });
    }
  }
});
