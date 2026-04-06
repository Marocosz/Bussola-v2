import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './pickers.css';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MESES_SHORT = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

// Semana começa na Segunda-feira (padrão BR)
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padZ(n) {
    return String(n).padStart(2, '0');
}

/** Converte "YYYY-MM-DD" → Date (meia-noite local). */
function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Date → "YYYY-MM-DD". */
function formatDate(date) {
    return `${date.getFullYear()}-${padZ(date.getMonth() + 1)}-${padZ(date.getDate())}`;
}

/** "YYYY-MM-DD" → "15 de jan. de 2024" (exibição no trigger). */
function formatDisplay(str) {
    if (!str) return null;
    const d = parseDate(str);
    return `${d.getDate()} de ${MESES_SHORT[d.getMonth()]}. de ${d.getFullYear()}`;
}

/**
 * Gera array de 42 células para o grid do calendário (6 linhas × 7 colunas).
 * Semana começa na segunda-feira.
 */
function buildCalendar(year, month) {
    const firstWeekday = new Date(year, month, 1).getDay(); // 0=Dom
    // Offset Mon-start: Dom(0)→6, Seg(1)→0, Ter(2)→1 … Sáb(6)→5
    const offset = (firstWeekday + 6) % 7;

    const daysInMonth     = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Dias do mês anterior (cinza)
    for (let i = offset - 1; i >= 0; i--) {
        const prevM = month === 0 ? 11 : month - 1;
        const prevY = month === 0 ? year - 1 : year;
        cells.push({ day: daysInPrevMonth - i, month: prevM, year: prevY, current: false });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, month, year, current: true });
    }

    // Dias do próximo mês (completar até 42)
    const nextM = month === 11 ? 0  : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    let nextDay = 1;
    while (cells.length < 42) {
        cells.push({ day: nextDay++, month: nextM, year: nextY, current: false });
    }

    return cells;
}

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * DatePicker customizado.
 *
 * Props:
 *   value       — string "YYYY-MM-DD" ou vazio
 *   onChange(e) — chamado com { target: { name, value } }
 *   name        — string (opcional)
 *   label       — string (opcional)
 *   placeholder — string (default "Selecione...")
 *   required    — bool
 *   size        — "sm" para variante compacta (filtros)
 */
export const DatePicker = React.memo(function DatePicker({
    value,
    onChange,
    name,
    label,
    placeholder = 'Selecione...',
    required = false,
    size,
}) {
    const today    = new Date();
    const todayStr = formatDate(today);

    const initDate = value ? parseDate(value) : today;

    const [open,      setOpen]      = useState(false);
    const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initDate.getMonth());
    const [panelPos,  setPanelPos]  = useState({ top: 0, left: 0, width: 0 });

    const wrapperRef = useRef(null);
    const panelRef   = useRef(null);

    // Sincroniza visão quando o valor muda externamente
    useEffect(() => {
        if (value) {
            const d = parseDate(value);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [value]);

    // ── Abre e posiciona ────────────────────────────────────────────────────
    const openPanel = () => {
        if (!wrapperRef.current) return;
        const rect       = wrapperRef.current.getBoundingClientRect();
        const panelH     = 320;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top        = spaceBelow >= panelH
            ? rect.bottom + 4
            : rect.top - panelH - 4;

        setPanelPos({
            top,
            left:  Math.min(rect.left, window.innerWidth - 292 - 8),
            width: 288,
        });
        setOpen(true);
    };

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

    // ── Navegação de mês ────────────────────────────────────────────────────
    const prevMonth = useCallback(() => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    }, [viewMonth]);
    const nextMonth = useCallback(() => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    }, [viewMonth]);

    // ── Selecionar dia ──────────────────────────────────────────────────────
    const selectDay = useCallback((cell) => {
        const d   = new Date(cell.year, cell.month, cell.day);
        const val = formatDate(d);
        onChange({ target: { name, value: val } });
        setOpen(false);
    }, [onChange, name]);

    const selectToday = useCallback(() => {
        onChange({ target: { name, value: todayStr } });
        setOpen(false);
    }, [onChange, name, todayStr]);

    const clearValue = useCallback(() => {
        onChange({ target: { name, value: '' } });
        setOpen(false);
    }, [onChange, name]);

    // ── Grid (memoizado para evitar recálculo a cada render) ────────────────
    const cells = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

    // ── Display ─────────────────────────────────────────────────────────────
    const displayValue = formatDisplay(value);

    // ── Painel (portal) ──────────────────────────────────────────────────────
    const panel = open ? (
        <div
            ref={panelRef}
            className="pk-panel pk-date-panel"
            style={{
                position: 'fixed',
                top:      panelPos.top,
                left:     panelPos.left,
                width:    panelPos.width,
                zIndex:   9999,
            }}
            onMouseDown={e => e.stopPropagation()}
        >
            {/* ── Header ── */}
            <div className="pk-cal-header">
                <button type="button" className="pk-cal-nav-btn" onClick={prevMonth}>
                    <i className="fa-solid fa-chevron-left"></i>
                </button>
                <span className="pk-cal-month-title">
                    {MESES[viewMonth]} {viewYear}
                </span>
                <button type="button" className="pk-cal-nav-btn" onClick={nextMonth}>
                    <i className="fa-solid fa-chevron-right"></i>
                </button>
            </div>

            {/* ── Cabeçalho dos dias da semana ── */}
            <div className="pk-cal-weekdays">
                {DIAS_SEMANA.map(d => (
                    <div key={d} className="pk-cal-weekday">{d}</div>
                ))}
            </div>

            {/* ── Grid de dias ── */}
            <div className="pk-cal-days">
                {cells.map((cell, idx) => {
                    const cellStr    = formatDate(new Date(cell.year, cell.month, cell.day));
                    const isSelected = cellStr === value;
                    const isToday    = cellStr === todayStr;

                    return (
                        <button
                            key={idx}
                            type="button"
                            className={[
                                'pk-cal-day',
                                !cell.current  && 'other-month',
                                isToday        && 'today',
                                isSelected     && 'selected',
                            ].filter(Boolean).join(' ')}
                            onClick={() => cell.current && selectDay(cell)}
                            tabIndex={cell.current ? 0 : -1}
                        >
                            {cell.day}
                        </button>
                    );
                })}
            </div>

            {/* ── Footer ── */}
            <div className="pk-cal-footer">
                <button type="button" className="pk-cal-today-btn" onClick={selectToday}>
                    Hoje
                </button>
                {value && (
                    <button type="button" className="pk-cal-clear-btn" onClick={clearValue}>
                        Limpar
                    </button>
                )}
            </div>
        </div>
    ) : null;

    return (
        <div className={`pk-wrapper ${size === 'sm' ? 'pk-sm' : ''}`} ref={wrapperRef}>
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
                    <i className="fa-regular fa-calendar pk-trigger-icon"></i>
                    <i className="fa-solid fa-chevron-down pk-chevron"></i>
                </div>

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
});
