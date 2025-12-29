import React from 'react';
import { toggleStatusTransacao, deleteTransacao, stopRecorrencia } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

export function TransactionCard({ transacao, onUpdate, onEdit }) {
    const { addToast } = useToast();
    const confirm = useConfirm();

    // Verifica se a série foi encerrada manualmente
    const isEncerrada = transacao.recorrencia_encerrada === true;

    const handleToggleStatus = async () => {
        try {
            await toggleStatusTransacao(transacao.id);
            onUpdate();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        }
    };

    const handleDelete = async () => {
        const isRecorrente = transacao.tipo_recorrencia && transacao.tipo_recorrencia !== 'pontual';
        
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
            onUpdate();
        } catch (error) {
            const msg = error.response?.data?.detail || 'Erro ao processar a solicitação.';
            addToast({ type: 'error', title: 'Erro', description: msg });
        }
    };

    // Formatação de data e valor
    const dateObj = new Date(transacao.data);
    const dateStr = dateObj.toLocaleDateString('pt-BR');
    const valorStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transacao.valor);

    // Usa o valor total exato salvo no banco. Fallback para cálculo se for dado legado.
    const rawTotal = transacao.valor_total_parcelamento || (transacao.valor * transacao.total_parcelas);
    const valorTotalStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rawTotal);

    return (
        <div className={`transacao-card ${transacao.status.toLowerCase()} ${isEncerrada ? 'card-encerrado' : ''}`}>
            <div className="transacao-card-main">
                <div className="transacao-card-info">
                    <div className="transacao-card-top-line">
                        <h4 className="transacao-descricao" style={isEncerrada ? { opacity: 0.7, color: 'var(--cor-texto-secundario)' } : {}}>
                            {transacao.descricao}
                        </h4>
                        <span className="transacao-data">{dateStr}</span>
                    </div>
                    <div className="transacao-card-bottom-line">
                        <div className="transacao-categoria">
                            <i className={transacao.categoria?.icone || 'fa-solid fa-question'} 
                               style={{ color: isEncerrada ? '#9ca3af' : (transacao.categoria?.cor || '#fff') }}></i>
                            <span>{transacao.categoria?.nome}</span>
                        </div>
                        
                        {isEncerrada && (
                            <span className="badge-encerrado">
                                <i className="fa-solid fa-ban"></i> Encerrada
                            </span>
                        )}

                        {transacao.tipo_recorrencia === 'parcelada' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="badge-parcela">
                                    {transacao.parcela_atual}/{transacao.total_parcelas}
                                </span>
                                {!isEncerrada && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-secundario)', fontStyle: 'italic' }}>
                                        Total: {valorTotalStr}
                                    </span>
                                )}
                            </div>
                        )}

                        {transacao.tipo_recorrencia === 'recorrente' && (
                            <span className="badge-recorrente">{transacao.frequencia}</span>
                        )}
                    </div>
                </div>
                <div className={`transacao-valor ${transacao.categoria?.tipo}`}>
                    {transacao.categoria?.tipo === 'despesa' ? '- ' : '+ '}{valorStr}
                </div>
            </div>
            <div className="transacao-footer">
                <span className={`status-badge ${transacao.status.toLowerCase()}`}>{transacao.status}</span>
                <div className="transacao-actions">
                    
                    {transacao.tipo_recorrencia !== 'pontual' && !isEncerrada && (
                        <button onClick={handleToggleStatus} className={transacao.status === 'Pendente' ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}>
                            {transacao.status === 'Pendente' ? 'Efetivar' : 'Desmarcar'}
                        </button>
                    )}
                    
                    <button 
                        onClick={() => onEdit && onEdit(transacao)} 
                        className="btn-action-icon btn-edit-transacao"
                    >
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>

                    <button onClick={handleDelete} className="btn-action-icon btn-delete-transacao">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}