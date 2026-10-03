import { useEffect, useMemo, useRef, useState } from 'react';
import { CompromissoCard } from '../components/CompromissoCard';
import { Fab } from '../../../components/mobile/Fab';
import { Sheet } from '../../../components/mobile/Sheet';
import { TopbarActions } from '../../../components/mobile/MobileChrome';
import {
    addDays, buildDaySections, dayAriaLabel, dayHeaderParts, dayKey, DIAS_CURTOS,
    flattenCompromissos, indexByDay, monthGrid, monthLabel, parseKey, weekKeys, weekRangeLabel,
} from '../roteiroDates';
import './roteiro-mobile.css';

const SWIPE_MIN = 48; // deslocamento horizontal (px) que troca de semana

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

/** O .dias-grid atual (mesmas células do desktop), calculado no cliente a partir da lista completa. */
function CalendarioMes({ grade, porDia, hoje, selected, onPick }) {
    return (
        <div className="dias-grid">
            {DIAS_CURTOS.map((w) => (
                <span key={w} className="m-cal-weekday" aria-hidden="true">{w}</span>
            ))}
            {grade.map((c) => {
                if (c.isPadding) {
                    return (
                        <span key={c.key} className="dia-card dia-padding">
                            <span className="dia-numero">{c.day}</span>
                            <span className="dia-semana">{c.weekday}</span>
                            <span className="compromisso-indicator no-event"></span>
                        </span>
                    );
                }
                const n = porDia.get(c.key)?.length || 0;
                const cls = ['dia-card', c.key === hoje && 'today', c.key === selected && 'is-selected', n > 0 && 'has-compromissos']
                    .filter(Boolean)
                    .join(' ');
                return (
                    <button
                        key={c.key}
                        type="button"
                        className={cls}
                        aria-pressed={c.key === selected}
                        aria-label={dayAriaLabel(c.key, n)}
                        onClick={() => onPick(c.key)}
                    >
                        <span className="dia-numero">{c.day}</span>
                        <span className="dia-semana">{c.weekday}</span>
                        <span className={`compromisso-indicator ${n > 0 ? '' : 'no-event'}`}></span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Roteiro no celular (spec §5.3, opção "Faixa da semana"): calendário do mês na topbar
 * (sheet), faixa de 7 dias com ‹ › e swipe, busca + ordenação, e a lista do dia
 * selecionado seguida dos próximos (ou anteriores) dias com o CompromissoCard atual.
 * Dados e handlers vêm da página (index.jsx).
 * `onNew(dia)`: recebe o dia selecionado quando ele não é hoje (o form abre nele), senão null.
 */
export function RoteiroMobile({ data, loading, searchTerm, onSearch, sortOrder, onToggleSort, onUpdate, onEdit, onNew }) {
    const [hoje, setHoje] = useState(() => dayKey(new Date()));
    const [selected, setSelected] = useState(hoje);
    const [calOpen, setCalOpen] = useState(false);
    const [calMonth, setCalMonth] = useState(() => {
        const d = new Date();
        return { y: d.getFullYear(), m: d.getMonth() };
    });
    const swipe = useRef(null);
    const engolirClique = useRef(false);
    const hojeRef = useRef(hoje);

    // Se a página ficou aberta além da meia-noite, "hoje" é renovado ao voltar a ela.
    // O efeito só assina; o estado muda dentro do handler. A seleção acompanha quando estava em "hoje".
    useEffect(() => {
        const atualizar = () => {
            if (document.visibilityState === 'hidden') return;
            const novo = dayKey(new Date());
            const antigo = hojeRef.current;
            if (novo === antigo) return;
            hojeRef.current = novo;
            setHoje(novo);
            setSelected((k) => (k === antigo ? novo : k));
        };
        document.addEventListener('visibilitychange', atualizar);
        window.addEventListener('focus', atualizar);
        return () => {
            document.removeEventListener('visibilitychange', atualizar);
            window.removeEventListener('focus', atualizar);
        };
    }, []);

    const lista = useMemo(() => flattenCompromissos(data?.compromissos_por_mes), [data]);
    const porDia = useMemo(() => indexByDay(lista), [lista]);
    const semana = useMemo(() => weekKeys(selected), [selected]);
    const secoes = useMemo(
        () => buildDaySections(lista, selected, { order: sortOrder, search: searchTerm }),
        [lista, selected, sortOrder, searchTerm],
    );
    const grade = useMemo(() => monthGrid(calMonth.y, calMonth.m), [calMonth]);

    const mudarSemana = (dir) => setSelected((k) => addDays(k, 7 * dir));

    const abrirCalendario = () => {
        const d = parseKey(selected);
        setCalMonth({ y: d.getFullYear(), m: d.getMonth() });
        setCalOpen(true);
    };

    const mudarMes = (dir) => setCalMonth(({ y, m }) => {
        const d = new Date(y, m + dir, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    });

    const escolherNoCalendario = (key) => {
        setSelected(key);
        setCalOpen(false);
        // O unlockScroll do sheet restaura o scroll antigo; depois disso, volta ao topo
        // para a faixa e o cabeçalho do dia escolhido aparecerem.
        requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    // Swipe horizontal na faixa troca de semana; o clique que fecha o gesto é descartado.
    const onPointerDown = (e) => {
        engolirClique.current = false;
        swipe.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
        const ini = swipe.current;
        swipe.current = null;
        if (!ini) return;
        const dx = e.clientX - ini.x;
        const dy = e.clientY - ini.y;
        if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
            engolirClique.current = true;
            mudarSemana(dx < 0 ? 1 : -1);
        }
    };

    const onClickCapture = (e) => {
        if (!engolirClique.current) return;
        engolirClique.current = false;
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div className="m-roteiro">
            <TopbarActions>
                <button type="button" aria-label="Abrir calendário" onClick={abrirCalendario}>
                    <i className="fa-solid fa-calendar-days"></i>
                </button>
            </TopbarActions>

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
                <div
                    className="m-week-strip"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => { swipe.current = null; }}
                    onClickCapture={onClickCapture}
                >
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

            <Sheet open={calOpen} onClose={() => setCalOpen(false)} title="Calendário" className="roteiro-cal-sheet">
                <div className="m-cal-nav">
                    <button type="button" className="btn-nav-arrow" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span className="m-cal-title">{monthLabel(calMonth.y, calMonth.m)}</span>
                    <button type="button" className="btn-nav-arrow" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <CalendarioMes grade={grade} porDia={porDia} hoje={hoje} selected={selected} onPick={escolherNoCalendario} />
            </Sheet>
        </div>
    );
}
