/* eslint-disable no-console */
// Launch guard: lists the facts the owner still has to supply (scripts/launch-facts.json) and the
// `// OWNER:` markers left in the content files. It never fails the build, unless LAUNCH_STRICT=1.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { facts } = JSON.parse(fs.readFileSync(path.join(root, 'scripts/launch-facts.json'), 'utf8'));
const open = facts.filter((f) => !f.confirmed);

const markers = [];
const contentDir = path.join(root, 'src/content');
fs.readdirSync(contentDir).filter((f) => f.endsWith('.ts')).forEach((file) => {
  fs.readFileSync(path.join(contentDir, file), 'utf8').split('\n').forEach((line, i) => {
    const at = line.indexOf('OWNER:');
    if (at >= 0) markers.push(`src/content/${file}:${i + 1} ${line.slice(at).trim()}`);
  });
});

if (!open.length && !markers.length) {
  console.log('launch guard: nothing left for the owner to supply.');
  process.exit(0);
}
console.warn(`launch guard: ${open.length} fact(s) to confirm, ${markers.length} OWNER marker(s) in the content files.`);
open.forEach((f) => console.warn(`  - [${f.id}] ${f.what}`));
markers.forEach((m) => console.warn(`  - ${m}`));
if (process.env.LAUNCH_STRICT === '1') {
  console.error('launch guard: LAUNCH_STRICT=1, failing the build.');
  process.exit(1);
}
