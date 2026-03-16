// ─── Presets de Cor do Tema ──────────────────────────────────────────────────
// Cada preset define from (cor primária) → to (cor acento/gradiente) + hover
export const COLOR_PRESETS = [
    // ── Clássicos ──────────────────────────────────────────────
    { id: 'padrao',    name: 'Padrão',    from: '#4A6DFF', to: '#a855f7', hover: '#3859e0' },
    { id: 'royal',     name: 'Royal',     from: '#1d4ed8', to: '#4A6DFF', hover: '#1e40af' },
    { id: 'indigo',    name: 'Índigo',    from: '#6366f1', to: '#4A6DFF', hover: '#4f46e5' },
    // ── Frios ──────────────────────────────────────────────────
    { id: 'oceano',    name: 'Oceano',    from: '#0ea5e9', to: '#06b6d4', hover: '#0284c7' },
    { id: 'aurora',    name: 'Aurora',    from: '#06b6d4', to: '#8b5cf6', hover: '#0891b2' },
    { id: 'gelo',      name: 'Gelo',      from: '#38bdf8', to: '#a5f3fc', hover: '#0ea5e9' },
    { id: 'abissal',   name: 'Abissal',   from: '#0f172a', to: '#1e3a5f', hover: '#0d1b2a' },
    // ── Roxos / Magentas ───────────────────────────────────────
    { id: 'violeta',   name: 'Violeta',   from: '#8b5cf6', to: '#c026d3', hover: '#7c3aed' },
    { id: 'nebula',    name: 'Nebulosa',  from: '#7c3aed', to: '#ec4899', hover: '#6d28d9' },
    { id: 'crepusculo',name: 'Crepúsculo',from: '#a855f7', to: '#f43f5e', hover: '#9333ea' },
    // ── Rosas / Vermelhos ──────────────────────────────────────
    { id: 'rosa',      name: 'Rosa',      from: '#ec4899', to: '#f43f5e', hover: '#db2777' },
    { id: 'flamingo',  name: 'Flamingo',  from: '#f43f5e', to: '#fb923c', hover: '#e11d48' },
    { id: 'cereja',    name: 'Cereja',    from: '#dc2626', to: '#9f1239', hover: '#b91c1c' },
    // ── Verdes ─────────────────────────────────────────────────
    { id: 'esmeralda', name: 'Esmeralda', from: '#10b981', to: '#10b981', hover: '#059669' },
    { id: 'floresta',  name: 'Floresta',  from: '#16a34a', to: '#15803d', hover: '#166534' },
    { id: 'menta',     name: 'Menta',     from: '#34d399', to: '#06b6d4', hover: '#10b981' },
    // ── Quentes ────────────────────────────────────────────────
    { id: 'ambar',     name: 'Âmbar',     from: '#f59e0b', to: '#ef4444', hover: '#d97706' },
    { id: 'solar',     name: 'Solar',     from: '#f97316', to: '#eab308', hover: '#ea580c' },
    { id: 'vulcao',    name: 'Vulcão',    from: '#ef4444', to: '#f97316', hover: '#dc2626' },
    { id: 'ouro',      name: 'Ouro',      from: '#eab308', to: '#f59e0b', hover: '#ca8a04' },
    // ── Neutros ────────────────────────────────────────────────
    { id: 'ardosia',   name: 'Ardósia',   from: '#64748b', to: '#94a3b8', hover: '#475569' },
    { id: 'grafite',   name: 'Grafite',   from: '#374151', to: '#6b7280', hover: '#1f2937' },
];

const STORAGE_KEY = 'bussola_color_theme';

/** Converte hex (#rrggbb) em string "r, g, b" para uso em rgba() */
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

/** Aplica um preset de cor às variáveis CSS do :root e persiste no localStorage */
export function applyColorTheme(presetId) {
    const preset = COLOR_PRESETS.find(p => p.id === presetId) ?? COLOR_PRESETS[0];
    const root = document.documentElement;
    root.style.setProperty('--cor-azul-primario', preset.from);
    root.style.setProperty('--cor-acento',        preset.to);
    root.style.setProperty('--cor-azul-hover',    preset.hover);
    root.style.setProperty('--cor-tema-rgb',      hexToRgb(preset.from));
    root.style.setProperty('--cor-acento-rgb',    hexToRgb(preset.to));
    localStorage.setItem(STORAGE_KEY, preset.id);
}

/** Carrega e aplica o tema salvo. Chame no mount do app. */
export function loadSavedColorTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyColorTheme(saved);
}

/** Retorna o id do preset ativo */
export function getActivePresetId() {
    return localStorage.getItem(STORAGE_KEY) ?? 'padrao';
}
