import { useEffect, useState } from 'react';
import { getMetasDashboard, deleteMeta } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';

export const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Estado e ações de Metas & Cofrinhos (antes dentro do MetasModal).
 * Views internas: grid | form | cofre | historico. Usado pelo MetasModal (desktop)
 * e pela aba Metas de Provisões (celular). `onUpdate` propaga saldo para a página.
 */
export function useMetasController({ onUpdate } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');       // grid | form | cofre | historico
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const { addToast } = useToast();
  const dialogConfirm = useConfirm();

  const fetchData = async ({ silent } = {}) => {
    try {
      const d = await getMetasDashboard();
      setData(d);
      // Mantém a meta selecionada sincronizada (progresso/saldo) após aportes.
      setSelectedMeta((prev) => (prev ? d.metas.find((m) => m.id === prev.id) || prev : prev));
      onUpdate?.();
      return d;
    } catch {
      if (!silent) addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar metas.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData({ silent: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resumo = data?.resumo || { disponivel: 0, guardado: 0, total: 0 };
  const metas = data?.metas || [];

  const openGrid = () => { setView('grid'); setSelectedMeta(null); setEditingData(null); };
  const openNew = () => { setEditingData(null); setView('form'); };
  const openEdit = (meta) => { setEditingData(meta); setView('form'); };
  const openCofre = (meta) => { setSelectedMeta(meta); setView('cofre'); };
  const openHistorico = () => setView('historico');

  // Back contextual: da timeline volta pro cofre (mantém a meta); senão volta pra grade.
  const goBack = () => {
    if (view === 'historico') { setView('cofre'); return; }
    openGrid();
  };

  const handleSaved = async () => { await fetchData(); openGrid(); };

  const handleDelete = async (meta) => {
    const ok = await dialogConfirm({
      title: 'Arquivar cofre?',
      description: `Os ${fmtBRL(meta.saldo_atual)} guardados em "${meta.nome}" voltam para o seu Disponível. O histórico de aportes fica salvo (arquivado) nas transações. O cofre sai da sua lista de metas.`,
      confirmLabel: 'Sim, arquivar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMeta(meta.id);
      addToast({ type: 'success', title: 'Arquivado', description: 'Cofre arquivado.' });
      await fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao arquivar.' });
    }
  };

  const title =
    view === 'form' ? (editingData ? 'Editar meta' : 'Nova meta')
    : view === 'historico' ? (selectedMeta?.nome ? `${selectedMeta.nome} · Movimentações` : 'Movimentações')
    : view === 'cofre' ? (selectedMeta?.nome || 'Cofrinho')
    : 'Metas & Cofrinhos';

  return {
    data, loading, view, selectedMeta, editingData, resumo, metas, title,
    fetchData, openGrid, openNew, openEdit, openCofre, openHistorico, goBack, handleSaved, handleDelete,
  };
}
