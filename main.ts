// Sunset Shores — the hand-in program for the gta6-01 entry (Node 22,
// standard library only).
//
// The game is plain static files under game/ (index.html plus ES modules,
// three.js vendored as a minified file) and the screenshots live in
// screenshots/. This program copies both folders next to this file into the
// output directory — /output on the grader, or $MAKEFUN_OUTPUT_DIR when set
// locally — and writes /output/dossier.json, the summary the judge reads,
// using the kit's vendored buildDossier helper.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game for play with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's gate (see the kit's RULES.txt): at most four
// screenshots of 256 KiB each, at most 993 files and 48 MiB under game/,
// paths under 1,000 bytes — game/, screenshots/ and dossier.json share the
// platform's own 1,000-entry / 64 MiB output cap, so the dossier text is
// capped at 160 KiB to leave them room.
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
