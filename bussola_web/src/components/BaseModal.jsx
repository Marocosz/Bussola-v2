import { useEffect, useRef, useCallback } from 'react';

export function BaseModal({ children, onClose, className = '' }) {
    const mouseDownTarget = useRef(null);

    // Trava o scroll do body ao abrir
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
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

    return (
        <div
            className={`modal-overlay ${className}`}
            onMouseDown={handleMouseDown}
            onClick={handleOverlayClick}
            style={{ display: 'flex' }}
        >
            {children}
        </div>
    );
}
