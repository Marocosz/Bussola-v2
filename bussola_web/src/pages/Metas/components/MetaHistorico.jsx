import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { listMovimentacoes, deleteMovimentacao, toggleMovimentacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Fora do componente: react-hooks/immutability (React Compiler) proíbe reatribuir
// variável local dentro do corpo de render; um acumulador simples aqui é seguro.
function computePontos(efetivadas) {
  let acc = 0;
  return efetivadas.map((m) => {
    acc += m.tipo === 'aporte' ? m.valor : -m.valor;
    return { x: new Date(m.data).toLocaleDateString('pt-BR'), y: Number(acc.toFixed(2)) };
  });
}

export function MetaHistorico({ meta, onChange }) {
  const [movs, setMovs] = useState([]);
  const { addToast } = useToast();

  const load = async () => {
    try { setMovs(await listMovimentacoes(meta.id)); } catch { /* ignore */ }
  };

  // Efeito de carga inicial contido no próprio efeito (não referencia `load` de fora):
  // evita o falso-positivo do react-hooks/set-state-in-effect (React Compiler) que
  // sinaliza setState alcançável a partir do corpo do efeito quando a função vem do
  // escopo externo do componente — mesmo padrão usado em Panorama/index.jsx.
  useEffect(() => {
    async function loadOnMount() {
      try { setMovs(await listMovimentacoes(meta.id)); } catch { /* ignore */ }
    }
    loadOnMount();
  }, [meta.id]);

  const efetivadas = [...movs].filter((m) => m.status === 'Efetivada')
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  const pontos = computePontos(efetivadas);

  const chartData = {
    labels: pontos.map((p) => p.x),
    datasets: [{
      label: 'Guardado', data: pontos.map((p) => p.y),
      borderColor: meta.cor || '#4f46e5', backgroundColor: 'rgba(79,70,229,.15)', tension: .3, fill: true,
    }],
  };

  const remove = async (id) => {
    try { await deleteMovimentacao(meta.id, id); await load(); onChange?.(); }
    catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao excluir.' }); }
  };

  const confirmar = async (id) => {
    try { await toggleMovimentacao(meta.id, id); await load(); onChange?.(); }
    catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao confirmar aporte.' }); }
  };

  return (
    <div className="meta-historico">
      {pontos.length > 1 && (
        <div className="meta-chart">
          <Line data={chartData} options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }} />
        </div>
      )}
      <ul className="meta-timeline">
        {movs.map((m) => (
          <li key={m.id} className={m.status === 'Pendente' ? 'pendente' : ''}>
            <i className={`fa-solid ${m.tipo === 'aporte' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
            <span>{m.tipo === 'aporte' ? 'Aporte' : 'Retirada'} {m.origem === 'agendado' ? '(mensal)' : ''}</span>
            <strong>{fmt(m.valor)}</strong>
            <span className="muted">{new Date(m.data).toLocaleDateString('pt-BR')}</span>
            {m.status === 'Pendente' && (
              <button className="btn-action-icon btn-confirm" onClick={() => confirmar(m.id)} title="Confirmar aporte">
                <i className="fa-solid fa-check"></i>
              </button>
            )}
            <button className="btn-action-icon btn-delete" onClick={() => remove(m.id)} title="Excluir"><i className="fa-solid fa-xmark"></i></button>
          </li>
        ))}
        {!movs.length && <li className="muted">Sem movimentações ainda.</li>}
      </ul>
    </div>
  );
}
