import { useTransactionActions } from './useTransactionActions';
import { ParcelaSubList } from './ParcelaSubList';
import { PAG_LABEL, PAG_ICONE } from './pagamento';

export function TransactionCard({ transacao, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre, isExpanded, onToggleExpand }) {
    const { isDeleting, handleToggleStatus, handleDelete } = useTransactionActions(transacao, onUpdate);

    const isEncerrada = transacao.recorrencia_encerrada === true;
    const tipo = transacao.tipo_recorrencia || 'pontual';
    const isExpandableGroup = transacao._allParcelas && transacao._allParcelas.length > 1;

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

                {isExpanded && cofreExpandable && <ParcelaSubList transacao={transacao} />}
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

                {/* Ações — sobrepostas no fim da linha, aparecem no hover (celular: sempre visíveis) */}
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
            {isExpanded && transacao._allParcelas && <ParcelaSubList transacao={transacao} />}
        </div>
    );
}
