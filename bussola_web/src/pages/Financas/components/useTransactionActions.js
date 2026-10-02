import { useRef, useState } from 'react';
import { toggleStatusTransacao, deleteTransacao, stopRecorrencia } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';

/**
 * O que "excluir" significa para esta transação (mesma regra de sempre do desktop):
 * - 'pontual'   → exclusão direta;
 * - 'serie'     → série nunca efetivada: remove por completo;
 * - 'encerrar'  → tem efetivadas E pendentes: cancela as pendentes, mantém o histórico;
 * - 'bloqueado' → encerrada ou toda efetivada: nada a excluir.
 */
export function seriesDeleteMode(transacao) {
    const tipo = transacao.tipo_recorrencia || 'pontual';
    if (tipo === 'pontual') return 'pontual';
    const grupoRows = (transacao._allParcelas && transacao._allParcelas.length)
        ? transacao._allParcelas : [transacao];
    const hasEfetivada = grupoRows.some(t => t.status === 'Efetivada');
    const hasPendentes = grupoRows.some(t => t.status === 'Pendente');
    if (transacao.recorrencia_encerrada === true || (hasEfetivada && !hasPendentes)) return 'bloqueado';
    if (!hasEfetivada) return 'serie';
    return 'encerrar';
}

/** Efetivar/desmarcar e excluir/encerrar de uma linha (antes dentro do TransactionCard). */
export function useTransactionActions(transacao, onUpdate) {
    const { addToast } = useToast();
    const confirm = useConfirm();
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteMode = seriesDeleteMode(transacao);

    // O toggle é "inverte o status": um 2º toque durante a chamada desfaria o primeiro. Trava até a lista recarregar.
    const toggleBusy = useRef(false);
    const [toggling, setToggling] = useState(false);

    const handleToggleStatus = async () => {
        if (toggleBusy.current) return;
        toggleBusy.current = true;
        setToggling(true);
        try {
            await toggleStatusTransacao(transacao.id);
            await onUpdate();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        } finally {
            toggleBusy.current = false;
            setToggling(false);
        }
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

    const handleDelete = async () => {
        // Pontual: exclusão direta (lançamento manual avulso).
        if (deleteMode === 'pontual') {
            const ok = await confirm({
                title: 'Excluir transação?',
                description: 'Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.',
                confirmLabel: 'Sim, excluir', variant: 'danger',
            });
            if (!ok) return;
            await runDelete(() => deleteTransacao(transacao.id), 'Transação removida.');
            return;
        }

        // Já encerrada ou totalmente efetivada (sem pendentes): nada a fazer.
        if (deleteMode === 'bloqueado') {
            addToast({
                type: 'info', title: 'Não é possível excluir',
                description: 'Lançamentos já efetivados são histórico e não podem ser excluídos. Não há cobranças pendentes para cancelar.',
            });
            return;
        }

        // Série nunca efetivada → pode ser removida por completo.
        if (deleteMode === 'serie') {
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

    return { isDeleting, deleteMode, toggling, handleToggleStatus, handleDelete };
}
