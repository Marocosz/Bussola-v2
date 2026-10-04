import { useEffect, useRef, useState } from 'react';
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

    // Lista padrão ("Este mês", mais recentes primeiro): começa em hoje (ou no dia mais próximo ≤ hoje), uma vez por montagem.
    const alvoRef = useRef(null);
    const jaRolou = useRef(false);
    const d0 = new Date();
    const hoje = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
    const padrao = filters.datePreset === 'mes' && sortConfig.column === 'data' && sortConfig.dir === 'desc';
    // O pulo rola a janela (a lista rola com a página); ao desmontar (outra aba, ou a janela voltou a
    // ser desktop), desfaz o pulo se ninguém rolou depois dele — senão a página fica deslocada.
    const puloRef = useRef(null);
    useEffect(() => {
        if (loading || jaRolou.current) return;
        jaRolou.current = true;
        if (!padrao || !alvoRef.current) return;
        const antes = window.scrollY;
        alvoRef.current.scrollIntoView({ block: 'start' });
        puloRef.current = { antes, depois: window.scrollY };
    });
    useEffect(() => () => {
        const pulo = puloRef.current;
        if (pulo && pulo.depois !== pulo.antes && window.scrollY === pulo.depois) window.scrollTo(0, pulo.antes);
    }, []);

    const chips = activeFilterChips(filters, data);
    const n = chips.length;
    const mostradas = transactions.slice(0, visiveis);
    const restantes = transactions.length - mostradas.length;
    // Cabeçalho por dia só faz sentido ordenando por data; em outra ordem, lista corrida.
    const grupos = sortConfig.column === 'data'
        ? groupByDay(mostradas)
        : [{ key: 'todas', label: null, items: mostradas }];

    // Grupos em ordem decrescente: o primeiro com dia ≤ hoje. Se for o 1º grupo, não há nada acima a pular.
    const idxAlvo = padrao ? grupos.findIndex((g) => g.key <= hoje) : -1;

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
                    {grupos.map((g, i) => (
                        <section key={g.key} className="m-tx-day" ref={i === idxAlvo && i > 0 ? alvoRef : undefined}>
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
