import { useState } from 'react';
import { activeFilterChips, groupByDay } from '../transactionsQuery';
import { TransactionRowMobile } from './TransactionRowMobile';
import { FiltersSheet } from './FiltersSheet';

const PAGINA = 30;

/** Aba Transações: busca, filtros (sheet + chips), grupos por dia e "Carregar mais". */
export function TransacoesTab({ data, loading, transactions, filters, sortConfig, onSearch, onApplyFilters, onClearFilter, rowProps }) {
    // "Carregar mais" volta ao início quando filtros/ordem mudam (ajuste no render, sem efeito).
    const chave = JSON.stringify([filters, sortConfig]);
    const [visiveis, setVisiveis] = useState(PAGINA);
    const [chaveAnterior, setChaveAnterior] = useState(chave);
    const [filtrosAbertos, setFiltrosAbertos] = useState(false);
    if (chaveAnterior !== chave) {
        setChaveAnterior(chave);
        setVisiveis(PAGINA);
    }

    const chips = activeFilterChips(filters, data);
    const n = chips.length;
    const mostradas = transactions.slice(0, visiveis);
    const restantes = transactions.length - mostradas.length;
    // Cabeçalho por dia só faz sentido ordenando por data; em outra ordem, lista corrida.
    const grupos = sortConfig.column === 'data'
        ? groupByDay(mostradas)
        : [{ key: 'todas', label: null, items: mostradas }];

    return (
        <div className="m-tx">
            <div className="m-tx-head">
                <div className="m-tx-toolbar">
                    <label className="m-search">
                        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                        <input
                            type="search"
                            aria-label="Buscar transações"
                            placeholder="Buscar transações"
                            value={filters.search}
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </label>
                    <button
                        type="button"
                        className={`m-filter-btn ${n ? 'active' : ''}`}
                        aria-label={n === 0 ? 'Filtros' : n === 1 ? 'Filtros (1 ativo)' : `Filtros (${n} ativos)`}
                        onClick={() => setFiltrosAbertos(true)}
                    >
                        <i className="fa-solid fa-sliders" aria-hidden="true"></i>
                        {n > 0 && <span className="m-filter-badge">{n}</span>}
                    </button>
                </div>

                {n > 0 && (
                    <div className="m-active-filters">
                        {chips.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                className="m-active-chip"
                                aria-label={`Remover filtro ${c.label}`}
                                onClick={() => onClearFilter(c.key)}
                            >
                                <span>{c.label}</span>
                                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <p className="m-tx-loading"><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Carregando…</p>
            ) : transactions.length === 0 ? (
                <p className="empty-list-msg">Nenhuma transação encontrada.</p>
            ) : (
                <>
                    {grupos.map((g) => (
                        <section key={g.key} className="m-tx-day">
                            {g.label && <h3 className="m-tx-day-head">{g.label}</h3>}
                            <div className="m-tx-list">
                                {g.items.map((t) => <TransactionRowMobile key={t.id} transacao={t} {...rowProps} />)}
                            </div>
                        </section>
                    ))}
                    {restantes > 0 && (
                        <button type="button" className="btn-secondary m-load-more" onClick={() => setVisiveis((v) => v + PAGINA)}>
                            Carregar mais ({restantes})
                        </button>
                    )}
                </>
            )}

            {filtrosAbertos && (
                <FiltersSheet
                    data={data}
                    filters={filters}
                    sortConfig={sortConfig}
                    onApply={onApplyFilters}
                    onClose={() => setFiltrosAbertos(false)}
                />
            )}
        </div>
    );
}
