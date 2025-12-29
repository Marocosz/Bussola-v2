import React from 'react';
// [CORREÇÃO]: Importado stopRecorrencia para lidar com o encerramento de séries
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

    // [CORREÇÃO LÓGICA]: Implementada verificação de tipo para decidir entre DELETE ou STOP
    const handleDelete = async () => {
        const isRecorrente = transacao.tipo_recorrencia && transacao.tipo_recorrencia !== 'pontual';
        
        // Define o texto e estilo do modal baseado no tipo
        const dialogConfig = isRecorrente 
            ? {
                title: 'Encerrar Recorrência?',
                description: 'Deseja encerrar esta série? O histórico pago será mantido como "Encerrado" e cobranças futuras serão canceladas.',
                confirmLabel: 'Sim, encerrar',
                variant: 'warning' // Amarelo: Atenção (mantém passado)
              }
            : {
                title: 'Excluir Transação?',
                description: 'Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.',
                confirmLabel: 'Sim, excluir',
                variant: 'danger' // Vermelho: Destruição total
              };

        const isConfirmed = await confirm(dialogConfig);
        if (!isConfirmed) return;

        try {
            if (isRecorrente) {
                // Rota STOP: Encerra recorrência, mantém histórico (flag recorrencia_encerrada=True)
                await stopRecorrencia(transacao.id);
                addToast({ type: 'success', title: 'Série Encerrada', description: 'Cobranças futuras removidas. Histórico mantido.' });
            } else {
                // Rota DELETE: Apaga o registro do banco (Pontual)
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

    // Cálculo do valor total para parcelados
    const valorTotalParcelado = transacao.tipo_recorrencia === 'parcelada' 
        ? transacao.valor * transacao.total_parcelas 
        : 0;
    const valorTotalStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalParcelado);

    return (
        <div className={`transacao-card ${transacao.status.toLowerCase()} ${isEncerrada ? 'card-encerrado' : ''}`}>
            <div className="transacao-card-main">
                <div className="transacao-card-info">
                    <div className="transacao-card-top-line">
                        <h4 className="transacao-descricao" style={isEncerrada ? { textDecoration: 'line-through', opacity: 0.7 } : {}}>
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
                        
                        {/* Indicador de Série Encerrada */}
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
                    {/* Botão Efetivar/Desmarcar (apenas se não for pontual e NÃO estiver encerrada) */}
                    {transacao.tipo_recorrencia !== 'pontual' && !isEncerrada && (
                        <button onClick={handleToggleStatus} className={transacao.status === 'Pendente' ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}>
                            {transacao.status === 'Pendente' ? 'Efetivar' : 'Desmarcar'}
                        </button>
                    )}
                    
                    {/* Botão de Editar (Desabilitado se encerrado, opcional) */}
                    <button 
                        onClick={() => onEdit && onEdit(transacao)} 
                        className="btn-action-icon btn-edit-transacao"
                        disabled={isEncerrada}
                        style={isEncerrada ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>

                    {/* Botão Excluir */}
                    <button onClick={handleDelete} className="btn-action-icon btn-delete-transacao">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}