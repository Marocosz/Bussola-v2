import { Fragment, useContext, useMemo } from 'react';
import { paragrafos, parseInline } from './inline';
import { EstudoContexto } from './contexto';

function irParaFonte(n) {
    const alvo = document.getElementById(`estudo-fonte-${n}`);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alvo.classList.add('estudo-fonte-destaque');
    window.setTimeout(() => alvo.classList.remove('estudo-fonte-destaque'), 1600);
}

function renderizar(tokens, totalFontes, prefixo) {
    return tokens.map((tk, i) => {
        const chave = `${prefixo}${i}`;
        if (tk.t === 'texto') return <Fragment key={chave}>{tk.v}</Fragment>;
        if (tk.t === 'quebra') return <br key={chave} />;
        if (tk.t === 'codigo') return <code key={chave} className="estudo-inline-code">{tk.v}</code>;
        if (tk.t === 'negrito') return <strong key={chave}>{renderizar(tk.filhos, totalFontes, `${chave}.`)}</strong>;
        if (tk.t === 'italico') return <em key={chave}>{renderizar(tk.filhos, totalFontes, `${chave}.`)}</em>;
        if (tk.t === 'citacao') {
            if (tk.n >= 1 && tk.n <= totalFontes) {
                return (
                    <sup key={chave} className="estudo-citacao">
                        <button type="button" onClick={() => irParaFonte(tk.n)} title={`Ver a fonte ${tk.n}`}>
                            [{tk.n}]
                        </button>
                    </sup>
                );
            }
            return <span key={chave} className="estudo-citacao-orfa">[{tk.n}]</span>;
        }
        return null;
    });
}

// Interpreta a formatação inline (inline.js) gerando elementos React — nunca HTML.
// Parágrafos (linha em branco) ficam separados por um respiro vertical.
export function TextoInline({ texto }) {
    const { totalFontes } = useContext(EstudoContexto);
    const partes = useMemo(() => paragrafos(texto).map((p) => parseInline(p)), [texto]);
    return partes.map((tokens, i) => (
        <Fragment key={i}>
            {i > 0 && <span className="estudo-paragrafo-quebra" aria-hidden="true" />}
            {renderizar(tokens, totalFontes, `${i}:`)}
        </Fragment>
    ));
}
