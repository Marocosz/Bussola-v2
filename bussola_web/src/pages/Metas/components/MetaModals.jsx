import React, { useState } from 'react';
import { createMeta, updateMeta } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';

const EMPTY = { nome: '', valor_alvo: '', data_alvo: '', icone: 'fa-solid fa-piggy-bank', cor: '#4f46e5', trancada: false, aporte_mensal_valor: '', aporte_mensal_dia: '' };

const buildForm = (editingData) => editingData ? {
  nome: editingData.nome || '',
  valor_alvo: editingData.valor_alvo || '',
  data_alvo: editingData.data_alvo ? String(editingData.data_alvo).slice(0, 10) : '',
  icone: editingData.icone || 'fa-solid fa-piggy-bank',
  cor: editingData.cor || '#4f46e5',
  trancada: !!editingData.trancada,
  aporte_mensal_valor: editingData.aporte_mensal_valor || '',
  aporte_mensal_dia: editingData.aporte_mensal_dia || '',
} : EMPTY;

export function MetaModals({ activeModal, closeModal, onUpdate, editingData }) {
  const [form, setForm] = useState(EMPTY);
  // Rastreia a última transição de activeModal para re-popular o form a cada abertura
  // (substitui um useEffect+setState, evitando o render extra que a regra
  // react-hooks/set-state-in-effect sinaliza).
  const [prevActiveModal, setPrevActiveModal] = useState(null);
  const { addToast } = useToast();

  if (activeModal !== prevActiveModal) {
    setPrevActiveModal(activeModal);
    if (activeModal === 'meta') {
      setForm(buildForm(editingData));
    }
  }

  if (activeModal !== 'meta') return null;

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      valor_alvo: Number(form.valor_alvo),
      data_alvo: form.data_alvo || null,
      icone: form.icone,
      cor: form.cor,
      trancada: form.trancada,
      aporte_mensal_valor: form.aporte_mensal_valor ? Number(form.aporte_mensal_valor) : null,
      aporte_mensal_dia: form.aporte_mensal_dia ? Number(form.aporte_mensal_dia) : null,
    };
    try {
      if (editingData) await updateMeta(editingData.id, payload);
      else await createMeta(payload);
      addToast({ type: 'success', title: 'Pronto', description: 'Meta salva.' });
      onUpdate();
      closeModal();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao salvar.' });
    }
  };

  return (
    <BaseModal onClose={closeModal} className="modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingData ? 'Editar meta' : 'Nova meta'}</h2>
          <span className="close-btn" onClick={closeModal}>&times;</span>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Nome</label>
                <input className="form-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
            </div>
            <div className="form-row grid-50-50">
              <div className="form-group">
                <label>Valor-alvo (R$)</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.valor_alvo} onChange={(e) => setForm({ ...form, valor_alvo: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Data-alvo (opcional)</label>
                <input className="form-input" type="date" value={form.data_alvo} onChange={(e) => setForm({ ...form, data_alvo: e.target.value })} />
              </div>
            </div>
            <div className="form-row grid-50-50">
              <div className="form-group">
                <label>Cor</label>
                <input className="form-input" type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="meta-check">
                  <input type="checkbox" checked={form.trancada} onChange={(e) => setForm({ ...form, trancada: e.target.checked })} />
                  Trancar (bloqueia retirada)
                </label>
              </div>
            </div>
            <div className="form-row grid-50-50">
              <div className="form-group">
                <label>Aporte mensal (R$) — opcional</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.aporte_mensal_valor}
                  onChange={(e) => setForm({ ...form, aporte_mensal_valor: e.target.value })} placeholder="Ex: 500" />
              </div>
              <div className="form-group">
                <label>Dia do mês (1–28)</label>
                <input className="form-input" type="number" min="1" max="28" value={form.aporte_mensal_dia}
                  onChange={(e) => setForm({ ...form, aporte_mensal_dia: e.target.value })} placeholder="Ex: 5" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
}
