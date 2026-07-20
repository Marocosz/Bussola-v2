// Presets e cálculo de intervalos para o DateRangeFilter (estilo Provisões).
// `end` é sempre EXCLUSIVO (usa `< end` no backend).

export const DATE_PRESETS = [
  { key: 'mes', label: 'Este mês' },
  { key: 'mes_passado', label: 'Mês passado' },
  { key: 'trimestre', label: 'Últimos 3 meses' },
  { key: 'semestre', label: 'Últimos 6 meses' },
  { key: 'ano', label: 'Este ano' },
  { key: 'ano_passado', label: 'Ano passado' },
  { key: 'custom', label: 'Personalizado' },
];

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Retorna { start, end } (ISO YYYY-MM-DD); null para 'custom' sem datas completas.
export function computeRange(preset, start = '', end = '') {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'mes':
      return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 1)) };
    case 'mes_passado':
      return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 1)) };
    case 'trimestre':
      return { start: iso(new Date(y, m - 2, 1)), end: iso(new Date(y, m + 1, 1)) };
    case 'semestre':
      return { start: iso(new Date(y, m - 5, 1)), end: iso(new Date(y, m + 1, 1)) };
    case 'ano':
      return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y + 1, 0, 1)) };
    case 'ano_passado':
      return { start: iso(new Date(y - 1, 0, 1)), end: iso(new Date(y, 0, 1)) };
    default: // custom — fim exclusivo (dia final + 1)
      if (start && end) {
        const e = new Date(end + 'T00:00:00');
        e.setDate(e.getDate() + 1);
        return { start, end: iso(e) };
      }
      return null;
  }
}

export const presetLabel = (key) => DATE_PRESETS.find((p) => p.key === key)?.label || 'Período';
