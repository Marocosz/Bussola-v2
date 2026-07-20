import React, { useState } from 'react';
import { DatePicker } from './Pickers';
import { DATE_PRESETS, computeRange, presetLabel } from '../utils/dateRange';

/**
 * Filtro de intervalo de datas reutilizável (presets + personalizado), no estilo
 * do filtro de Provisões/Finanças. Emite `onChange({ start, end })` com datas ISO
 * (YYYY-MM-DD); `end` é EXCLUSIVO (o dia final já vem +1 no modo personalizado).
 * Os presets e o cálculo vivem em utils/dateRange.js.
 */
export function DateRangeFilter({ initialPreset = 'mes', onChange }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(initialPreset);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const selectPreset = (key) => {
    setPreset(key);
    if (key !== 'custom') {
      setOpen(false);
      onChange?.(computeRange(key));
    }
  };

  const onCustomStart = (e) => {
    const v = e.target.value; setStart(v);
    const r = computeRange('custom', v, end);
    if (r) onChange?.(r);
  };
  const onCustomEnd = (e) => {
    const v = e.target.value; setEnd(v);
    const r = computeRange('custom', start, v);
    if (r) onChange?.(r);
  };

  const triggerLabel = preset === 'custom' && start && end
    ? `${start.split('-').reverse().join('/')} — ${end.split('-').reverse().join('/')}`
    : presetLabel(preset);

  return (
    <div className="drf-wrapper">
      <button className={`drf-trigger ${preset !== 'mes' ? 'active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <i className="fa-regular fa-calendar"></i>
        <span>{triggerLabel}</span>
        <i className="fa-solid fa-chevron-down"></i>
      </button>
      {open && (
        <>
          <div className="drf-backdrop" onClick={() => setOpen(false)}></div>
          <div className="drf-menu">
            {DATE_PRESETS.map((p) => (
              <div
                key={p.key}
                className={`drf-item ${preset === p.key ? 'selected' : ''}`}
                onClick={() => selectPreset(p.key)}
              >
                {p.label}
              </div>
            ))}
            {preset === 'custom' && (
              <div className="drf-range">
                <DatePicker size="sm" value={start} onChange={onCustomStart} placeholder="Início" />
                <span className="drf-range-sep">—</span>
                <DatePicker size="sm" value={end} onChange={onCustomEnd} placeholder="Fim" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
