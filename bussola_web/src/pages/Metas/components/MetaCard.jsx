import React from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function MetaCard({ meta, onOpen, onEdit, onDelete }) {
  const pct = meta.progresso_pct ?? 0;
  return (
    <div className="meta-card" style={{ '--meta-cor': meta.cor || '#4f46e5' }}>
      <div className="meta-card-head" onClick={() => onOpen(meta)}>
        <div className="meta-card-icon"><i className={meta.icone || 'fa-solid fa-piggy-bank'}></i></div>
        <div className="meta-card-title">
          <strong>{meta.nome}</strong>
          {meta.trancada && <i className="fa-solid fa-lock" title="Trancada" style={{ marginLeft: 6, opacity: .7 }}></i>}
          {meta.status === 'concluida' && <span className="meta-badge-done">Concluída 🎉</span>}
        </div>
      </div>

      <div className="meta-progress">
        <div className="meta-progress-bar"><span style={{ width: `${pct}%` }} /></div>
        <div className="meta-progress-labels">
          <span>{fmt(meta.saldo_atual)}</span>
          <span className="muted">/ {fmt(meta.valor_alvo)} · {pct}%</span>
        </div>
      </div>

      {meta.data_projetada && (
        <div className="meta-proj muted">
          <i className="fa-solid fa-flag-checkered"></i> Projeção: {new Date(meta.data_projetada).toLocaleDateString('pt-BR')}
        </div>
      )}

      <div className="meta-card-actions">
        <button className="btn-primary" onClick={() => onOpen(meta)}><i className="fa-solid fa-hand-holding-dollar"></i> Guardar</button>
        <button className="btn-action-icon btn-edit" onClick={() => onEdit(meta)} title="Editar"><i className="fa-solid fa-pen"></i></button>
        <button className="btn-action-icon btn-delete" onClick={() => onDelete(meta)} title="Excluir"><i className="fa-solid fa-trash"></i></button>
      </div>
    </div>
  );
}
