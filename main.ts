// Vela Bay — Sunset Heist, the entry program for make.fun's gta6-01.
// Runs on Node 22 with the standard library only. It takes the finished
// game (game/, plain static files a desktop browser loads offline) and the
// four screenshots (screenshots/), copies both into the grader's output
// directory, and writes dossier.json — the summary the judge reads — with
// the vendored make.fun library. The game itself is three.js (vendored
// under game/vendor) plus the source files under game/src/.
//
// Run it locally the same way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the result with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: four screenshots at most, each at most 256 KiB; game/
// at most 993 files and 48 MiB in all, no path over 1000 bytes; the dossier
// text at most 160 KiB. An entry over a cap is refused, so the build fails
// here first, loudly, instead of at grading time.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
