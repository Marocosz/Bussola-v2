// Lista regras de um CSS cujas classes NÃO aparecem em nenhum .js/.jsx/.ts/.tsx de src/.
// Uso: node scripts/find-unused-css.mjs src/pages/Registros/styles.css
// Conservador: uma classe conta como usada se aparecer como palavra no código, ou se
// algum prefixo "xxx-" dela aparecer seguido de "${" (classe montada dinamicamente).
import fs from 'node:fs';
import path from 'node:path';

const cssFile = process.argv[2];
if (!cssFile) { console.error('uso: node scripts/find-unused-css.mjs <arquivo.css>'); process.exit(1); }

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
});
const source = walk('src').map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const used = (cls) => {
  if (new RegExp(`(^|[^\\w-])${cls.replace(/[-]/g, '\\-')}($|[^\\w-])`).test(source)) return true;
  for (let i = cls.indexOf('-'); i !== -1; i = cls.indexOf('-', i + 1)) {
    if (source.includes(cls.slice(0, i + 1) + '${')) return true;
  }
  return false;
};

const css = fs.readFileSync(cssFile, 'utf8');
const lines = css.split('\n');
const re = /([^{}]+)\{/g;
let m;
const dead = [];
while ((m = re.exec(css))) {
  const selector = m[1].trim();
  if (selector.startsWith('@') || /^(from|to|\d+%)$/.test(selector)) continue;
  const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((x) => x[1]);
  if (!classes.length) continue;
  // morta se cada seletor da lista (separada por vírgula) tem ao menos uma classe não usada
  const parts = selector.split(',');
  const allPartsDead = parts.every((part) => [...part.matchAll(/\.([a-zA-Z_][\w-]*)/g)].some((x) => !used(x[1])));
  if (allPartsDead) {
    const line = css.slice(0, m.index).split('\n').length;
    dead.push(`${String(line).padStart(5)}  ${selector.replace(/\s+/g, ' ').slice(0, 110)}`);
  }
}
console.log(dead.length ? dead.join('\n') : '(nenhuma regra morta)');
console.log(`\n${dead.length} regra(s) candidata(s) em ${cssFile} (${lines.length} linhas)`);
