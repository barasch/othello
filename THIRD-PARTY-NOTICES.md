# Third-party notices

## Lievaart Othello engine

The search engine in `site/js/engine.js` is adapted from Roemer B. Lievaart’s 1987 International Obfuscated C Code Contest entry and its complete companion source, `lievaart2.c`.

- Original author: Roemer B. Lievaart
- Source: <https://www.ioccc.org/1987/lievaart/index.html>
- Source archive: <https://github.com/ioccc-src/winner/tree/master/1987/lievaart>
- License: Creative Commons Attribution-ShareAlike 4.0 International

The JavaScript adaptation is substantially reformatted and adds principal-variation retention, multiple root lines, progressive analysis messages, browser coordinates, and explicit draw handling. Its retained search ideas are described in the project README.

## XOT opening list

The site bundles the large XOT opening list compiled by Matthias Berg and Borja Moreno using Edax and NTest. It contains 10,784 eight-move sequences intended to produce balanced starting positions.

- About and attribution: <https://berg.earthlingz.de/xot/aboutxot.php?lang=en>
- Source file: <https://berg.earthlingz.de/xot/downloads/openingslarge.txt>
- Retrieved: 2026-08-29
- SHA-256: `ccbeb0ed7b7ae23de20013a3992b9a6ede77610bbb5cacda82ccbaedaab72530`

The source site makes the list available for download and use but does not state a separate license for the list. It remains attributed to its creators and source; its inclusion here does not alter any rights they retain.

## ET Book

The site includes the ET Book roman line-figures webfont from Edward Tufte’s ET Book repository.

- Source: <https://github.com/edwardtufte/et-book>
- Copyright © 2015–2016 Edward Tufte and Adam Schwartz
- License: MIT

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Offline calibration references

Edax 4.6 by Richard Delorme and contributors was used offline to generate reference game continuations. The Edax executable and evaluation weights are not included in this repository or downloaded by the browser application. Its source is available at <https://github.com/abulmo/edax-reversi> under GPL-3.0.

The statistical approach is informed by Michael Buro, “Statistical Feature Combination for the Evaluation of Game Positions,” Journal of Artificial Intelligence Research 3 (1995), 373–382, and the documented Stockfish win/draw/loss model at <https://github.com/official-stockfish/WDL_model>. The fitting scripts and coefficients here are specific to this project's independently generated reference data.
