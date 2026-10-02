import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MEDIA_MOBILE = '(max-width: 768px)';
const ATRASO_FECHAR_MS = 150;   // tempo para o mouse atravessar o vão entre linha e balão
const ESPACO_MINIMO_ABAIXO = 70;

function useEhMobile() {
    const [mobile, setMobile] = useState(() => window.matchMedia(MEDIA_MOBILE).matches);
    useEffect(() => {
        const mq = window.matchMedia(MEDIA_MOBILE);
        const aoMudar = (e) => setMobile(e.matches);
        mq.addEventListener('change', aoMudar);
        return () => mq.removeEventListener('change', aoMudar);
    }, []);
    return mobile;
}

/**
 * Ações de uma linha da tabela.
 * Desktop: balão flutuante (portal no body, position fixed) que aparece no hover da linha
 * e fica aberto enquanto o mouse estiver na linha ou no balão.
 * Celular: sem hover — ações inline, sempre visíveis.
 *
 * Uso: const { linhaProps, renderAcoes } = useAcoesDaLinha();
 *      <div {...linhaProps}> ... {renderAcoes(<>botões</>)} </div>
 */
export function useAcoesDaLinha() {
    const linhaRef = useRef(null);
    const timerRef = useRef(null);
    const [posicao, setPosicao] = useState(null); // null = fechado
    const mobile = useEhMobile();

    const fecharJa = useCallback(() => {
        clearTimeout(timerRef.current);
        setPosicao(null);
    }, []);

    const abrir = () => {
        if (mobile || !linhaRef.current) return;
        clearTimeout(timerRef.current);
        const r = linhaRef.current.getBoundingClientRect();
        const abaixo = window.innerHeight - r.bottom > ESPACO_MINIMO_ABAIXO;
        setPosicao({ top: abaixo ? r.bottom : r.top, right: window.innerWidth - r.right + 12, abaixo });
    };

    const fechar = () => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setPosicao(null), ATRASO_FECHAR_MS);
    };

    // Posição é fixa na tela: ao rolar ou redimensionar, o balão se desprenderia da linha.
    useEffect(() => {
        if (!posicao) return undefined;
        window.addEventListener('scroll', fecharJa, true);
        window.addEventListener('resize', fecharJa);
        return () => {
            window.removeEventListener('scroll', fecharJa, true);
            window.removeEventListener('resize', fecharJa);
        };
    }, [posicao, fecharJa]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const linhaProps = { ref: linhaRef, onMouseEnter: abrir, onMouseLeave: fechar };

    const renderAcoes = (conteudo) => {
        if (mobile) {
            return (
                <div className="row-actions">
                    <div className="row-actions-inner">{conteudo}</div>
                </div>
            );
        }
        if (!posicao) return null;
        // financas-scope: o balão vive no body, fora da página, e precisa dos estilos escopados dos botões.
        return createPortal(
            <div
                className={`financas-scope row-actions-popover ${posicao.abaixo ? 'abaixo' : 'acima'}`}
                style={{ top: posicao.top, right: posicao.right }}
                onMouseEnter={abrir}
                onMouseLeave={fechar}
                onClickCapture={fecharJa}
            >
                <div className="row-actions-inner">{conteudo}</div>
            </div>,
            document.body
        );
    };

    return { linhaProps, renderAcoes };
}
