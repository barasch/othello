# Othello

A small browser Othello game and analysis surface. It uses an 8×8 lattice rather than a rendered board, a device-local game record, and a computer player adapted from Roemer B. Lievaart’s 1987 IOCCC entry.

The Play screen supports computer levels 1–10 and lets the player choose Black, White, or a random color. A game can use the standard position or begin from a randomly selected XOT eight-move opening. Analysis can step through recorded and hypothetical lines, branch from earlier positions, show up to three principal variations, and calculate progressively through level 6 in this first build.

## Run locally

No runtime packages or build framework are required. Use any static server:

```bash
python3 -m http.server 8000 --directory site
```

Then open `http://localhost:8000`.

## Check and build

Node.js 22 or later is used only for checks and the deployment copy step.

```bash
npm test
npm run check
npm run build
```

The production copy is written to `dist/`. A GitHub Actions workflow publishes it to GitHub Pages when `main` changes.

## Engine

`site/js/engine.js` is a readable JavaScript adaptation of Roemer B. Lievaart’s [1987 IOCCC Othello entry](https://www.ioccc.org/1987/lievaart/index.html), principally the complete `lievaart2.c` version. It retains the 10×10 sentinel representation, alpha–beta negamax search, corner and near-corner weights, mobility term, terminal disc differential, and the original 0–10 search scale. The browser game presents levels 1–10.

The adaptation adds a principal-variation table, full root scoring for multiple calculated lines, progressive worker-based analysis, reliable draw scoring, and ordinary browser game records. Calculations run in a Web Worker so the interface remains responsive.

## Storage and privacy

Settings, completed games, and analysis branches are stored only in the browser’s local storage. The site has no backend, account, analytics, cookies, advertising, or third-party requests. The bundled XOT list is loaded from the same site only when an XOT game starts.

## License and notices

The project is licensed under [CC BY-SA 4.0](LICENSE). See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for engine and font attribution.

Othello is a trademark of Othello Co. and MegaHouse. This independent project is not affiliated with or endorsed by them.
