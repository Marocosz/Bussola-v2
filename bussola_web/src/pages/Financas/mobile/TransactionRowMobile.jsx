import { useState } from 'react';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { Sheet } from '../../../components/mobile/Sheet';
import { useTransactionActions } from '../components/useTransactionActions';
import { ParcelaSubList } from '../components/ParcelaSubList';
import { PAG_LABEL } from '../components/pagamento';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL = (v) => BRL.format(v || 0);

/**
 * Ações do ActionSheet, na ordem: status (Efetivar primária / Desmarcar), Editar,
 * Ver parcelas/histórico, destrutiva. Espelha exatamente o que o desktop permite
 * (TransactionCard), usando o mesmo `deleteMode` para decidir Excluir × Encerrar.
 */
function acoesDaLinha(t, h) {
    const tipo = t.tipo_recorrencia || 'pontual';
    const isPendente = t.status === 'Pendente';
    const historico = t._isCofre ? (t._cofreMovs || []) : (t._allParcelas || []);
    const verHistorico = historico.length > 1
        ? [{
            key: 'historico',
            icon: tipo === 'parcelada' ? 'fa-solid fa-layer-group' : 'fa-solid fa-clock-rotate-left',
            label: tipo === 'parcelada' ? 'Ver parcelas' : 'Ver histórico',
            onClick: h.verHistorico,
        }]
        : [];
    const status = (onClick) => (isPendente
        ? { key: 'efetivar', icon: 'fa-solid fa-check', label: 'Efetivar', variant: 'primary', onClick, disabled: h.busy }
        : { key: 'desmarcar', icon: 'fa-solid fa-rotate-left', label: 'Desmarcar', onClick, disabled: h.busy });

    if (t._isCofre) {
        if (t._cofreArquivada) return verHistorico;
        // Aporte automático já efetivado é histórico — sem excluir (regra do desktop).
        const automaticoEfetivado = t.origem === 'agendado' && !isPendente;
        return [
            status(h.toggleCofre),
            { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar movimentação', onClick: h.editCofre },
            ...verHistorico,
            ...(automaticoEfetivado ? [] : [{ key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: h.deleteCofre }]),
        ];
    }

    const isEncerrada = t.recorrencia_encerrada === true;
    let destrutiva = [];
    if (!isEncerrada && h.deleteMode === 'encerrar') {
        destrutiva = [{ key: 'encerrar', icon: 'fa-solid fa-ban', label: 'Encerrar recorrência', variant: 'danger', onClick: h.excluir }];
    } else if (!isEncerrada && h.deleteMode !== 'bloqueado') {
        destrutiva = [{ key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: h.excluir }];
    }
    return [
        ...(tipo !== 'pontual' && !isEncerrada ? [status(h.toggle)] : []),
        { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar', onClick: h.editar },
        ...verHistorico,
        ...destrutiva,
    ];
}

/** Linha de 2 níveis. Tocar abre o ActionSheet; o chip "Efetivar" efetiva direto. */
export function TransactionRowMobile({ transacao: t, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre }) {
    const [sheet, setSheet] = useState(null); // null | 'acoes' | 'historico'
    const { isDeleting, deleteMode, toggling, handleToggleStatus, handleDelete } = useTransactionActions(t, onUpdate);
    const [cofreToggling, setCofreToggling] = useState(false);
    const busy = toggling || cofreToggling;
    const toggleCofre = async () => {
        if (cofreToggling) return;
        setCofreToggling(true);
        try { await onToggleCofre(t); } finally { setCofreToggling(false); }
    };

    const isCofre = !!t._isCofre;
    const tipo = t.tipo_recorrencia || 'pontual';
    const isPendente = t.status === 'Pendente';
    const isEncerrada = t.recorrencia_encerrada === true;
    const isArquivada = t._cofreArquivada === true;
    const apagada = isEncerrada || isArquivada;
    const podeEfetivar = isPendente && (isCofre ? !isArquivada : (tipo !== 'pontual' && !isEncerrada));

    const actions = acoesDaLinha(t, {
        deleteMode,
        toggle: handleToggleStatus,
        excluir: handleDelete,
        editar: () => onEdit(t),
        busy,
        toggleCofre,
        editCofre: () => onEditCofre(t),
        deleteCofre: () => onDeleteCofre(t),
        verHistorico: () => setSheet('historico'),
    });

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
    const abrir = () => { if (actions.length) setSheet('acoes'); };

    return (
        <>
            <div
                className={`m-tx-row ${apagada ? 'is-muted' : ''} ${isDeleting ? 'is-deleting' : ''}`}
                role={actions.length ? 'button' : undefined}
                tabIndex={actions.length ? 0 : undefined}
                data-tipo={isCofre ? 'cofre' : tipo}
                onClick={abrir}
                onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
                }}
            >
                <span className="row-cat-icon m-tx-icon"><i className={icone} style={{ color: cor }} /></span>
                <span className={`m-tx-title ${apagada ? 'row-descricao-encerrada' : ''}`}>{t.descricao}</span>
                <span className={`row-valor m-tx-valor ${valorCls} ${apagada ? 'row-valor-encerrado' : ''}`}>{sinal} {fmtBRL(t.valor)}</span>
                <span className="m-tx-meta">{meta.join(' · ')}</span>
                <span className="m-tx-side">
                    {podeEfetivar && (
                        <button
                            type="button"
                            className="m-tx-efetivar"
                            disabled={busy}
                            onClick={(e) => { e.stopPropagation(); if (isCofre) toggleCofre(); else handleToggleStatus(); }}
                        >
                            <span className="btn-sm-pagar">Efetivar</span>
                        </button>
                    )}
                    {isEncerrada && <span className="tag tag-encerrada"><i className="fa-solid fa-ban"></i> Encerrada</span>}
                    {isArquivada && <span className="tag tag-arquivada"><i className="fa-solid fa-box-archive"></i> Arquivado</span>}
                </span>
            </div>

            {/* Sheets como irmãos da linha: o BaseModal não é portal e o clique no overlay subiria até a linha. */}
            <ActionSheet
                open={sheet === 'acoes'}
                onClose={() => setSheet(null)}
                title={t.descricao}
                subtitle={`${new Date(t.data).toLocaleDateString('pt-BR')} · ${sinal} ${fmtBRL(t.valor)}`}
                icon={icone}
                actions={actions}
            />
            <Sheet
                open={sheet === 'historico'}
                onClose={() => setSheet(null)}
                title={tipo === 'parcelada' ? 'Parcelas' : 'Histórico'}
                className="m-parcelas"
            >
                {/* O Sheet é portal no body, fora de .financas-scope: o wrapper traz os estilos das sub-linhas. */}
                <div className="financas-scope"><ParcelaSubList transacao={t} /></div>
            </Sheet>
        </>
    );
}
