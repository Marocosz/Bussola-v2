import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './pickers.css';

// ─── Constantes ───────────────────────────────────────────────────────────────

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(val) {
    if (!val) return { h: null, m: null };
    const [h = null, m = null] = val.split(':');
    return { h, m: m ? m.slice(0, 2) : null };
}

function normalizeMin(m) {
    if (m === null || m === undefined) return '00';
    return String(parseInt(m, 10) % 60).padStart(2, '0');
}

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * TimePicker customizado.
 *
 * Props:
 *   value       — string "HH:MM" ou vazio
 *   onChange(e) — chamado com { target: { name, value } }  (compatível com handleChange genérico)
 *   name        — string (opcional, para handleChange genérico)
 *   label       — string (opcional)
 *   placeholder — string (default "Selecione...")
 *   required    — bool
 */
export function TimePicker({
    value,
    onChange,
    name,
    label,
    placeholder = 'Selecione...',
    required = false,
}) {
    const [open, setOpen]         = useState(false);
    const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });

    const wrapperRef = useRef(null);
    const panelRef   = useRef(null);
    const hColRef    = useRef(null);
    const mColRef    = useRef(null);

    const { h: selH, m: selM } = parseTime(value);
    const selMNorm = normalizeMin(selM);

    // ── Abre o painel e calcula posição ──────────────────────────────────────
    const openPanel = () => {
        if (!wrapperRef.current) return;
        const rect       = wrapperRef.current.getBoundingClientRect();
        const panelH     = 260;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top        = spaceBelow >= panelH
            ? rect.bottom + 4
            : rect.top - panelH - 4;

        setPanelPos({
            top,
            left:  rect.left,
            width: Math.max(rect.width, 160),
        });
        setOpen(true);
    };

    // ── Scroll para item selecionado ao abrir ────────────────────────────────
    useEffect(() => {
        if (!open) return;
        // rAF garante que o DOM do portal já está renderizado
        const id = requestAnimationFrame(() => {
            if (hColRef.current && selH) {
                const el = hColRef.current.querySelector(`[data-v="${selH}"]`);
                el?.scrollIntoView({ block: 'center', behavior: 'instant' });
            }
            if (mColRef.current && selMNorm) {
                const el = mColRef.current.querySelector(`[data-v="${selMNorm}"]`);
                el?.scrollIntoView({ block: 'center', behavior: 'instant' });
            }
        });
        return () => cancelAnimationFrame(id);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Fechar ao clicar fora / scroll / ESC ────────────────────────────────
    useEffect(() => {
        if (!open) return;

        const onMouseDown = (e) => {
            if (
                wrapperRef.current?.contains(e.target) ||
                panelRef.current?.contains(e.target)
            ) return;
            setOpen(false);
        };
        const onScroll  = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };

        document.addEventListener('mousedown', onMouseDown);
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('scroll', onScroll, { capture: true });
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    // ── Selecionar hora ou minuto ────────────────────────────────────────────
    const emitChange = (h, m) => {
        const newH = h ?? selH ?? '00';
        const newM = m ?? selMNorm ?? '00';
        onChange({ target: { name, value: `${newH}:${newM}` } });
    };

    const selectHour = (h) => emitChange(h, null);
    const selectMin  = (m) => { emitChange(null, m); setOpen(false); };

    // ── Display ──────────────────────────────────────────────────────────────
    const displayValue = value ? value.slice(0, 5) : null;

    // ── Painel (portal) ──────────────────────────────────────────────────────
    const panel = open ? (
        <div
            ref={panelRef}
            className="pk-panel pk-time-panel"
            style={{
                position: 'fixed',
                top:      panelPos.top,
                left:     panelPos.left,
                width:    panelPos.width,
                zIndex:   9999,
            }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="pk-time-cols">
                {/* ── Coluna de horas ── */}
                <div className="pk-time-col-wrap">
                    <div className="pk-time-col-header">h</div>
                    <div className="pk-time-col" ref={hColRef}>
                        {HOURS.map(h => (
                            <button
                                key={h}
                                type="button"
                                data-v={h}
                                className={`pk-time-item ${h === selH ? 'selected' : ''}`}
                                onClick={() => selectHour(h)}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pk-time-sep">:</div>

                {/* ── Coluna de minutos ── */}
                <div className="pk-time-col-wrap">
                    <div className="pk-time-col-header">min</div>
                    <div className="pk-time-col" ref={mColRef}>
                        {MINUTES.map(m => (
                            <button
                                key={m}
                                type="button"
                                data-v={m}
                                className={`pk-time-item ${m === selMNorm ? 'selected' : ''}`}
                                onClick={() => selectMin(m)}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="pk-wrapper" ref={wrapperRef}>
            {label && <label className="pk-label">{label}</label>}

            <button
                type="button"
                className={`pk-trigger ${open ? 'open' : ''} ${!displayValue ? 'placeholder' : ''}`}
                onClick={() => open ? setOpen(false) : openPanel()}
                aria-haspopup="true"
                aria-expanded={open}
            >
                <span className="pk-trigger-text">
                    {displayValue || placeholder}
                </span>
                <div className="pk-trigger-right">
                    <i className="fa-regular fa-clock pk-trigger-icon"></i>
                    <i className="fa-solid fa-chevron-down pk-chevron"></i>
                </div>

                {/* Campo oculto para validação nativa do browser */}
                {required && !value && (
                    <input
                        type="text"
                        required
                        tabIndex={-1}
                        aria-hidden="true"
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    />
                )}
            </button>

            {createPortal(panel, document.body)}
        </div>
    );
}
