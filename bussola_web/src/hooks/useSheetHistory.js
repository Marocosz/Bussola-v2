import { useEffect, useRef } from 'react';
import { registrarSheet } from '../utils/sheetHistory';

/** Enquanto `ativo`, o Voltar do navegador/Android fecha este modal/sheet (chama `onClose`). */
export function useSheetHistory(ativo, onClose) {
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });
    useEffect(() => {
        if (!ativo) return undefined;
        return registrarSheet(() => onCloseRef.current());
    }, [ativo]);
}
