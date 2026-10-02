import { useState } from 'react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL = (v) => BRL.format(v || 0);

/**
 * KPIs do mês numa faixa rolável. A explicação (antes só no `title`) aparece ao tocar
 * no chip; tocar de novo esconde. O Caixa abre o CaixaModal (que já tem a explicação).
 */
export function KpiStrip({ totalReceita, totalDespesa, disponivel, guardado, caixa, onOpenCaixa }) {
    const [aberto, setAberto] = useState(null);

    const chips = [
        {
            key: 'disponivel', label: 'Disponível', valor: disponivel, icon: 'fa-solid fa-scale-balanced',
            cls: disponivel >= 0 ? 'positivo' : 'negativo',
            explica: 'Disponível: dinheiro livre pra gastar (Caixa − Guardado). Guardar numa meta reduz isto, mas não é gasto.',
        },
        { key: 'receitas', label: 'Receitas', valor: totalReceita, icon: 'fa-solid fa-arrow-trend-up', cls: 'receita', explica: 'Receitas efetivadas deste mês.' },
        { key: 'despesas', label: 'Despesas', valor: totalDespesa, icon: 'fa-solid fa-arrow-trend-down', cls: 'despesa', explica: 'Despesas efetivadas deste mês.' },
        guardado > 0 && {
            key: 'guardado', label: 'Guardado', valor: guardado, icon: 'fa-solid fa-piggy-bank', cls: 'm-kpi-guardado',
            explica: 'Guardado nas metas/cofrinhos. Continua sendo seu — só saiu do disponível (não é gasto). O caixa não muda ao guardar.',
        },
        { key: 'caixa', label: 'Caixa', valor: caixa, icon: 'fa-solid fa-vault', cls: 'ph-kpi-btn', abreCaixa: true },
    ].filter(Boolean);

    const atual = chips.find((c) => c.key === aberto);

    return (
        <section className="m-kpis" aria-label="Resumo do mês">
            <div className="m-kpi-strip" data-offscreen-ok>
                {chips.map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        className={`ph-kpi m-kpi ${c.cls} ${aberto === c.key ? 'is-open' : ''}`}
                        aria-expanded={c.abreCaixa ? undefined : aberto === c.key}
                        onClick={() => (c.abreCaixa ? onOpenCaixa() : setAberto(aberto === c.key ? null : c.key))}
                    >
                        <i className={c.icon} aria-hidden="true"></i>
                        <span className="m-kpi-text">
                            <span className="m-kpi-label">{c.label}</span>
                            <strong>{fmtBRL(c.valor)}</strong>
                        </span>
                        {c.abreCaixa && <i className="fa-solid fa-sliders ph-kpi-btn-hint" aria-hidden="true"></i>}
                    </button>
                ))}
            </div>
            {atual && (
                <p className="m-kpi-explain" role="status">
                    <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                    <span>{atual.explica}</span>
                </p>
            )}
        </section>
    );
}
