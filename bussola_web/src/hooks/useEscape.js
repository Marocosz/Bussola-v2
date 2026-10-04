import { useEffect, useRef } from 'react';
import { registrarEsc } from '../utils/escStack';

/** Enquanto `ativo`, o ESC chama `onEscape` — só se esta for a camada aberta mais recente. */
export function useEscape(ativo, onEscape) {
    const ref = useRef(onEscape);
    useEffect(() => { ref.current = onEscape; });
    useEffect(() => {
        if (!ativo) return undefined;
        return registrarEsc((e) => ref.current(e));
    }, [ativo]);
}
