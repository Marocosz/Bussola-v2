import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { lockScroll, unlockScroll } from '../utils/scrollLock';
import { useSheetHistory } from '../hooks/useSheetHistory';

/**
 * Overlay base de todos os modais. No mobile (≤768) vira bottom sheet:
 * `sheet="auto"` (padrão) ancora no rodapé; `sheet="full"` ocupa a tela;
 * `sheet={false}` mantém o modal centralizado também no celular.
 */
export function BaseModal({ children, onClose, className = '', sheet = 'auto' }) {
    const mouseDownTarget = useRef(null);
    const isMobile = useIsMobile();
    // Celular: o Voltar (Android/navegador) fecha o modal/sheet de cima.
    useSheetHistory(isMobile, onClose);

    useEffect(() => {
        lockScroll();
        return unlockScroll;
    }, []);

    // Fecha com ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleOverlayClick = useCallback((e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
    }, [onClose]);

    const handleMouseDown = useCallback((e) => {
        mouseDownTarget.current = e.target;
    }, []);

    const sheetClass = isMobile && sheet ? `is-sheet${sheet === 'full' ? ' is-sheet-full' : ''}` : '';

    return (
        <div
            className={`modal-overlay ${className} ${sheetClass}`}
            onMouseDown={handleMouseDown}
            onClick={handleOverlayClick}
            style={{ display: 'flex' }}
        >
            {children}
        </div>
    );
}