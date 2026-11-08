const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/\bsrc\s*=/.test(match[1])) continue;
  if (/type\s*=\s*["']application\//.test(match[1])) continue;
  new vm.Script(match[2], { filename: `index.html:inline-${++count}` });
}
for (const name of fs.readdirSync('public/js').filter(n => n.endsWith('.js'))) new vm.Script(fs.readFileSync('public/js/' + name, 'utf8'), { filename: name });
for (const match of html.matchAll(/(?:src|href)="(\/(?:js|css)\/[^"?]+)(?:\?[^"\s]*)?"/g)) if (!fs.existsSync('public' + match[1])) throw new Error('Missing local asset: ' + match[1]);
console.log(`Parsed ${count} inline scripts and all public/js modules; local assets exist.`);
