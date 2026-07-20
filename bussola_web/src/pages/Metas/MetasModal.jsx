import React, { useEffect, useState } from 'react';
import { getMetasDashboard, deleteMeta } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { BaseModal } from '../../components/BaseModal';
import { MetaCard } from './components/MetaCard';
import { MetaForm } from './components/MetaForm';
import { CofreScene } from './CofreScene';
import { MetaHistorico } from './components/MetaHistorico';
import './styles.css';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Modal grande de Metas & Cofrinhos, aberto a partir da página de Provisões.
 * Navega por "views" internas (grade / cofre / form) — sem modais aninhados.
 * `onUpdate` propaga mudanças de saldo de volta para a página de Provisões.
 */
export function MetasModal({ onClose, onUpdate }) {
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

  // Back contextual: da timeline volta pro cofre (mantém a meta); senão volta pra grade.
  const goBack = () => {
    if (view === 'historico') { setView('cofre'); return; }
    openGrid();
  };

  const handleSaved = async () => { await fetchData(); openGrid(); };

  const handleDelete = async (meta) => {
    const ok = await dialogConfirm({
      title: 'Arquivar cofre?',
      description: `Os ${fmt(meta.saldo_atual)} guardados em "${meta.nome}" voltam para o seu Disponível. O histórico de aportes fica salvo (arquivado) nas transações. O cofre sai da sua lista de metas.`,
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

  return (
    <BaseModal onClose={onClose} className="modal metas-modal-overlay">
      <div className="modal-content metas-modal metas-scope" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header metas-modal-header">
          {view !== 'grid' && (
            <button type="button" className="metas-back-btn" onClick={goBack} title="Voltar">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}
          <h3>
            {view === 'grid' && <i className="fa-solid fa-piggy-bank" style={{ marginRight: 8, color: 'var(--cor-azul-primario)' }}></i>}
            {title}
          </h3>
          <span className="close-btn" onClick={onClose}>&times;</span>
        </div>

        {view === 'grid' && (
          <div className="modal-body metas-grid-body">
            <div className="metas-kpis">
              <span className="ph-kpi positivo" title="Dinheiro livre pra gastar (Total − Guardado). Guardar numa meta reduz o disponível, mas não é gasto.">
                <i className="fa-solid fa-wallet"></i> Disponível {fmt(resumo.disponivel)}
              </span>
              <span className="ph-kpi guardado" title="Reservado nas suas metas/cofrinhos. Continua sendo seu — só saiu do disponível.">
                <i className="fa-solid fa-piggy-bank"></i> Guardado {fmt(resumo.guardado)}
              </span>
              <span className="ph-kpi" title="Seu patrimônio (receitas − despesas). Guardar NÃO muda o total; só move do disponível pro guardado.">
                <i className="fa-solid fa-scale-balanced"></i> Total {fmt(resumo.total)}
              </span>
              <span className="metas-kpis-info" title="Guardar em metas é uma transferência: sai do Disponível e vai pro Guardado, mas o Total (patrimônio) não muda e não conta como gasto. O patrimônio só diminui quando você realmente gastar o objetivo.">
                <i className="fa-solid fa-circle-info"></i>
              </span>
            </div>

            <div className="metas-toolbar">
              <button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> Nova meta</button>
            </div>

            {loading ? (
              <p className="empty-list-msg">Carregando metas…</p>
            ) : metas.length ? (
              <div className="metas-grid">
                {metas.map((m) => (
                  <MetaCard key={m.id} meta={m} onOpen={openCofre} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            ) : (
              <div className="metas-empty">
                <i className="fa-solid fa-piggy-bank"></i>
                <p>Nenhum cofrinho ainda.</p>
                <button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> Criar primeira meta</button>
              </div>
            )}
          </div>
        )}

        {view === 'form' && (
          <MetaForm
            editingData={editingData}
            iconesDisponiveis={data?.icones_disponiveis || []}
            coresDisponiveis={data?.cores_disponiveis || []}
            onSaved={handleSaved}
            onCancel={openGrid}
          />
        )}

        {view === 'cofre' && selectedMeta && (
          <CofreScene
            meta={selectedMeta}
            onUpdate={fetchData}
            onOpenHistorico={() => setView('historico')}
          />
        )}

        {view === 'historico' && selectedMeta && (
          <div className="modal-body metas-historico-body">
            <MetaHistorico meta={selectedMeta} onChange={fetchData} />
          </div>
        )}
      </div>
    </BaseModal>
  );
}
