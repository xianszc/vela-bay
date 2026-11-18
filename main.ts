// Vela Bay — Sunset Heist. The entry program for make.fun's "Make GTA 6"
// bounty (gta6-01). Node 22, standard library only. It gathers the game
// (game/ — static files a desktop browser loads with no network) and the
// four screenshots (screenshots/), copies them into the grader's output
// directory, and writes dossier.json — the summary the judge reads —
// through the vendored make.fun helper.
//
// To reproduce the grader's run locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// then serve the result:  node serve.ts   (http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps — four screenshots at most, each at most 256 KiB;
// game/ at most 993 files and 48 MiB in total, no path longer than 1000
// bytes; the dossier text at most 160 KiB. An entry over a cap is refused
// outright, so the build fails here first, loudly, instead of at grading.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
