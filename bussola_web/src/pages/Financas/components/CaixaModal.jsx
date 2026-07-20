import React, { useEffect, useState } from 'react';
import { getAjustesCaixa, createAjusteCaixa, updateAjusteCaixa, deleteAjusteCaixa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';
import { BaseModal } from '../../../components/BaseModal';
import { DatePicker } from '../../../components/Pickers';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/**
 * Modal de Ajustes de Caixa: dinheiro que existe fora do mapeamento mensal do
 * Bussola (saldo inicial + injeções/correções). NÃO entra em receita/despesa
 * nem nos gráficos do mês — só compõe o Caixa (patrimônio) acumulado.
 */
export function CaixaModal({ onClose, onUpdate }) {
  const [ajustes, setAjustes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} (novo) | ajuste
  const { addToast } = useToast();
  const confirm = useConfirm();

  const load = async () => {
    try { setAjustes(await getAjustesCaixa()); }
    catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar ajustes.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saldo = ajustes.reduce((s, a) => s + (a.tipo === 'saida' ? -a.valor : a.valor), 0);

  const handleSaved = async () => { setEditing(null); await load(); onUpdate?.(); };

  const remove = async (a) => {
    const ok = await confirm({
      title: 'Excluir ajuste?',
      description: `${a.tipo === 'saida' ? 'Saída' : 'Entrada'} de ${fmt(a.valor)} será removida do seu caixa.`,
      confirmLabel: 'Sim, excluir', variant: 'danger',
    });
    if (!ok) return;
    try { await deleteAjusteCaixa(a.id); await load(); onUpdate?.(); }
    catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' }); }
  };

  return (
    <BaseModal onClose={onClose} className="modal">
      <div className="modal-content financas-scope" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3><i className="fa-solid fa-vault" style={{ marginRight: 8, color: 'var(--cor-azul-primario)' }}></i> Ajustes de Caixa</h3>
          <span className="close-btn" onClick={onClose}>&times;</span>
        </div>

        <div className="modal-body">
          <p className="caixa-hint">
            Dinheiro de antes do Bussola ou correções de saldo. Entra no seu <strong>Caixa</strong> (patrimônio),
            mas <strong>não</strong> conta como receita/despesa do mês nem aparece nos gráficos.
          </p>

          {/* Barra superior: saldo à esquerda + ação à direita, na mesma linha */}
          <div className="caixa-topbar">
            <div className="caixa-topbar-saldo">
              <span className="caixa-topbar-label">Saldo dos ajustes</span>
              <strong className={saldo >= 0 ? 'positivo' : 'negativo'}>{fmt(saldo)}</strong>
            </div>
            {!editing && (
              <button className="btn-primary" onClick={() => setEditing({})}>
                <i className="fa-solid fa-plus"></i> Novo ajuste
              </button>
            )}
          </div>

          {editing && (
            <AjusteForm
              ajuste={editing}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
              addToast={addToast}
            />
          )}

          <div className="caixa-list">
            {loading ? (
              <p className="empty-list-msg">Carregando…</p>
            ) : ajustes.length ? (
              ajustes.map(a => {
                const isEntrada = a.tipo !== 'saida';
                return (
                  <div key={a.id} className="caixa-item">
                    <span className={`caixa-item-icon ${isEntrada ? 'is-entrada' : 'is-saida'}`}>
                      <i className={`fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                    </span>
                    <div className="caixa-item-info">
                      <span className="caixa-item-title">
                        {a.observacao?.trim() ? a.observacao : (isEntrada ? 'Entrada de caixa' : 'Saída de caixa')}
                      </span>
                      <span className="caixa-item-sub muted">
                        {isEntrada ? 'Entrada' : 'Saída'} · {new Date(a.data).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <strong className={`caixa-item-valor ${isEntrada ? 'positivo' : 'negativo'}`}>
                      {isEntrada ? '+' : '−'} {fmt(a.valor)}
                    </strong>
                    <div className="caixa-item-actions">
                      <button className="btn-action-icon btn-edit" onClick={() => setEditing(a)} title="Editar">
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button className="btn-action-icon btn-delete" onClick={() => remove(a)} title="Excluir">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="caixa-empty">
                <i className="fa-solid fa-vault"></i>
                <p>Nenhum ajuste ainda.</p>
                <span className="muted">Adicione seu saldo inicial (o dinheiro que já tinha antes do Bussola).</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

function AjusteForm({ ajuste, onSaved, onCancel, addToast }) {
  const toDateInput = (d) => {
    const s = String(d || '');
    return s.includes('T') ? s.split('T')[0] : s;
  };
  const [tipo, setTipo] = useState(ajuste?.tipo === 'saida' ? 'saida' : 'entrada');
  const [valor, setValor] = useState(ajuste?.valor != null ? String(ajuste.valor) : '');
  const [data, setData] = useState(toDateInput(ajuste?.data));
  const [observacao, setObservacao] = useState(ajuste?.observacao || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(valor);
    if (!(amount > 0) || busy) return;
    setBusy(true);
    const payload = {
      tipo,
      valor: amount,
      data: data ? `${data}T12:00:00` : undefined,
      observacao: observacao.trim() || null,
    };
    try {
      if (ajuste?.id) await updateAjusteCaixa(ajuste.id, payload);
      else await createAjusteCaixa(payload);
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: 'Erro', description: err.response?.data?.detail || 'Falha ao salvar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="caixa-form" onSubmit={submit}>
      <div className="caixa-form-head">
        <span>{ajuste?.id ? 'Editar ajuste' : 'Novo ajuste'}</span>
      </div>
      <div className="mov-toggle caixa-form-toggle">
        <button type="button" className={tipo === 'entrada' ? 'active' : ''} onClick={() => setTipo('entrada')}>
          <i className="fa-solid fa-plus"></i> Entrada
        </button>
        <button type="button" className={tipo === 'saida' ? 'active' : ''} onClick={() => setTipo('saida')}>
          <i className="fa-solid fa-minus"></i> Saída
        </button>
      </div>
      <div className="form-row grid-50-50">
        <div className="form-group">
          <label>Valor (R$)</label>
          <input className="form-input" type="number" step="0.01" min="0" inputMode="decimal"
            value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" required />
        </div>
        <div className="form-group">
          <DatePicker label="Data" name="data" value={data} onChange={e => setData(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label>Descrição</label>
        <input className="form-input" value={observacao} onChange={e => setObservacao(e.target.value)}
          placeholder="Ex: saldo inicial, dinheiro na poupança…" />
      </div>
      <div className="caixa-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!(Number(valor) > 0) || busy}>Salvar</button>
      </div>
    </form>
  );
}
