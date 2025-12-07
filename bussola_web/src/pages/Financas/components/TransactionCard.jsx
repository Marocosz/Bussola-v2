import React from 'react';
import { toggleStatusTransacao, deleteTransacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function TransactionCard({ transacao, onUpdate }) {
    const { addToast } = useToast();

    const handleToggleStatus = async () => {
        try {
            await toggleStatusTransacao(transacao.id);
            onUpdate(); // Recarrega os dados
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        }
    };

    const handleDelete = async () => {
        if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
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
                            <span className="badge-parcela">{transacao.parcela_atual}/{transacao.total_parcelas}</span>
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
                    <button onClick={handleToggleStatus} className={transacao.status === 'Pendente' ? 'btn-sm-pagar' : 'btn-sm-desmarcar'}>
                        {transacao.status === 'Pendente' ? 'Efetivar' : 'Desmarcar'}
                    </button>
                    <button onClick={handleDelete} className="btn-action-icon btn-delete-transacao">
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}