import { PAG_LABEL } from '../components/pagamento';

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/** Linha de 2 níveis: [ícone] título · valor / categoria · pagamento · estado. */
export function TransactionRowMobile({ transacao: t }) {
    const isCofre = !!t._isCofre;
    const tipo = t.tipo_recorrencia || 'pontual';
    const isEncerrada = t.recorrencia_encerrada === true;
    const isArquivada = t._cofreArquivada === true;
    const apagada = isEncerrada || isArquivada;

    const sinal = isCofre ? (t.tipo_mov === 'aporte' ? '+' : '−') : (t.categoria?.tipo === 'despesa' ? '−' : '+');
    const valorCls = isCofre ? 'row-valor-cofre' : (t.categoria?.tipo || '');
    const meta = isCofre
        ? ['Cofre', t.origem === 'agendado' ? 'Automático' : 'Manual']
        : [
            t.categoria?.nome || '—',
            PAG_LABEL[t.tipo_pagamento],
            tipo === 'parcelada' && t.total_parcelas ? `${t.parcela_atual}/${t.total_parcelas}` : null,
            tipo === 'recorrente' ? 'Recorrente' : null,
        ].filter(Boolean);
    const icone = t.categoria?.icone || (isCofre ? 'fa-solid fa-piggy-bank' : 'fa-solid fa-question');
    const cor = apagada ? '#9ca3af' : (t.categoria?.cor || (isCofre ? 'var(--cor-azul-primario)' : '#aaa'));

    return (
        <div className={`m-tx-row ${apagada ? 'is-muted' : ''}`} role="button" tabIndex={0} data-tipo={isCofre ? 'cofre' : tipo}>
            <span className="row-cat-icon m-tx-icon"><i className={icone} style={{ color: cor }} /></span>
            <span className={`m-tx-title ${apagada ? 'row-descricao-encerrada' : ''}`}>{t.descricao}</span>
            <span className={`row-valor m-tx-valor ${valorCls} ${apagada ? 'row-valor-encerrado' : ''}`}>{sinal} {fmtBRL(t.valor)}</span>
            <span className="m-tx-meta">{meta.join(' · ')}</span>
            <span className="m-tx-side">
                {isEncerrada && <span className="tag tag-encerrada"><i className="fa-solid fa-ban"></i> Encerrada</span>}
                {isArquivada && <span className="tag tag-arquivada"><i className="fa-solid fa-box-archive"></i> Arquivado</span>}
            </span>
        </div>
    );
}
