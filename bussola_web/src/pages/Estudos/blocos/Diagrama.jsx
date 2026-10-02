import { useEffect, useId, useRef, useState } from 'react';
import { AvisoRender } from './AvisoRender';
import { useVisivel } from './useVisivel';

let mermaidPromessa = null;
function carregarMermaid() {
    if (!mermaidPromessa) mermaidPromessa = import('mermaid').then((modulo) => modulo.default);
    return mermaidPromessa;
}

// mermaid.render não é reentrante: renderizações em fila, uma por vez.
let fila = Promise.resolve();
function renderizar(id, codigo, escuro) {
    const tarefa = fila.then(async () => {
        const mermaid = await carregarMermaid();
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: escuro ? 'dark' : 'default' });
        try {
            await mermaid.parse(codigo);
            const { svg } = await mermaid.render(id, codigo);
            return svg;
        } finally {
            // Em erro o Mermaid pode deixar o contêiner temporário no <body>.
            document.getElementById(`d${id}`)?.remove();
            document.getElementById(id)?.remove();
        }
    });
    fila = tarefa.catch(() => undefined);
    return tarefa;
}

export function Diagrama({ bloco }) {
    const ref = useRef(null);
    const visivel = useVisivel(ref);
    const idBase = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [res, setRes] = useState({ fonte: null, svg: '', erro: '' });

    useEffect(() => {
        if (!visivel) return undefined;
        let ativo = true;
        const escuro = !document.body.classList.contains('light-theme');
        renderizar(`mmd${idBase}`, bloco.mermaid, escuro)
            .then((svg) => { if (ativo) setRes({ fonte: bloco.mermaid, svg, erro: '' }); })
            .catch((e) => {
                if (ativo) setRes({ fonte: bloco.mermaid, svg: '', erro: String(e?.message || e).slice(0, 300) });
            });
        return () => { ativo = false; };
    }, [visivel, bloco.mermaid, idBase]);

    const pronto = res.fonte === bloco.mermaid;
    return (
        <figure className="bloco-diagrama" ref={ref}>
            {!pronto && <div className="bloco-carregando"><i className="fa-solid fa-diagram-project"></i> Carregando diagrama…</div>}
            {pronto && res.erro && <AvisoRender titulo="Não foi possível exibir o diagrama" detalhe={res.erro} fonte={bloco.mermaid} />}
            {pronto && !res.erro && (
                // Exceção documentada: SVG do mermaid.render com securityLevel 'strict' (sanitizado pela lib).
                <div className="bloco-diagrama-render" dangerouslySetInnerHTML={{ __html: res.svg }} />
            )}
            {bloco.legenda && <figcaption>{bloco.legenda}</figcaption>}
        </figure>
    );
}
