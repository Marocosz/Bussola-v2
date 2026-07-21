import React from 'react';
import { toggleStatusTransacao, deleteTransacao, stopRecorrencia } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

// Forma de pagamento → rótulo e ícone para o badge no card.
const PAG_LABEL = { pix: 'Pix', credito: 'Crédito', debito: 'Débito', transferencia: 'Transferência' };
const PAG_ICONE = {
    pix: 'fa-solid fa-bolt',
    credito: 'fa-solid fa-credit-card',
    debito: 'fa-solid fa-money-check-dollar',
    transferencia: 'fa-solid fa-right-left',
};

export function TransactionCard({ transacao, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre, isExpanded, onToggleExpand }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = React.useState(false);

    const isEncerrada = transacao.recorrencia_encerrada === true;
    const tipo = transacao.tipo_recorrencia || 'pontual';
    const isExpandableGroup = transacao._allParcelas && transacao._allParcelas.length > 1;

    const handleToggleStatus = async () => {
        try {
            await toggleStatusTransacao(transacao.id);
            onUpdate();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        }
    };

    const handleDelete = async () => {
        // Pontual: exclusão direta (lançamento manual avulso).
        if (tipo === 'pontual') {
            const ok = await confirm({
                title: 'Excluir transação?',
                description: 'Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.',
                confirmLabel: 'Sim, excluir', variant: 'danger',
            });
            if (!ok) return;
            await runDelete(() => deleteTransacao(transacao.id), 'Transação removida.');
            return;
        }

        // Recorrente/Parcelada: proteger histórico efetivado.
        const grupoRows = (transacao._allParcelas && transacao._allParcelas.length)
            ? transacao._allParcelas : [transacao];
        const hasEfetivada = grupoRows.some(t => t.status === 'Efetivada');
        const hasPendentes = grupoRows.some(t => t.status === 'Pendente');

        // Já encerrada ou totalmente efetivada (sem pendentes): nada a fazer.
        if (isEncerrada || (hasEfetivada && !hasPendentes)) {
            addToast({
                type: 'info', title: 'Não é possível excluir',
                description: 'Lançamentos já efetivados são histórico e não podem ser excluídos. Não há cobranças pendentes para cancelar.',
            });
            return;
        }

        // Série nunca efetivada → pode ser removida por completo.
        if (!hasEfetivada) {
            const ok = await confirm({
                title: 'Excluir série?',
                description: 'Nenhum lançamento desta série foi efetivado ainda — ela será removida por completo.',
                confirmLabel: 'Sim, excluir', variant: 'danger',
            });
            if (!ok) return;
            await runDelete(() => deleteTransacao(transacao.id), 'Série removida.');
            return;
        }

        // Tem efetivadas E pendentes → encerrar (cancela pendentes, mantém histórico).
        const ok = await confirm({
            title: 'Encerrar recorrência?',
            description: 'As próximas cobranças (pendentes) serão canceladas e o histórico já efetivado será mantido como "Encerrado". Os lançamentos efetivados não podem ser excluídos.',
            confirmLabel: 'Sim, encerrar', variant: 'warning',
        });
        if (!ok) return;
        await runDelete(() => stopRecorrencia(transacao.id), 'Cobranças futuras canceladas. Histórico mantido.', 'Série encerrada');
    };

    const runDelete = async (fn, successDesc, successTitle = 'Concluído') => {
        try {
            await fn();
            addToast({ type: 'success', title: successTitle, description: successDesc });
            setIsDeleting(true);
            setTimeout(() => onUpdate(), 450);
        } catch (error) {
            const msg = error.response?.data?.detail || 'Erro ao processar a solicitação.';
            addToast({ type: 'error', title: 'Erro', description: msg });
        }
    };

    const dateObj = new Date(transacao.data);
    const dateStr = dateObj.toLocaleDateString('pt-BR');
    const valorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transacao.valor);
    const rawTotal = transacao.valor_total_parcelamento || (transacao.valor * transacao.total_parcelas);
    const valorTotalStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rawTotal);

    // ── Linha de COFRE (transferência neutra — só exibição) ──────────────────
    if (transacao._isCofre) {
        const movs = transacao._cofreMovs || [];
        const cofreExpandable = movs.length > 1;
        const isAporte = transacao.tipo_mov === 'aporte';
        const isArquivada = transacao._cofreArquivada === true;
        const isAgendado = transacao.origem === 'agendado';
        const isPendente = transacao.status === 'Pendente';
        const fmtC = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
        return (
            <div className={`transacao-row-wrapper ${isExpanded && cofreExpandable ? 'row-wrapper-expanded' : ''}`}>
                <div className={`transacao-row transacao-row-cofre ${isArquivada ? 'row-encerrado' : ''}`}>
                    <div className="row-cells">
                        <div className="row-cat-icon">
                            <i className={transacao.categoria?.icone || 'fa-solid fa-piggy-bank'}
                               style={{ color: isArquivada ? '#9ca3af' : (transacao.categoria?.cor || 'var(--cor-azul-primario)') }} />
                        </div>
                        <div className="row-main">
                            <span className={`row-descricao ${isArquivada ? 'row-descricao-encerrada' : ''}`}>{transacao.descricao}</span>
                        </div>
                        <span className="row-categoria-nome">{transacao.categoria?.nome || '—'}</span>
                        <span className="row-data">{dateStr}</span>
                        <div className="row-tags">
                            <span className="tag tag-cofre"><i className="fa-solid fa-piggy-bank"></i> Cofre</span>
                            <span className={`tag tag-origem ${isAgendado ? 'tag-origem-auto' : ''}`}>
                                <i className={`fa-solid ${isAgendado ? 'fa-robot' : 'fa-hand'}`}></i> {isAgendado ? 'Automático' : 'Manual'}
                            </span>
                            {isArquivada && (
                                <span className="tag tag-arquivada"><i className="fa-solid fa-box-archive"></i> Arquivado</span>
                            )}
                            {isPendente && (
                                <span className="tag tag-status tag-pendente">Pendente</span>
                            )}
                        </div>
                        <div className="row-valor-cell">
                            <span className={`row-valor row-valor-cofre ${isArquivada ? 'row-valor-encerrado' : ''}`}>{isAporte ? '+' : '−'} {valorStr}</span>
                        </div>
                    </div>
                    <div className="row-actions">
                        <div className="row-actions-inner">
                            {!isArquivada && (
                                <button
                                    onClick={() => onToggleCofre && onToggleCofre(transacao)}
                                    className={isPendente ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}
                                >
                                    {isPendente ? 'Efetivar' : 'Desmarcar'}
                                </button>
                            )}
                            {!isArquivada && (
                                <button
                                    onClick={() => onEditCofre && onEditCofre(transacao)}
                                    className="btn-action-icon btn-edit-transacao"
                                    title="Editar movimentação"
                                >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                            )}
                            {/* Aporte automático já efetivado é histórico — sem excluir.
                                Manual (qualquer) e automático pendente podem ser removidos. */}
                            {!isArquivada && !(isAgendado && !isPendente) && (
                                <button
                                    onClick={() => onDeleteCofre && onDeleteCofre(transacao)}
                                    className="btn-action-icon btn-delete-transacao"
                                    title="Excluir movimentação"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            )}
                            {cofreExpandable && (
                                <button
                                    onClick={() => onToggleExpand && onToggleExpand(transacao.id)}
                                    className="btn-action-icon btn-expand-parcelas"
                                >
                                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {isExpanded && cofreExpandable && (
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
                                        {mv.tipo === 'aporte' ? '+' : '−'} {fmtC(mv.valor)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`transacao-row-wrapper ${isDeleting ? 'row-wrapper-deleting' : ''} ${isExpanded && isExpandableGroup ? 'row-wrapper-expanded' : ''}`}>
            <div className={`transacao-row ${transacao.status.toLowerCase()} ${isEncerrada ? 'row-encerrado' : ''}`}>

                {/* Células principais */}
                <div className="row-cells">

                    {/* Col 1: Ícone */}
                    <div className="row-cat-icon">
                        <i
                            className={transacao.categoria?.icone || 'fa-solid fa-question'}
                            style={{ color: isEncerrada ? '#9ca3af' : (transacao.categoria?.cor || '#aaa') }}
                        />
                    </div>

                    {/* Col 2: Título */}
                    <div className="row-main">
                        <span className={`row-descricao ${isEncerrada ? 'row-descricao-encerrada' : ''}`}>
                            {transacao.descricao}
                        </span>
                    </div>

                    {/* Col 3: Categoria */}
                    <span className="row-categoria-nome">{transacao.categoria?.nome || '—'}</span>

                    {/* Col 4: Data */}
                    <span className="row-data">{dateStr}</span>

                    {/* Col 5: Tags */}
                    <div className="row-tags">
                        {/* Tag de TIPO — permanece mesmo quando encerrada (igual Cofre+Arquivado) */}
                        {tipo === 'pontual' ? (
                            <span className="tag tag-tipo tag-pontual">Pontual</span>
                        ) : (
                            <span className={`tag tag-tipo tag-${tipo}`}>
                                {tipo === 'parcelada' ? 'Parcelada' : 'Recorrente'}
                            </span>
                        )}
                        {/* Tag de ESTADO — encerrada, ou status normal quando é série ativa */}
                        {isEncerrada ? (
                            <span className="tag tag-encerrada">
                                <i className="fa-solid fa-ban"></i> Encerrada
                            </span>
                        ) : tipo !== 'pontual' ? (
                            <span className={`tag tag-status tag-${transacao.status.toLowerCase()}`}>
                                {transacao.status}
                            </span>
                        ) : null}
                        {/* Forma de pagamento (quando informada) */}
                        {transacao.tipo_pagamento && (
                            <span className={`tag tag-pagamento tag-pag-${transacao.tipo_pagamento}`}>
                                <i className={PAG_ICONE[transacao.tipo_pagamento]}></i> {PAG_LABEL[transacao.tipo_pagamento]}
                            </span>
                        )}
                    </div>

                    {/* Col 6: Valor */}
                    <div className="row-valor-cell">
                        {tipo === 'parcelada' && transacao._allParcelas && (
                            <span className="parcela-indicator" title={`Total: ${valorTotalStr}`}>
                                {transacao.parcela_atual}/{transacao.total_parcelas}
                            </span>
                        )}
                        <span className={`row-valor ${transacao.categoria?.tipo} ${isEncerrada ? 'row-valor-encerrado' : ''}`}>
                            {transacao.categoria?.tipo === 'despesa' ? '−' : '+'} {valorStr}
                        </span>
                    </div>
                </div>

                {/* Ações — reveladas pela direita no hover */}
                <div className="row-actions">
                  <div className="row-actions-inner">
                    {tipo !== 'pontual' && !isEncerrada && (
                        <button
                            onClick={handleToggleStatus}
                            className={transacao.status === 'Pendente' ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}
                        >
                            {transacao.status === 'Pendente' ? 'Efetivar' : 'Desmarcar'}
                        </button>
                    )}
                    <button onClick={() => onEdit && onEdit(transacao)} className="btn-action-icon btn-edit-transacao">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    {/* Encerrada = histórico; não pode ser excluída (botão oculto). */}
                    {!isEncerrada && (
                        <button onClick={handleDelete} className="btn-action-icon btn-delete-transacao">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    )}
                    {isExpandableGroup && (
                        <button
                            onClick={() => onToggleExpand && onToggleExpand(transacao.id)}
                            className="btn-action-icon btn-expand-parcelas"
                        >
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                        </button>
                    )}
                  </div>
                </div>
            </div>

            {/* Sub-linhas expandidas (parcelas ou histórico recorrente) */}
            {isExpanded && transacao._allParcelas && (
                <div className="parcela-expanded-list">
                    {transacao._allParcelas.map(p => {
                        const d = new Date(p.data);
                        const isSelf = p.id === transacao.id;  // destaca a linha que foi clicada
                        const pValorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor);
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
                                    {p.categoria?.tipo === 'despesa' ? '−' : '+'} {pValorStr}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
