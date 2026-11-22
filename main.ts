import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';

mkdirSync(out, { recursive: true });
cpSync('game', join(out, 'game'), { recursive: true });
cpSync('screenshots', join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`hand-in written to ${out}/`);
console.log(`  dossier.json: ${dossier.length} bytes`);
