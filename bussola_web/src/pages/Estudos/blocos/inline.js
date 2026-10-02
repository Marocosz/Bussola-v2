/**
 * Gramática da formatação inline dos materiais de Estudos.
 * Espelhada no backend em bussola_api/app/schemas/estudos_blocos.py::citacoes — mudou aqui, mude lá.
 *
 *  - parágrafos separados por linha em branco (\n{2,}); nenhuma marca atravessa parágrafos
 *  - \x escapa x ∈ \ * ` [ ]  (barra antes de outro caractere é literal)
 *  - `código` literal (crase sem par é literal; `` vazio não gera nada)
 *  - [n] = citação (1 a 3 dígitos)
 *  - **negrito** / *itálico* com regra de flanco: abertura seguida de não-espaço, fechamento
 *    precedido de não-espaço; sem fechamento a marca é literal; itálico pode ficar dentro de
 *    negrito, negrito dentro de itálico é literal
 *  - \n dentro do parágrafo = quebra de linha
 * Nunca produz HTML: devolve tokens.
 */
const ESCAPAVEIS = '\\*`[]';
const RE_CITACAO = /^\[(\d{1,3})\]/;
const RE_PARAGRAFO = /\n{2,}/;
const ESPACO = /\s/;

export function paragrafos(texto) {
    return String(texto ?? '').split(RE_PARAGRAFO).filter((p) => p.trim().length > 0);
}

// Posição do próximo fechamento `marca` a partir de `desde` (pula escapes e trechos de código).
function fechamento(texto, desde, marca) {
    let j = desde;
    while (j < texto.length) {
        const c = texto[j];
        if (c === '\\' && j + 1 < texto.length && ESCAPAVEIS.includes(texto[j + 1])) {
            j += 2;
            continue;
        }
        if (c === '`') {
            const fim = texto.indexOf('`', j + 1);
            if (fim !== -1) {
                j = fim + 1;
                continue;
            }
        }
        if (marca === '*' && texto.startsWith('**', j)) {
            j += 2; // dentro de itálico, ** nunca fecha nem abre nada
            continue;
        }
        if (texto.startsWith(marca, j) && j > desde && !ESPACO.test(texto[j - 1])) {
            return j;
        }
        j += 1;
    }
    return -1;
}

export function parseInline(texto, { negrito = true, italico = true } = {}) {
    const tokens = [];
    let buffer = '';
    const soltar = () => {
        if (buffer) {
            tokens.push({ t: 'texto', v: buffer });
            buffer = '';
        }
    };
    let i = 0;
    while (i < texto.length) {
        const c = texto[i];
        const prox = texto[i + 1];

        if (c === '\\' && prox !== undefined && ESCAPAVEIS.includes(prox)) {
            buffer += prox;
            i += 2;
            continue;
        }
        if (c === '\n') {
            soltar();
            tokens.push({ t: 'quebra' });
            i += 1;
            continue;
        }
        if (c === '`') {
            const fim = texto.indexOf('`', i + 1);
            if (fim !== -1) {
                soltar();
                if (fim > i + 1) tokens.push({ t: 'codigo', v: texto.slice(i + 1, fim) });
                i = fim + 1;
                continue;
            }
        }
        if (c === '[') {
            const m = RE_CITACAO.exec(texto.slice(i, i + 5));
            if (m) {
                soltar();
                tokens.push({ t: 'citacao', n: Number(m[1]) });
                i += m[0].length;
                continue;
            }
        }
        if (c === '*' && prox === '*') {
            const depois = texto[i + 2];
            if (negrito && depois !== undefined && !ESPACO.test(depois)) {
                const fim = fechamento(texto, i + 2, '**');
                if (fim !== -1) {
                    soltar();
                    tokens.push({ t: 'negrito', filhos: parseInline(texto.slice(i + 2, fim), { negrito: false, italico: true }) });
                    i = fim + 2;
                    continue;
                }
            }
            buffer += '**';
            i += 2;
            continue;
        }
        if (c === '*' && italico && prox !== undefined && !ESPACO.test(prox)) {
            const fim = fechamento(texto, i + 1, '*');
            if (fim !== -1) {
                soltar();
                tokens.push({ t: 'italico', filhos: parseInline(texto.slice(i + 1, fim), { negrito: false, italico: false }) });
                i = fim + 1;
                continue;
            }
        }
        buffer += c;
        i += 1;
    }
    soltar();
    return tokens;
}
