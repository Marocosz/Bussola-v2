import { useEffect, useLayoutEffect, useRef, useCallback, useState, useId } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { lockScroll, unlockScroll } from '../utils/scrollLock';
import { useSheetHistory } from '../hooks/useSheetHistory';
import { useEscape } from '../hooks/useEscape';

const CAMPO_DE_TEXTO = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';
const toque = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

/**
 * Overlay base de todos os modais. No mobile (≤768) vira bottom sheet:
 * `sheet="auto"` (padrão) ancora no rodapé; `sheet="full"` ocupa a tela;
 * `sheet={false}` mantém o modal centralizado também no celular.
 * `onBack` (opcional, padrão `onClose`): o que o Voltar do celular e o ESC chamam — ex.: uma checagem
 * de alterações não salvas. Devolver false (ou promessa de false) mantém o modal com entrada de Voltar.
 *
 * ESC: só a camada aberta mais recente (modal, sheet, confirmação, picker) fecha — ver escStack.js.
 * Foco: ao abrir, se nada dentro já tem foco (ex.: um autoFocus do formulário no desktop), vai para o
 * próprio diálogo (tabIndex -1), nunca para um campo — no toque isso abriria o teclado. Ao fechar,
 * volta para quem tinha o foco antes (no toque, não volta para um campo de texto).
 */
export function BaseModal({ children, onClose, onBack, className = '', sheet = 'auto' }) {
    const mouseDownTarget = useRef(null);
    const overlayRef = useRef(null);
    // Quem tinha o foco ao abrir: lido no 1º render, antes de qualquer autoFocus dos filhos (que roda no commit).
    const [anterior] = useState(() => document.activeElement);
    const idTitulo = useId();
    const focoInicial = useRef(null);
    const isMobile = useIsMobile();
    const pedirFechar = onBack ?? onClose;
    // Celular: o Voltar (Android/navegador) fecha o modal/sheet de cima.
    useSheetHistory(isMobile, pedirFechar);
    useEscape(true, pedirFechar);

    useEffect(() => {
        lockScroll();
        return unlockScroll;
    }, []);

    // Foco para dentro ao abrir e de volta ao fechar. Layout effect: roda antes da pintura, depois dos
    // autoFocus/efeitos de layout dos filhos (que, se já focaram algo dentro, são respeitados).
    useLayoutEffect(() => {
        const overlay = overlayRef.current;
        // Diálogo sem papel próprio (modais simples) ganha role/aria-modal e nome pelo título.
        const dialogo = overlay?.querySelector('[role="dialog"], .modal-content');
        if (dialogo && !dialogo.hasAttribute('role')) {
            dialogo.setAttribute('role', 'dialog');
            dialogo.setAttribute('aria-modal', 'true');
            const titulo = dialogo.querySelector('h1, h2, h3');
            if (titulo && !dialogo.hasAttribute('aria-label') && !dialogo.hasAttribute('aria-labelledby')) {
                if (!titulo.id) titulo.id = `${idTitulo}-t`;
                dialogo.setAttribute('aria-labelledby', titulo.id);
            }
        }
        if (overlay && overlay.contains(document.activeElement)) {
            focoInicial.current = document.activeElement;
        } else if (overlay && focoInicial.current?.isConnected && overlay.contains(focoInicial.current)) {
            // Remontagem simulada do StrictMode: o cleanup devolveu o foco ao opener; refaz o autoFocus.
            focoInicial.current.focus({ preventScroll: true });
        } else if (overlay) {
            const alvo = dialogo || overlay.firstElementChild || overlay;
            if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
            alvo.setAttribute('data-foco-modal', '');
            alvo.focus({ preventScroll: true });
        }
        return () => {
            if (!anterior || anterior === document.body || !anterior.isConnected) return;
            if (toque() && anterior.matches?.(CAMPO_DE_TEXTO)) return;
            // Só devolve se o foco ficou "solto" (no body ou dentro deste modal que está saindo).
            const atual = document.activeElement;
            if (atual && atual !== document.body && !overlay?.contains(atual)) return;
            anterior.focus({ preventScroll: true });
        };
    }, [anterior, idTitulo]);

    const handleOverlayClick = useCallback((e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
    }, [onClose]);

    const handleMouseDown = useCallback((e) => {
        mouseDownTarget.current = e.target;
    }, []);

    const sheetClass = isMobile && sheet ? `is-sheet${sheet === 'full' ? ' is-sheet-full' : ''}` : '';

    return (
        <div
            ref={overlayRef}
            className={`modal-overlay ${className} ${sheetClass}`}
            onMouseDown={handleMouseDown}
            onClick={handleOverlayClick}
            style={{ display: 'flex' }}
        >
            {children}
        </div>
    );
}
