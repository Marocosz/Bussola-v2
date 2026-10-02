import { createContext, useContext, useState } from 'react';
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
