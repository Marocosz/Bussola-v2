import React from 'react';
import { toggleStatusTransacao, deleteTransacao, stopRecorrencia } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

export function TransactionCard({ transacao, onUpdate, onEdit, isExpanded, onToggleExpand }) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = React.useState(false);

    const isEncerrada = transacao.recorrencia_encerrada === true;
    const tipo = transacao.tipo_recorrencia || 'pontual';
    const isParceladaGroup = tipo === 'parcelada' && transacao._allParcelas && transacao._allParcelas.length > 1;

    const handleToggleStatus = async () => {
        try {
            await toggleStatusTransacao(transacao.id);
            onUpdate();
        } catch (error) {
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

    const today = new Date();

    return (
        <div className={`transacao-row-wrapper ${isDeleting ? 'row-wrapper-deleting' : ''}`}>
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
                        {isEncerrada ? (
                            <span className="tag tag-encerrada">
                                <i className="fa-solid fa-ban"></i> Encerrada
                            </span>
                        ) : tipo === 'pontual' ? (
                            <span className="tag tag-tipo tag-pontual">Pontual</span>
                        ) : (
                            <>
                                <span className={`tag tag-tipo tag-${tipo}`}>
                                    {tipo === 'parcelada' ? 'Parcelada' : 'Recorrente'}
                                </span>
                                <span className={`tag tag-status tag-${transacao.status.toLowerCase()}`}>
                                    {transacao.status}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Col 6: Valor */}
                    <div className="row-valor-cell">
                        {isParceladaGroup && (
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
                    {isParceladaGroup && (
                        <button
                            onClick={() => onToggleExpand && onToggleExpand(transacao.id_grupo_recorrencia)}
                            className="btn-action-icon btn-expand-parcelas"
                        >
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                        </button>
                    )}
                  </div>
                </div>
            </div>

            {/* Sub-linhas de parcelas expandidas */}
            {isExpanded && transacao._allParcelas && (
                <div className="parcela-expanded-list">
                    {transacao._allParcelas.map(p => {
                        const d = new Date(p.data);
                        const isCurrentMonth = d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                        const pValorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor);
                        return (
                            <div key={p.id} className={`parcela-sub-row ${isCurrentMonth ? 'parcela-sub-current' : ''}`}>
                                <span className="parcela-sub-num">{p.parcela_atual}/{p.total_parcelas}</span>
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
