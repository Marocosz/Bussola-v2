import { useMemo, useState } from 'react';
import { CompromissoCard } from '../components/CompromissoCard';
import { Fab } from '../../../components/mobile/Fab';
import {
    addDays, buildDaySections, dayAriaLabel, dayHeaderParts, dayKey, DIAS_CURTOS,
    flattenCompromissos, indexByDay, parseKey, weekKeys, weekRangeLabel,
} from '../roteiroDates';
import './roteiro-mobile.css';

/** Um dia da faixa: o botão ocupa 1/7 da faixa; o card visual (.dia-card) fica dentro. */
function DiaDaSemana({ dia, count, isToday, isSelected, onSelect }) {
    const d = parseKey(dia);
    const cls = ['dia-card', 'm-week-cell', isToday && 'today', isSelected && 'is-selected', count > 0 && 'has-compromissos']
        .filter(Boolean)
        .join(' ');
    return (
        <button
            type="button"
            className="m-week-day"
            aria-pressed={isSelected}
            aria-label={dayAriaLabel(dia, count)}
            onClick={() => onSelect(dia)}
        >
            <span className={cls}>
                <span className="dia-semana">{DIAS_CURTOS[d.getDay()]}</span>
                <span className="dia-numero">{d.getDate()}</span>
                <span className={`compromisso-indicator ${count > 0 ? '' : 'no-event'}`}></span>
            </span>
        </button>
    );
}

/**
 * Roteiro no celular (spec §5.3, opção "Faixa da semana"): faixa de 7 dias com ‹ ›,
 * busca + ordenação, e a lista do dia selecionado seguida dos próximos (ou anteriores)
 * dias com o CompromissoCard atual. Dados e handlers vêm da página (index.jsx).
 * `onNew(dia)`: recebe o dia selecionado quando ele não é hoje (o form abre nele), senão null.
 */
export function RoteiroMobile({ data, loading, searchTerm, onSearch, sortOrder, onToggleSort, onUpdate, onEdit, onNew }) {
    const [hoje] = useState(() => dayKey(new Date()));
    const [selected, setSelected] = useState(hoje);

    const lista = useMemo(() => flattenCompromissos(data?.compromissos_por_mes), [data]);
    const porDia = useMemo(() => indexByDay(lista), [lista]);
    const semana = useMemo(() => weekKeys(selected), [selected]);
    const secoes = useMemo(
        () => buildDaySections(lista, selected, { order: sortOrder, search: searchTerm }),
        [lista, selected, sortOrder, searchTerm],
    );

    const mudarSemana = (dir) => setSelected((k) => addDays(k, 7 * dir));

    return (
        <div className="m-roteiro">
            <section className="m-week" aria-label="Semana">
                <div className="m-week-head">
                    <button type="button" className="btn-nav-arrow m-week-nav" aria-label="Semana anterior" onClick={() => mudarSemana(-1)}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span className="m-week-title">{weekRangeLabel(semana)}</span>
                    <button type="button" className="btn-nav-arrow m-week-nav" aria-label="Próxima semana" onClick={() => mudarSemana(1)}>
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <div className="m-week-strip">
                    {semana.map((k) => (
                        <DiaDaSemana
                            key={k}
                            dia={k}
                            count={porDia.get(k)?.length || 0}
                            isToday={k === hoje}
                            isSelected={k === selected}
                            onSelect={setSelected}
                        />
                    ))}
                </div>
            </section>

            <div className="m-roteiro-tools">
                <label className="m-roteiro-search">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    <input
                        type="search"
                        placeholder="Buscar..."
                        aria-label="Buscar compromissos"
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </label>
                <button
                    type="button"
                    className="btn-filter-sort m-roteiro-sort"
                    onClick={onToggleSort}
                    aria-label={sortOrder === 'desc' ? 'Mostrar próximos dias' : 'Mostrar dias anteriores'}
                >
                    <i className={`fa-solid fa-arrow-${sortOrder === 'desc' ? 'up-wide-short' : 'down-wide-short'}`}></i>
                </button>
            </div>

            {loading && !data ? (
                <p className="m-roteiro-loading">
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Carregando agenda...
                </p>
            ) : (
                <div className="m-roteiro-list">
                    {secoes.length === 0 && <p className="empty-list-msg">Nenhum compromisso encontrado.</p>}
                    {secoes.map((s) => {
                        const cab = dayHeaderParts(s.key);
                        return (
                            <section key={s.key} className="m-day-group" data-day={s.key}>
                                <h2 className="m-day-head">
                                    {cab.rel && <><span className="m-day-rel">{cab.rel}</span>{' · '}</>}
                                    {cab.text}
                                </h2>
                                {s.items.length > 0 ? (
                                    <div className="m-day-cards">
                                        {s.items.map((c) => (
                                            <CompromissoCard key={c.id} comp={c} onUpdate={onUpdate} onEdit={onEdit} />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-list-msg">Nenhum compromisso neste dia.</p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <Fab icon="fa-plus" label="Novo compromisso" onClick={() => onNew(selected === hoje ? null : selected)} />
        </div>
    );
}
