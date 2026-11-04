// Lists every file in each robot model folder so the browser knows what to
// fetch into MuJoCo's virtual file system. Run: npm run manifest
import fs from 'node:fs';
import path from 'node:path';

const modelsDir = path.resolve('public/models');

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, base);
    if (!/\.(xml|stl|obj|png)$/i.test(e.name)) return [];
    if (e.name.endsWith('.png') && !full.includes('assets')) return []; // skip preview images
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

for (const robot of fs.readdirSync(modelsDir)) {
  const dir = path.join(modelsDir, robot);
  if (!fs.statSync(dir).isDirectory()) continue;
  const files = walk(dir).filter((f) => f !== 'manifest.json');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ files }, null, 2) + '\n');
  console.log(`${robot}: ${files.length} files`);
}
