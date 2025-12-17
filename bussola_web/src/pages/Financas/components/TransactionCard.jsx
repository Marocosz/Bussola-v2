import React from 'react';
import { toggleStatusTransacao, deleteTransacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext'; // <--- Import Novo

// Adicionei a prop onEdit aqui
export function TransactionCard({ transacao, onUpdate, onEdit }) {
    const { addToast } = useToast();
    const confirm = useConfirm(); // <--- Hook Novo

    const handleToggleStatus = async () => {
        try {
            await toggleStatusTransacao(transacao.id);
            onUpdate();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        }
    };

    const handleDelete = async () => {
        // --- SUBSTITUIÇÃO DO CONFIRM NATIVO ---
        const isConfirmed = await confirm({
            title: 'Excluir Transação?',
            description: 'Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.',
            confirmLabel: 'Excluir',
            variant: 'danger'
        });

        if (!isConfirmed) return;
        // --------------------------------------

        try {
            await deleteTransacao(transacao.id);
            addToast({ type: 'success', title: 'Excluído', description: 'Transação removida.' });
            onUpdate();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao excluir.' });
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
        <div className={`transacao-card ${transacao.status.toLowerCase()}`}>
            <div className="transacao-card-main">
                <div className="transacao-card-info">
                    <div className="transacao-card-top-line">
                        <h4 className="transacao-descricao">{transacao.descricao}</h4>
                        <span className="transacao-data">{dateStr}</span>
                    </div>
                    <div className="transacao-card-bottom-line">
                        <div className="transacao-categoria">
                            <i className={transacao.categoria?.icone || 'fa-solid fa-question'} 
                               style={{ color: transacao.categoria?.cor || '#fff' }}></i>
                            <span>{transacao.categoria?.nome}</span>
                        </div>
                        
                        {transacao.tipo_recorrencia === 'parcelada' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="badge-parcela">
                                    {transacao.parcela_atual}/{transacao.total_parcelas}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-secundario)', fontStyle: 'italic' }}>
                                    Total: {valorTotalStr}
                                </span>
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
                    {/* Botão Efetivar/Desmarcar (apenas se não for pontual) */}
                    {transacao.tipo_recorrencia !== 'pontual' && (
                        <button onClick={handleToggleStatus} className={transacao.status === 'Pendente' ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}>
                            {transacao.status === 'Pendente' ? 'Efetivar' : 'Desmarcar'}
                        </button>
                    )}
                    
                    {/* --- NOVO BOTÃO DE EDITAR --- */}
                    {/* Passamos o objeto transacao para a função onEdit */}
                    <button onClick={() => onEdit && onEdit(transacao)} className="btn-action-icon btn-edit-transacao">
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