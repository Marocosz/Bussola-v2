import React, { useState, useEffect, useRef } from 'react';
import { createMeta, updateMeta } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { DatePicker } from '../../../components/Pickers';

const buildForm = (m) => ({
  nome: m?.nome || '',
  valor_alvo: m?.valor_alvo || '',
  data_alvo: m?.data_alvo ? String(m.data_alvo).slice(0, 10) : '',
  icone: m?.icone || 'fa-solid fa-piggy-bank',
  cor: m?.cor || '#4A6DFF',
  trancada: !!m?.trancada,
  aporte_mensal_valor: m?.aporte_mensal_valor || '',
  aporte_mensal_dia: m?.aporte_mensal_dia || '',
});

/**
 * Formulário de criar/editar meta — conteúdo puro (sem BaseModal).
 * Renderizado como uma "view" dentro do MetasModal. Segue o mesmo padrão de
 * campos/pickers do FinancasModals (form-input, picker-wrapper, DatePicker).
 */
export function MetaForm({ editingData, iconesDisponiveis = [], coresDisponiveis = [], onSaved, onCancel }) {
  const [form, setForm] = useState(() => buildForm(editingData));
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const iconRef = useRef(null);
  const colorRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    const handler = (e) => {
      if (iconRef.current && !iconRef.current.contains(e.target)) setShowIconPicker(false);
      if (colorRef.current && !colorRef.current.contains(e.target)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
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
      onSaved?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="form-row grid-60-40">
          <div className="form-group">
            <label>Nome da meta</label>
            <input className="form-input" value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex: Comprar carro" required />
          </div>
          <div className="form-group">
            <label>Valor-alvo (R$)</label>
            <input className="form-input" type="number" step="0.01" min="0.01" value={form.valor_alvo} onChange={(e) => set({ valor_alvo: e.target.value })} placeholder="50000" required />
          </div>
        </div>

        <div className="form-row grid-meta-icon-color">
          <div className="form-group">
            <DatePicker
              label="Data-alvo (opcional)"
              name="data_alvo"
              value={form.data_alvo}
              onChange={(e) => set({ data_alvo: e.target.value })}
              placeholder="Sem prazo"
            />
          </div>

          <div className="form-group form-group-fixed">
            <label>Ícone</label>
            <div className="picker-wrapper" ref={iconRef}>
              <div className="picker-preview" onClick={() => { setShowIconPicker((v) => !v); setShowColorPicker(false); }}>
                <i className={form.icone || 'fa-solid fa-piggy-bank'} style={{ color: form.cor }}></i>
              </div>
              {showIconPicker && (
                <div className="picker-popover icon-grid visible">
                  {iconesDisponiveis.map((icon) => (
                    <div key={icon} className="icon-option" onClick={() => { set({ icone: icon }); setShowIconPicker(false); }}>
                      <i className={icon}></i>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group form-group-fixed">
            <label>Cor</label>
            <div className="picker-wrapper" ref={colorRef}>
              <div className="picker-preview" onClick={() => { setShowColorPicker((v) => !v); setShowIconPicker(false); }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: form.cor }}></div>
              </div>
              {showColorPicker && (
                <div className="picker-popover color-grid visible">
                  {coresDisponiveis.map((cor) => (
                    <div key={cor} className="color-swatch" style={{ backgroundColor: cor }} onClick={() => { set({ cor }); setShowColorPicker(false); }}></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-row grid-50-50">
          <div className="form-group">
            <label>Aporte mensal (R$)</label>
            <input className="form-input" type="number" step="0.01" min="0" value={form.aporte_mensal_valor} onChange={(e) => set({ aporte_mensal_valor: e.target.value })} placeholder="Opcional — ex: 500" />
          </div>
          <div className="form-group">
            <label>Dia do mês</label>
            <input className="form-input" type="number" min="1" max="28" value={form.aporte_mensal_dia} onChange={(e) => set({ aporte_mensal_dia: e.target.value })} placeholder="1–28" />
          </div>
        </div>

        <label className="meta-check-row">
          <input type="checkbox" checked={form.trancada} onChange={(e) => set({ trancada: e.target.checked })} />
          <span><i className="fa-solid fa-lock"></i> Trancar cofrinho — bloqueia retiradas até atingir o alvo ou a data</span>
        </label>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar meta'}</button>
      </div>
    </form>
  );
}
