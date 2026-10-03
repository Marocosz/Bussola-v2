import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const MobileChromeContext = createContext({ slotEl: null, setSlotEl: () => {} });

/** Guarda o nó do slot de ações da topbar mobile (preenchido via callback ref). */
export function MobileChromeProvider({ children }) {
    const [slotEl, setSlotEl] = useState(null);
    return (
        <MobileChromeContext.Provider value={{ slotEl, setSlotEl }}>
            {children}
        </MobileChromeContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMobileChrome() {
    return useContext(MobileChromeContext);
}

/** Ícones extras da página na topbar mobile (ex.: calendário no Roteiro). */
export function TopbarActions({ children }) {
    const { slotEl } = useMobileChrome();
    return slotEl ? createPortal(children, slotEl) : null;
}

// ---- Título próprio + Voltar das sub-rotas (ex.: /estudos/kit, /estudos/:id) ----
// Store mínimo fora do React: a página declara <TopbarTitle/>, a topbar (no Navbar) lê com
// useTopbarOverride(). Sem setState dentro de efeito e sem re-render da árvore inteira.
let topbarAtual = null;
const ouvintesTopbar = new Set();

function definirTopbar(valor) {
    topbarAtual = valor;
    ouvintesTopbar.forEach((avisar) => avisar());
}

function assinarTopbar(avisar) {
    ouvintesTopbar.add(avisar);
    return () => { ouvintesTopbar.delete(avisar); };
}

const lerTopbar = () => topbarAtual;

/** `{ title, backTo }` declarado pela página atual, ou `null` (título do módulo, sem Voltar). */
// eslint-disable-next-line react-refresh/only-export-components
export function useTopbarOverride() {
    return useSyncExternalStore(assinarTopbar, lerTopbar, () => null);
}

/**
 * Sub-rota com título próprio e botão Voltar na topbar do celular. `backTo` é o destino do
 * Voltar quando não há página anterior do app no histórico (link direto). Não renderiza nada.
 * useLayoutEffect: o título certo já aparece no primeiro quadro (sem piscar "Estudos").
 */
export function TopbarTitle({ title, backTo }) {
    useLayoutEffect(() => {
        const entrada = { title, backTo };
        definirTopbar(entrada);
        return () => {
            if (topbarAtual === entrada) definirTopbar(null);
        };
    }, [title, backTo]);
    return null;
}
