import { createPortal } from 'react-dom';

/** Botão "+" da página (só aparece ≤768; no desktop as páginas mantêm seus botões). */
export function Fab({ icon = 'fa-plus', label, onClick }) {
    return createPortal(
        <button type="button" className="app-fab" onClick={onClick} aria-label={label}>
            <i className={`fa-solid ${icon}`}></i>
        </button>,
        document.body,
    );
}