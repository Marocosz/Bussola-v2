import React from 'react';
import { useNavigate } from 'react-router-dom';

const ICON = {
  financas: 'fa-solid fa-wallet',
  metas: 'fa-solid fa-piggy-bank',
  agenda: 'fa-regular fa-calendar',
};

/**
 * Faixa "Atenção agora": traduz os insights determinísticos do backend em
 * cartões acionáveis. Vazio → nada é renderizado (sem ruído).
 */
export function AttentionStrip({ insights = [] }) {
  const navigate = useNavigate();
  if (!insights.length) return null;
  return (
    <div className="attention-strip">
      {insights.map((it) => (
        <button
          key={it.id}
          className={`attention-card sev-${it.severidade}`}
          onClick={() => it.acao && navigate(it.acao)}
          title={it.detalhe || ''}
        >
          <span className="attention-icon"><i className={ICON[it.tipo] || 'fa-solid fa-circle-info'}></i></span>
          <span className="attention-text">
            <strong>{it.titulo}</strong>
            {it.detalhe && <span className="attention-detail">{it.detalhe}</span>}
          </span>
          {it.acao && <i className="fa-solid fa-chevron-right attention-arrow"></i>}
        </button>
      ))}
    </div>
  );
}
