import React, { useState } from 'react';
import { DatePicker } from '../../../components/Pickers';

/**
 * Formulário (só campos, sem wrapper de modal) para editar um aporte/retirada.
 * Reutilizado inline na timeline da meta e dentro de um BaseModal na lista de
 * Finanças. O pai fornece `onSubmit(payload)` (async: chama a API + recarrega).
 */
export function MovimentacaoEditForm({ mov, onSubmit, onCancel, compact = false }) {
  const toDateInput = (d) => {
    const s = String(d || '');
    return s.includes('T') ? s.split('T')[0] : s;
  };

  const [tipo, setTipo] = useState(mov?.tipo === 'retirada' ? 'retirada' : 'aporte');
  const [valor, setValor] = useState(mov?.valor != null ? String(mov.valor) : '');
  const [data, setData] = useState(toDateInput(mov?.data));
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(valor);
    if (!(amount > 0) || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        tipo,
        valor: amount,
        data: data ? `${data}T12:00:00` : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={`mov-edit-form ${compact ? 'mov-edit-compact' : ''}`} onSubmit={handleSubmit}>
      <div className="mov-toggle mov-edit-toggle">
        <button type="button" className={tipo === 'aporte' ? 'active' : ''} onClick={() => setTipo('aporte')}>
          <i className="fa-solid fa-plus"></i> Aporte
        </button>
        <button type="button" className={tipo === 'retirada' ? 'active' : ''} onClick={() => setTipo('retirada')}>
          <i className="fa-solid fa-minus"></i> Retirada
        </button>
      </div>

      <div className="form-row grid-50-50">
        <div className="form-group">
          <label>Valor (R$)</label>
          <input
            className="form-input"
            type="number" step="0.01" min="0" inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div className="form-group">
          <DatePicker label="Data" name="data" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      <div className="mov-edit-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!(Number(valor) > 0) || busy}>Salvar</button>
      </div>
    </form>
  );
}
