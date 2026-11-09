const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
let inline = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/\bsrc\s*=/.test(match[1]) || /type\s*=\s*["']application\//.test(match[1])) continue;
  new vm.Script(match[2], { filename: `index.html:inline-${++inline}` });
}
const scripts = walk('public/js').filter(n => n.endsWith('.js'));
for (const name of scripts) new vm.Script(fs.readFileSync(name, 'utf8'), { filename: name });
for (const match of html.matchAll(/(?:src|href)="(\/(?:js|css)\/[^"?]+)(?:\?[^"\s]*)?"/g)) if (!fs.existsSync('public' + match[1])) throw new Error('Missing local asset: ' + match[1]);
console.log(`Parsed ${scripts.length} JavaScript files and ${inline} inline blocks; local assets exist.`);
