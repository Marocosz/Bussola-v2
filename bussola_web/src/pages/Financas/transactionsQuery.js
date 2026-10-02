// Consulta da lista de transações de Provisões: achata, filtra, liga o histórico das
// séries e ordena. Funções puras (sem React), usadas pelo desktop e pelo celular.

export const FILTER_DEFAULTS = {
    tipo: 'todos',
    status: 'todos',
    categoria: null,
    pagamento: 'todos',
    datePreset: 'todos',
    dateStart: '',
    dateEnd: '',
    search: '',
};

// Mesmos valores/rótulos dos dropdowns do desktop.
export const TIPO_OPTIONS = [['todos', 'Todos'], ['pontual', 'Pontual'], ['parcelada', 'Parcelada'], ['recorrente', 'Recorrente'], ['cofre', 'Cofre']];
export const STATUS_OPTIONS = [['todos', 'Todos'], ['Efetivada', 'Efetivada'], ['Pendente', 'Pendente'], ['Encerrada', 'Encerrada'], ['Arquivado', 'Arquivado'], ['Automatico', 'Automático'], ['Manual', 'Manual']];
export const PAGAMENTO_OPTIONS = [['todos', 'Todos'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito'], ['transferencia', 'Transferência']];
export const PERIODO_OPTIONS = [['todos', 'Tudo'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['custom', 'Personalizado']];
export const SORT_OPTIONS = [
    { key: 'data-desc', label: 'Mais recentes', column: 'data', dir: 'desc' },
    { key: 'data-asc', label: 'Mais antigas', column: 'data', dir: 'asc' },
    { key: 'valor-desc', label: 'Maior valor', column: 'valor', dir: 'desc' },
    { key: 'valor-asc', label: 'Menor valor', column: 'valor', dir: 'asc' },
    { key: 'descricao-asc', label: 'Título A–Z', column: 'descricao', dir: 'asc' },
    { key: 'categoria-asc', label: 'Categoria A–Z', column: 'categoria', dir: 'asc' },
];

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterAndSortTransactions(data, f, sortConfig) {
    if (!data) return [];
    const pontuais = Object.values(data.transacoes_pontuais || {}).flat();
    const recorrentes = Object.values(data.transacoes_recorrentes || {}).flat();

    // Cofre: CADA movimentação vira uma linha própria (transferência neutra — não
    // conta em receita/despesa). Guarda o grupo inteiro para o expand ver o histórico.
    const cofreRows = (data.transacoes_cofre || []).flatMap(g =>
        (g.movimentacoes || []).map(mv => ({
            _isCofre: true,
            id: `cofremov-${mv.id}`,
            _movId: mv.id,
            id_grupo_recorrencia: g.id_grupo,
            tipo_recorrencia: 'cofre',
            descricao: `${mv.tipo === 'aporte' ? 'Aporte' : 'Retirada'} · ${g.nome}`,
            data: mv.data,
            valor: mv.valor,
            status: mv.status,
            tipo_mov: mv.tipo,
            origem: mv.origem,
            categoria: { nome: g.nome, icone: g.icone, cor: g.cor },
            meta_id: g.meta_id,
            _cofreArquivada: !!g.arquivada,
            _cofreMovs: (g.movimentacoes || []).length > 1 ? g.movimentacoes : undefined,
        }))
    );

    let all = [...pontuais, ...recorrentes, ...cofreRows];

    if (f.tipo !== 'todos') {
        all = all.filter(t => (t.tipo_recorrencia || 'pontual') === f.tipo);
    }
    if (f.status !== 'todos') {
        all = all.filter(t => {
            switch (f.status) {
                case 'Efetivada':
                    return (t.tipo_recorrencia || 'pontual') === 'pontual' || t.status === 'Efetivada';
                case 'Pendente':
                    return t.status === 'Pendente';
                case 'Encerrada':
                    return t.recorrencia_encerrada === true;
                case 'Arquivado':
                    return t._cofreArquivada === true;
                case 'Automatico':
                    return t._isCofre && t.tipo_mov && t.origem === 'agendado';
                case 'Manual':
                    return t._isCofre && t.origem === 'manual';
                default:
                    return true;
            }
        });
    }
    if (f.categoria) {
        all = all.filter(t => t.categoria?.id === f.categoria);
    }
    if (f.pagamento !== 'todos') {
        all = all.filter(t => t.tipo_pagamento === f.pagamento);
    }

    // Busca (só o celular tem o campo): descrição ou nome da categoria, sem acento.
    const busca = semAcento((f.search || '').trim());
    if (busca) {
        all = all.filter(t => semAcento(t.descricao).includes(busca) || semAcento(t.categoria?.nome).includes(busca));
    }

    // Filtro de data
    if (f.datePreset !== 'todos') {
        const today = new Date();
        let start = null, end = null;
        if (f.datePreset === 'semana') {
            start = new Date(today); start.setDate(today.getDate() - 6); start.setHours(0, 0, 0, 0);
            end = new Date(today); end.setHours(23, 59, 59, 999);
        } else if (f.datePreset === 'mes') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (f.datePreset === 'custom') {
            start = f.dateStart ? new Date(f.dateStart + 'T00:00:00') : null;
            end = f.dateEnd ? new Date(f.dateEnd + 'T23:59:59') : null;
        }
        if (start || end) {
            all = all.filter(t => {
                const d = new Date(t.data);
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            });
        }
    }

    // NÃO colapsa grupos: toda ocorrência é uma linha própria (30/07, 30/06, 30/05…).
    // Cada linha de parcelada/recorrente carrega o histórico COMPLETO do grupo
    // (todas as ocorrências) apenas para o expand — sem esconder nenhuma linha.
    const groupHistory = {};
    for (const t of recorrentes) {
        if (t.id_grupo_recorrencia) {
            if (!groupHistory[t.id_grupo_recorrencia]) groupHistory[t.id_grupo_recorrencia] = [];
            groupHistory[t.id_grupo_recorrencia].push(t);
        }
    }
    Object.values(groupHistory).forEach(list =>
        list.sort((a, b) => new Date(b.data) - new Date(a.data))  // histórico: mais recente primeiro
    );

    all = all.map(t => {
        if ((t.tipo_recorrencia === 'parcelada' || t.tipo_recorrencia === 'recorrente') && t.id_grupo_recorrencia) {
            const grupo = groupHistory[t.id_grupo_recorrencia];
            if (grupo && grupo.length > 1) return { ...t, _allParcelas: grupo };
        }
        return t;
    });

    const { column, dir } = sortConfig;
    const mult = dir === 'asc' ? 1 : -1;
    return all.sort((a, b) => {
        let cmp = 0;
        if (column === 'valor') {
            cmp = Number(a.valor || 0) - Number(b.valor || 0);
        } else if (column === 'descricao') {
            cmp = String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR');
        } else if (column === 'categoria') {
            cmp = String(a.categoria?.nome || '').localeCompare(String(b.categoria?.nome || ''), 'pt-BR');
        } else { // data (default)
            cmp = new Date(a.data) - new Date(b.data);
        }
        if (cmp === 0) cmp = new Date(a.data) - new Date(b.data); // desempate por data
        return cmp * mult;
    });
}

// ---------------------------------------------------------------------------
// Agrupamento por dia (lista do celular)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function shiftedKey(now, days) {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return dayKey(d);
}

export function dayLabel(date, now = new Date()) {
    const key = dayKey(date);
    const ddmm = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    if (key === shiftedKey(now, 0)) return `Hoje · ${ddmm}`;
    if (key === shiftedKey(now, -1)) return `Ontem · ${ddmm}`;
    if (key === shiftedKey(now, 1)) return `Amanhã · ${ddmm}`;
    const semana = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const ano = date.getFullYear() === now.getFullYear() ? '' : `/${String(date.getFullYear()).slice(2)}`;
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} · ${ddmm}${ano}`;
}

export function groupByDay(list, now = new Date()) {
    const groups = [];
    for (const t of list) {
        const d = new Date(t.data);
        const key = dayKey(d);
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.items.push(t);
        else groups.push({ key, label: dayLabel(d, now), items: [t] });
    }
    return groups;
}

// ---------------------------------------------------------------------------
// Chips dos filtros ativos (celular)
// ---------------------------------------------------------------------------
const rotulo = (opts, v) => (opts.find(([val]) => val === v) || [])[1];
const ddmm = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '…');

export function activeFilterChips(f, data) {
    const cats = [...(data?.categorias_despesa || []), ...(data?.categorias_receita || [])];
    const chips = [];
    if (f.tipo !== 'todos') chips.push({ key: 'tipo', label: rotulo(TIPO_OPTIONS, f.tipo) });
    if (f.status !== 'todos') chips.push({ key: 'status', label: rotulo(STATUS_OPTIONS, f.status) });
    if (f.pagamento !== 'todos') chips.push({ key: 'pagamento', label: rotulo(PAGAMENTO_OPTIONS, f.pagamento) });
    if (f.categoria != null) chips.push({ key: 'categoria', label: cats.find((c) => c.id === f.categoria)?.nome || 'Categoria' });
    if (f.datePreset !== 'todos') {
        chips.push({
            key: 'datePreset',
            label: f.datePreset === 'custom' ? `${ddmm(f.dateStart)}–${ddmm(f.dateEnd)}` : rotulo(PERIODO_OPTIONS, f.datePreset),
        });
    }
    return chips;
}
