// Checagens rápidas das partes puras do módulo Estudos (sem test runner no frontend).
// Rodar em bussola_web/:  node scripts/verificar-estudos.mjs
import assert from 'node:assert/strict';
import { parseInline, paragrafos } from '../src/pages/Estudos/blocos/inline.js';

assert.deepEqual(parseInline('a [1] b'), [{ t: 'texto', v: 'a ' }, { t: 'citacao', n: 1 }, { t: 'texto', v: ' b' }]);
assert.deepEqual(parseInline('`[2]` \\[3] [x] [1234]'), [{ t: 'codigo', v: '[2]' }, { t: 'texto', v: ' [3] [x] [1234]' }]);
assert.deepEqual(parseInline('2 * 3 * 4'), [{ t: 'texto', v: '2 * 3 * 4' }]);
assert.deepEqual(parseInline('**a *b* [4]**'), [{ t: 'negrito', filhos: [
  { t: 'texto', v: 'a ' }, { t: 'italico', filhos: [{ t: 'texto', v: 'b' }] }, { t: 'texto', v: ' ' }, { t: 'citacao', n: 4 },
] }]);
assert.deepEqual(parseInline('**sem fim'), [{ t: 'texto', v: '**sem fim' }]);
assert.deepEqual(parseInline('*a **b** c*'), [{ t: 'italico', filhos: [{ t: 'texto', v: 'a **b** c' }] }]);
assert.deepEqual(parseInline('<b>x</b>'), [{ t: 'texto', v: '<b>x</b>' }]);
assert.deepEqual(parseInline('crase `sem par [2]'), [{ t: 'texto', v: 'crase `sem par ' }, { t: 'citacao', n: 2 }]);
assert.deepEqual(parseInline('l1\nl2'), [{ t: 'texto', v: 'l1' }, { t: 'quebra' }, { t: 'texto', v: 'l2' }]);
assert.deepEqual(paragrafos('a\n\n\nb\n\n  \n\nc'), ['a', 'b', 'c']);
console.log('inline ok');

import { montarComando } from '../src/pages/Estudos/comandos.js';

assert.equal(montarComando({ destino: 'claude-code', acao: 'aprofundar', materialId: 12, blocoId: 'b7' }),
  '/estudos aprofundar material:12 bloco:b7');
assert.equal(montarComando({ destino: 'claude-code', acao: 'fontes', materialId: 12 }), '/estudos fontes material:12');
assert.equal(montarComando({ destino: 'claude-ai', acao: 'aprofundar', materialId: 12, blocoId: 'b7' }),
  'Use a skill estudos para aprofundar o bloco b7 do material 12 no Bússola.');
assert.equal(montarComando({ destino: 'claude-ai', acao: 'comparativo', materialId: 3 }),
  'Use a skill estudos para criar um comparativo relacionado ao material 3 no Bússola.');
assert.equal(montarComando({ destino: 'claude-code', acao: 'duvida', materialId: 3, blocoId: 'b2', pergunta: ' por que  "x"?\n' }),
  `/estudos duvida material:3 bloco:b2 "por que 'x'?"`);
console.log('comandos ok');
