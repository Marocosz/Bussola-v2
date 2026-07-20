import React, { useEffect, useState } from 'react';
import { getMetasDashboard } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './styles.css';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function Metas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

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

      {loading ? (
        <p className="empty-list-msg">Carregando metas...</p>
      ) : (data?.metas?.length ? (
        <div className="metas-grid">
          {data.metas.map((m) => (
            <div key={m.id} className="meta-card-placeholder">{m.nome} — {fmt(m.saldo_atual)} / {fmt(m.valor_alvo)}</div>
          ))}
        </div>
      ) : (
        <p className="empty-list-msg">Nenhuma meta ainda. Crie seu primeiro cofrinho!</p>
      ))}
    </div>
  );
}
