const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Sub-linhas do histórico de um grupo (parcelas, recorrência ou movimentações do cofre). */
export function ParcelaSubList({ transacao }) {
    if (transacao._isCofre) {
        const movs = transacao._cofreMovs || [];
        return (
            <div className="parcela-expanded-list">
                {movs.map(mv => {
                    const d = new Date(mv.data);
                    const isSelf = mv.id === transacao._movId;
                    return (
                        <div key={mv.id} className={`parcela-sub-row ${isSelf ? 'parcela-sub-current' : ''}`}>
                            <span className="parcela-sub-badge">{mv.tipo === 'aporte' ? 'Aporte' : 'Retirada'}</span>
                            <span className="parcela-sub-data">{d.toLocaleDateString('pt-BR')}</span>
                            <span className={`tag tag-status tag-${mv.status.toLowerCase()}`}>{mv.status}</span>
                            <span className="parcela-sub-valor row-valor-cofre">
                                {mv.tipo === 'aporte' ? '+' : '−'} {fmtBRL(mv.valor || 0)}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    const tipo = transacao.tipo_recorrencia || 'pontual';
    return (
        <div className="parcela-expanded-list">
            {(transacao._allParcelas || []).map(p => {
                const d = new Date(p.data);
                const isSelf = p.id === transacao.id;  // destaca a linha que foi clicada
                return (
                    <div key={p.id} className={`parcela-sub-row ${isSelf ? 'parcela-sub-current' : ''}`}>
                        {tipo === 'parcelada' ? (
                            <span className="parcela-sub-badge">{p.parcela_atual}/{p.total_parcelas}</span>
                        ) : (
                            <span className="parcela-sub-badge parcela-sub-badge-month">
                                {d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                            </span>
                        )}
                        <span className="parcela-sub-data">{d.toLocaleDateString('pt-BR')}</span>
                        <span className={`tag tag-status tag-${p.status.toLowerCase()}`}>{p.status}</span>
                        <span className={`parcela-sub-valor ${p.categoria?.tipo}`}>
                            {p.categoria?.tipo === 'despesa' ? '−' : '+'} {fmtBRL(p.valor)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
