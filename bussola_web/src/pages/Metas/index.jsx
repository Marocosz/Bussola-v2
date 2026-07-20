import React, { useEffect, useState } from 'react';
import { getMetasDashboard, deleteMeta } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { MetaCard } from './components/MetaCard';
import { MetaModals } from './components/MetaModals';
import { CofreScene } from './CofreScene';
import './styles.css';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function Metas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const { addToast } = useToast();
  const dialogConfirm = useConfirm();

  const fetchData = async () => {
    try {
      setData(await getMetasDashboard());
    } catch {
      addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar metas.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  const handleNew = () => { setEditingData(null); setActiveModal('meta'); };
  const handleEdit = (meta) => { setEditingData(meta); setActiveModal('meta'); };
  const handleOpenCofre = (meta) => { setSelectedMeta(meta); setActiveModal('movimentacao'); };
  const handleCloseModal = () => { setActiveModal(null); setEditingData(null); setSelectedMeta(null); };

  const handleDelete = async (meta) => {
    const ok = await dialogConfirm({
      title: 'Excluir meta?',
      description: `O valor guardado em "${meta.nome}" volta a ficar disponível. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Sim, excluir',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMeta(meta.id);
      addToast({ type: 'success', title: 'Removida', description: 'Meta excluída.' });
      fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao excluir.' });
    }
  };

  const resumo = data?.resumo || { disponivel: 0, guardado: 0, total: 0 };

  return (
    <div className="container main-container metas-scope">
      <div className="page-header">
        <div className="page-header-main">
          <h1><i className="fa-solid fa-piggy-bank"></i> Metas & Cofrinhos</h1>
        </div>
        <div className="page-header-kpis">
          <span className="ph-kpi positivo"><i className="fa-solid fa-wallet"></i> Disponível {fmt(resumo.disponivel)}</span>
          <span className="ph-kpi guardado"><i className="fa-solid fa-piggy-bank"></i> Guardado {fmt(resumo.guardado)}</span>
          <span className="ph-kpi"><i className="fa-solid fa-scale-balanced"></i> Total {fmt(resumo.total)}</span>
        </div>
      </div>

      <div className="metas-toolbar">
        <button className="btn-primary" onClick={handleNew}><i className="fa-solid fa-plus"></i> Nova meta</button>
      </div>

      {loading ? (
        <p className="empty-list-msg">Carregando metas...</p>
      ) : (data?.metas?.length ? (
        <div className="metas-grid">
          {data.metas.map((m) => (
            <MetaCard key={m.id} meta={m} onOpen={handleOpenCofre} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <p className="empty-list-msg">Nenhuma meta ainda. Crie seu primeiro cofrinho!</p>
      ))}

      <MetaModals activeModal={activeModal} closeModal={handleCloseModal} onUpdate={fetchData} editingData={editingData} />
      {activeModal === 'movimentacao' && selectedMeta && (
        <CofreScene key={selectedMeta.id} meta={selectedMeta} closeModal={handleCloseModal} onUpdate={fetchData} />
      )}
    </div>
  );
}
