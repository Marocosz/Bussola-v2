import React from 'react';
import { toggleStatusTransacao, deleteTransacao, stopRecorrencia } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

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
        const isRecorrente = tipo !== 'pontual';
        const dialogConfig = isRecorrente
            ? {
                title: 'Encerrar Recorrência?',
                description: 'Deseja encerrar esta série? O histórico pago será mantido como "Encerrado" e cobranças futuras serão canceladas.',
                confirmLabel: 'Sim, encerrar',
                variant: 'warning'
              }
            : {
                title: 'Excluir Transação?',
                description: 'Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.',
                confirmLabel: 'Sim, excluir',
                variant: 'danger'
              };

        const isConfirmed = await confirm(dialogConfig);
        if (!isConfirmed) return;

        try {
            if (isRecorrente) {
                await stopRecorrencia(transacao.id);
                addToast({ type: 'success', title: 'Série Encerrada', description: 'Cobranças futuras removidas. Histórico mantido.' });
            } else {
                await deleteTransacao(transacao.id);
                addToast({ type: 'success', title: 'Excluído', description: 'Transação removida.' });
            }
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
                            {!isArquivada && (
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
                    <button onClick={handleDelete} className="btn-action-icon btn-delete-transacao">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
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
