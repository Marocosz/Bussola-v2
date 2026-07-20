import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { listMovimentacoes, deleteMovimentacao, toggleMovimentacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Converte "#RRGGBB" (ou "#RGB") em rgba(...) com alpha; se não parsear, cai no fallback.
function hexToRgba(hex, alpha = 1) {
  const fallback = `rgba(79,70,229,${alpha})`;
  if (typeof hex !== 'string') return fallback;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

  const cor = meta.cor || '#4f46e5';
  const chartData = {
    labels: pontos.map((p) => p.x),
    datasets: [{
      label: 'Guardado', data: pontos.map((p) => p.y),
      borderColor: cor, backgroundColor: hexToRgba(cor, 0.15),
      pointBackgroundColor: cor, pointRadius: 2, pointHoverRadius: 4,
      borderWidth: 2, tension: .3, fill: true,
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
          <Line
            data={chartData}
            options={{
              plugins: { legend: { display: false } },
              maintainAspectRatio: false,
              scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
                y: { grid: { color: 'rgba(128,128,128,.12)' }, ticks: { maxTicksLimit: 4 } },
              },
            }}
          />
        </div>
      )}

      {movs.length ? (
        <div className="meta-timeline-scroll">
          <ul className="meta-timeline">
            {movs.map((m) => {
              const isAporte = m.tipo === 'aporte';
              return (
                <li key={m.id} className={m.status === 'Pendente' ? 'pendente' : ''}>
                  <span className={`mov-icon ${isAporte ? 'is-aporte' : 'is-retirada'}`}>
                    <i className={`fa-solid ${isAporte ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                  </span>
                  <div className="mov-info">
                    <span className="mov-label">
                      {isAporte ? 'Aporte' : 'Retirada'}
                      {m.origem === 'agendado' && <span className="mov-tag">mensal</span>}
                      {m.status === 'Pendente' && <span className="mov-tag mov-tag-pendente">pendente</span>}
                    </span>
                    <span className="mov-date muted">{new Date(m.data).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <strong className={`mov-amount ${isAporte ? 'is-aporte' : 'is-retirada'}`}>
                    {isAporte ? '+' : '−'}{fmt(m.valor)}
                  </strong>
                  <div className="mov-actions">
                    {m.status === 'Pendente' && (
                      <button className="btn-action-icon btn-confirm" onClick={() => confirmar(m.id)} title="Confirmar aporte">
                        <i className="fa-solid fa-check"></i>
                      </button>
                    )}
                    <button className="btn-action-icon btn-delete" onClick={() => remove(m.id)} title="Excluir">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="meta-timeline-empty">
          <i className="fa-solid fa-clock-rotate-left"></i>
          <p>Sem movimentações ainda.</p>
          <span className="muted">Guardar ou retirar valores no cofre cria o histórico aqui.</span>
        </div>
      )}
    </div>
  );
}
