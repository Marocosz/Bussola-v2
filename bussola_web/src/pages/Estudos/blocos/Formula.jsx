import { useEffect, useRef, useState } from 'react';
import { AvisoRender } from './AvisoRender';
import { useVisivel } from './useVisivel';

let katexPromessa = null;
function carregarKatex() {
    if (!katexPromessa) {
        katexPromessa = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([modulo]) => modulo.default);
    }
    return katexPromessa;
}

export function Formula({ bloco }) {
    const ref = useRef(null);
    const visivel = useVisivel(ref);
    const [res, setRes] = useState({ fonte: null, html: '', erro: '' });

    useEffect(() => {
        if (!visivel) return undefined;
        let ativo = true;
        carregarKatex()
            .then((katex) => {
                if (!ativo) return;
                try {
                    const html = katex.renderToString(bloco.latex, {
                        displayMode: true,
                        throwOnError: true,
                        trust: false,       // bloqueia \href, \url, \includegraphics, \html*
                        strict: 'ignore',
                        maxExpand: 500,
                        maxSize: 20,
                    });
                    setRes({ fonte: bloco.latex, html, erro: '' });
                } catch (e) {
                    setRes({ fonte: bloco.latex, html: '', erro: String(e?.message || e).slice(0, 300) });
                }
            })
            .catch(() => {
                if (ativo) setRes({ fonte: bloco.latex, html: '', erro: 'Não foi possível carregar o renderizador de fórmulas.' });
            });
        return () => { ativo = false; };
    }, [visivel, bloco.latex]);

    const pronto = res.fonte === bloco.latex;
    return (
        <figure className="bloco-formula" ref={ref}>
            {!pronto && <div className="bloco-carregando"><code>{bloco.latex}</code></div>}
            {pronto && res.erro && <AvisoRender titulo="Não foi possível exibir a fórmula" detalhe={res.erro} fonte={bloco.latex} />}
            {pronto && !res.erro && (
                // Exceção documentada: HTML gerado pelo KaTeX (texto escapado pela lib, trust:false).
                <div className="bloco-formula-render" dangerouslySetInnerHTML={{ __html: res.html }} />
            )}
            {bloco.legenda && <figcaption>{bloco.legenda}</figcaption>}
        </figure>
    );
}
