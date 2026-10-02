import { useState } from 'react';
import { Sheet } from '../../../components/mobile/Sheet';
import { DatePicker } from '../../../components/Pickers';
import {
    FILTER_DEFAULTS, filterAndSortTransactions,
    TIPO_OPTIONS, STATUS_OPTIONS, PAGAMENTO_OPTIONS, PERIODO_OPTIONS, SORT_OPTIONS,
} from '../transactionsQuery';

function ChipGroup({ label, options, value, onChange, children }) {
    return (
        <fieldset className="m-filter-group">
            <legend className="m-filter-label">{label}</legend>
            <div className="m-chip-row">
                {options.map(([val, rotulo]) => (
                    <button
                        key={String(val)}
                        type="button"
                        className={`m-chip ${value === val ? 'active' : ''}`}
                        aria-pressed={value === val}
                        onClick={() => onChange(val)}
                    >
                        {rotulo}
                    </button>
                ))}
            </div>
            {children}
        </fieldset>
    );
}

/**
 * Filtros do celular. Edita um RASCUNHO (montado a cada abertura) e só aplica no
 * "Ver N transações"; o N é calculado pela mesma consulta da lista.
 */
export function FiltersSheet({ data, filters, sortConfig, onApply, onClose }) {
    const [draft, setDraft] = useState(filters);
    const [sort, setSort] = useState(sortConfig);
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

    const total = filterAndSortTransactions(data, draft, sort).length;
    const categorias = [...(data?.categorias_despesa || []), ...(data?.categorias_receita || [])];

    const footer = (
        <>
            <button
                type="button"
                className="btn-secondary"
                onClick={() => { setDraft({ ...FILTER_DEFAULTS, search: draft.search }); setSort({ column: 'data', dir: 'desc' }); }}
            >
                Limpar
            </button>
            <button type="button" className="btn-primary" onClick={() => { onApply(draft, sort); onClose(); }}>
                Ver {total} {total === 1 ? 'transação' : 'transações'}
            </button>
        </>
    );

    // Sheet é portal no body: o wrapper devolve o escopo `.financas-scope` ao CSS da página.
    return (
        <Sheet open onClose={onClose} title="Filtros" footer={footer} className="m-filters">
            <div className="financas-scope m-filters-scope">
                <ChipGroup label="Tipo" options={TIPO_OPTIONS} value={draft.tipo} onChange={(tipo) => set({ tipo })} />
                <ChipGroup label="Status" options={STATUS_OPTIONS} value={draft.status} onChange={(status) => set({ status })} />
                <ChipGroup label="Pagamento" options={PAGAMENTO_OPTIONS} value={draft.pagamento} onChange={(pagamento) => set({ pagamento })} />

                <fieldset className="m-filter-group">
                    <legend className="m-filter-label">Categoria</legend>
                    <div className="m-chip-row">
                        <button
                            type="button"
                            className={`m-chip ${draft.categoria == null ? 'active' : ''}`}
                            aria-pressed={draft.categoria == null}
                            onClick={() => set({ categoria: null })}
                        >
                            Todas
                        </button>
                        {categorias.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                className={`m-chip ${draft.categoria === c.id ? 'active' : ''}`}
                                aria-pressed={draft.categoria === c.id}
                                onClick={() => set({ categoria: draft.categoria === c.id ? null : c.id })}
                            >
                                <span className="cs-opt-icon-wrap" style={{ backgroundColor: c.cor }}>
                                    <i className={c.icone} aria-hidden="true"></i>
                                </span>
                                {c.nome}
                            </button>
                        ))}
                    </div>
                </fieldset>

                <ChipGroup
                    label="Período"
                    options={PERIODO_OPTIONS}
                    value={draft.datePreset}
                    onChange={(datePreset) => set({ datePreset })}
                >
                    {draft.datePreset === 'custom' && (
                        <div className="m-filter-range">
                            <DatePicker label="Início" value={draft.dateStart} onChange={(e) => set({ dateStart: e.target.value })} placeholder="Início" />
                            <DatePicker label="Fim" value={draft.dateEnd} onChange={(e) => set({ dateEnd: e.target.value })} placeholder="Fim" />
                        </div>
                    )}
                </ChipGroup>

                <ChipGroup
                    label="Ordenar"
                    options={SORT_OPTIONS.map((o) => [o.key, o.label])}
                    value={`${sort.column}-${sort.dir}`}
                    onChange={(key) => {
                        const o = SORT_OPTIONS.find((x) => x.key === key);
                        setSort({ column: o.column, dir: o.dir });
                    }}
                />
            </div>
        </Sheet>
    );
}
