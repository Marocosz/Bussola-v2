// Mapa das 4 colunas fixas do board. `status` = valor gravado no banco.
export const COLUNAS = [
    { key: 'a_fazer',      status: 'Pendente',     label: 'A Fazer',      accent: 'var(--cor-azul-primario)' },
    { key: 'em_andamento', status: 'Em andamento', label: 'Em Andamento', accent: 'var(--cor-laranja-aviso)' },
    { key: 'concluido',    status: 'Concluído',    label: 'Concluído',    accent: 'var(--cor-verde-sucesso)' },
    { key: 'cancelado',    status: 'Cancelado',    label: 'Cancelado',    accent: 'var(--cor-vermelho-delete)' },
];

export const COL_KEYS = COLUNAS.map(c => c.key);

const STATUS_BY_KEY = Object.fromEntries(COLUNAS.map(c => [c.key, c.status]));
const KEY_BY_STATUS = Object.fromEntries(COLUNAS.map(c => [c.status, c.key]));

export const keyToStatus = (key) => STATUS_BY_KEY[key];
export const statusToKey = (status) => KEY_BY_STATUS[status] || 'a_fazer';

export const PRIO_COLORS = {
    'Crítica': '#ef4444',
    'Alta': '#f59e0b',
    'Média': '#3b82f6',
    'Baixa': '#10b981',
};
