# Outcome calibration

The analysis index is `100 × (P(Black wins) − P(White wins))`. It is net outcome advantage, not a disc margin or a literal probability of victory. The deployed browser downloads only `site/js/calibration-model.js`, not this dataset or Edax.

## Reproduction

1. Obtain the official [Edax 4.6 Linux release](https://github.com/abulmo/edax-reversi/releases/tag/v4.6), including its `data/eval.dat` weights. The program and weights are used offline and are not redistributed here.
2. Run `python scripts/reference-games.py /absolute/path/to/edax /absolute/path/to/eval.dat 256`. This uses seed 20260917, 256 legal starting positions, Edax level 12, one search task per process, no opening book, and independent problem batches. Half the starting positions use an XOT opening; all receive 1–24 random legal placements before reference play. Edax's level 12 includes its own phase-dependent endgame depth/selectivity policy; it is not a fixed 12-ply search.
3. Run `node scripts/score-calibration.mjs` to evaluate the sampled positions at levels 1–6 with the browser engine. `CALIBRATION_WORKERS` controls parallel workers, not search results.
4. With NumPy and SciPy installed, run `python scripts/fit-calibration.py`. This writes the browser coefficients and `validation.json`.

`reference-games.json` contains the starting prefixes, all reference continuations, outcomes, sampled boards, seed, and evaluation-weights SHA-256. `scored-positions.json` contains the browser scores used to fit and validate the model. `validation.json` identifies its exact input with a SHA-256 digest. Reproducing from the checked-in scored positions does not require Edax.

The generator and scorer checkpoint long runs. Interrupted generation resumes from `reference-checkpoint.json`; scoring reuses `score-cache.json`. These temporary caches are ignored by git. Remove a cache when changing the reference configuration or search implementation. For a completely new reference run, remove the existing reference data as well.

## Fitting

For each depth independently, set `t = (60 − empty)/60`, `a = exp(a0 + a1*t + a2*t²)`, `b = exp(b0 + b1*t + b2*t²)`, and `sigmoid(x) = 1/(1+exp(-x))`. For Black-perspective search score `s`:

- Black win probability: `sigmoid((s-a)/b)`.
- White win probability: `sigmoid((-s-a)/b)`.
- Draw probability: one minus the two win probabilities.

The positive thresholds and widths give a symmetric three-outcome model. Parameters minimize average three-class negative log likelihood, plus 0.001 times the squared nonconstant coefficients. The bounded L-BFGS-B optimizer starts from three initial points; the training objective selects the best. The same fixed model form and penalty apply at all depths.

Every fifth reference game is held out before fitting; a whole game's samples stay in one partition. Identical board-and-side positions are deduplicated. Solved search results are excluded from fitting and receive exact outcome probabilities at runtime. The holdout metrics therefore describe the more difficult, unsolved cases. The report includes log loss, multiclass Brier score (sum over all three classes), and mean predicted/observed index by band. The baseline uses the training set's unconditional outcome frequencies.

## Interpretation and limitations

Labels are the outcomes of Edax continuations, not proofs of the optimal result of each earlier position. Samples within a game are correlated. The sample includes random mistakes and strong continuations; it is not representative of every player's games. The six models calibrate completed root scores, not static leaf scores. Applying the same conversion to alternative root lines is an approximation; the corpus labels the reference continuation from each position, rather than separately rolling out every candidate first move. This is an initial empirical calibration of a small heuristic, not a general human win-probability model.

The UI rounds the net index to an integer and caps unproven estimates at ±99. Proven wins/losses use ±100 and proven draws use zero. It does not average scores across search depths or moves. A zero index can mean a likely draw or equally likely wins for both sides.

## Sources

- Roemer B. Lievaart, [complete 1987 IOCCC engine](https://github.com/ioccc-src/winner/blob/master/1987/lievaart/lievaart2.c).
- Michael Buro, NEC Research Institute, [“Statistical Feature Combination for the Evaluation of Game Positions”](https://arxiv.org/pdf/cs/9512106), *Journal of Artificial Intelligence Research* 3 (1995), 373–382.
- [Stockfish's outcome model](https://github.com/official-stockfish/WDL_model), consulted September 17, 2026.
- [Edax 4.6](https://github.com/abulmo/edax-reversi), released 2024.
