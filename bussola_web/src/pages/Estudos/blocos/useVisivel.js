import { useEffect, useState } from 'react';

const SUPORTA = typeof window !== 'undefined' && 'IntersectionObserver' in window;

// true quando o elemento chega perto da viewport (uma vez). Fórmulas e diagramas só renderizam
// a partir daí — material de 200 blocos não paga KaTeX/Mermaid de tudo de uma vez.
export function useVisivel(ref, margem = '600px') {
    const [visivel, setVisivel] = useState(!SUPORTA);
    useEffect(() => {
        if (visivel || !ref.current) return undefined;
        const observador = new IntersectionObserver((entradas) => {
            if (entradas.some((e) => e.isIntersecting)) {
                setVisivel(true);
                observador.disconnect();
            }
        }, { rootMargin: margem });
        observador.observe(ref.current);
        return () => observador.disconnect();
    }, [ref, visivel, margem]);
    return visivel;
}
