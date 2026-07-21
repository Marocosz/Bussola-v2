import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPanoramaData } from '../../services/api';
import { logger } from '../../utils/logger';
import { useToast } from '../../context/ToastContext';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { computeRange } from '../../utils/dateRange';
import './styles.css';
import './panorama-v2.css';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n) => (n > 0 ? '+' : '') + (n || 0).toFixed(1).replace('.', ',') + '%';
const fmtMonth = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; };
const fmtDateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

const SEV = {
  perigo: { bg: 'rgba(231,76,60,.15)', c: 'var(--red)', label: 'Perigo' },
  aviso: { bg: 'rgba(243,156,18,.15)', c: 'var(--orange)', label: 'Aviso' },
  info: { bg: 'rgba(74,109,255,.15)', c: 'var(--blue)', label: 'Info' },
};
const insightIcon = (it) => it.severidade === 'perigo' ? 'fa-solid fa-triangle-exclamation' : it.severidade === 'aviso' ? 'fa-solid fa-clock' : 'fa-solid fa-circle-info';

// Dispensar/snooze de alertas: guarda id → timestamp de expiração (24h) no localStorage.
const DISMISS_KEY = 'panorama_dismissed';
const DISMISS_MS = 24 * 60 * 60 * 1000;
function loadDismissed() {
  try {
    const o = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    const now = Date.now();
    const clean = {};
    Object.entries(o).forEach(([k, v]) => { if (v > now) clean[k] = v; });
    return clean;
  } catch { return {}; }
}

// ---------- Charts (SVG inline, na estética do design) ----------
// Reservatório do herói — CUBO 3D ISOMÉTRICO de vidro (topo + 2 lados) com líquido.
function Reservoir({ total, disp, guard, cap, startLevel = 0 }) {
  const cx = 100, topY = 46, wx = 78, wy = 39, h = 138;
  const f = Math.max(0, Math.min(1, total / cap));
  const gf = Math.max(0, Math.min(1, guard / cap));
  const sf = Math.max(0, Math.min(1, startLevel / cap));
  const neg = disp < 0;
  const up = f >= sf;                       // caixa subiu no período?
  const moved = Math.abs(f - sf) > 0.006;   // houve movimento relevante
  const rho = (dy) => ({
    T: [cx, topY + dy], R: [cx + wx, topY + wy + dy], F: [cx, topY + 2 * wy + dy], L: [cx - wx, topY + wy + dy],
  });
  const top = rho(0);
  const surf = rho(h * (1 - f));
  const gsurf = rho(h * (1 - gf));
  const ssurf = rho(h * (1 - sf));           // nível do início do período
  const Lb = [cx - wx, topY + wy + h], Fb = [cx, topY + 2 * wy + h], Rb = [cx + wx, topY + wy + h];
  const pp = (...a) => a.map(p => `${p[0]},${p[1]}`).join(' ');
  const bottomY = topY + 2 * wy + h;      // base frontal do líquido
  const surfFY = topY + 2 * wy + h * (1 - f); // y da frente da superfície
  const tGuard = `Guardado: ${fmt(guard)} — reservado (travado) nos seus cofrinhos`;
  const tDisp = `Disponível: ${fmt(disp)} — livre pra usar (fora dos cofrinhos)`;
  const tResumo = `Caixa ${fmt(total)}  ·  Disponível ${fmt(disp)}  ·  Guardado ${fmt(guard)}`;
  const tPeriodo = (total >= startLevel)
    ? `Este período: +${fmt(total - startLevel)} — o Caixa subiu (entrou mais do que saiu)`
    : `Este período: −${fmt(startLevel - total)} — o Caixa caiu (saiu mais do que entrou)`;
  const bottomR = { L: Lb, F: Fb, R: Rb };
  const bandPts = (hi, lo) => pp(hi.L, hi.F, hi.R, lo.R, lo.F, lo.L); // faixa entre 2 níveis (2 faces frontais)
  const bubbles = [
    { x: 64, r: 2.2, d: '3.4s', b: '0s' },
    { x: 82, r: 1.6, d: '4.2s', b: '1.3s' },
    { x: 116, r: 2.5, d: '3.0s', b: '0.6s' },
    { x: 134, r: 1.8, d: '4.7s', b: '2.1s' },
  ];
  return (
    <svg viewBox="0 0 200 300" width="100%" style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 22px 30px rgba(var(--cor-tema-rgb,74,109,255),.28))' }}>
      <defs>
        <linearGradient id="lidHi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.14" /><stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="halo2" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.22" /><stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
        </radialGradient>
        <pattern id="hatch2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" style={{ fill: 'var(--red)', fillOpacity: 0.12 }} />
          <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: 'var(--red)', strokeWidth: 2.2, strokeOpacity: 0.5 }} />
        </pattern>
        <clipPath id="cubeFront"><polygon points={pp(top.L, top.F, top.R, Rb, Fb, Lb)} /></clipPath>
      </defs>

      {/* halo + reflexo */}
      <ellipse cx="100" cy="150" rx="120" ry="120" fill="url(#halo2)" />
      <ellipse cx="100" cy={topY + 2 * wy + h + 16} rx="78" ry="9" fill="var(--blue)" opacity="0.12" />

      {/* CUBO DE VIDRO (vazio) — topo + 2 faces */}
      <polygon points={pp(top.T, top.R, top.F, top.L)} style={{ fill: 'color-mix(in srgb, var(--card2) 90%, #fff 10%)', stroke: 'var(--border)', strokeWidth: 1.2 }} />
      <polygon points={pp(top.L, top.F, Fb, Lb)} style={{ fill: 'color-mix(in srgb, var(--card2) 88%, #000 12%)', stroke: 'var(--border)', strokeWidth: 1.2 }} />
      <polygon points={pp(top.F, top.R, Rb, Fb)} style={{ fill: 'var(--card2)', stroke: 'var(--border)', strokeWidth: 1.2 }} />

      {/* LÍQUIDO (balança suavemente) */}
      <g style={{ animation: 'pv2-bob 4.5s ease-in-out infinite', transformBox: 'view-box', transformOrigin: 'center' }}>
        {f > 0 && (
          <>
            <polygon points={pp(surf.L, surf.F, Fb, Lb)} style={{ fill: 'color-mix(in srgb, var(--blue) 84%, #000 16%)' }} />
            <polygon points={pp(surf.F, surf.R, Rb, Fb)} style={{ fill: 'var(--blue)' }} />
            {/* guardado (banda mais escura na base) — hover tratado na camada transparente */}
            {!neg && gf > 0 && <>
              <polygon points={pp(gsurf.L, gsurf.F, Fb, Lb)} style={{ fill: '#000', fillOpacity: 0.26 }} />
              <polygon points={pp(gsurf.F, gsurf.R, Rb, Fb)} style={{ fill: '#000', fillOpacity: 0.18 }} />
            </>}
            {/* neg: guardado acima do caixa → hachura */}
            {neg && <>
              <polygon points={pp(gsurf.L, gsurf.F, surf.F, surf.L)} fill="url(#hatch2)" />
              <polygon points={pp(gsurf.F, gsurf.R, surf.R, surf.F)} fill="url(#hatch2)" />
            </>}
            {/* marca do período: verde = Caixa subiu (entrou mais que saiu) */}
            {moved && up && <>
              <polygon points={pp(surf.L, surf.F, ssurf.F, ssurf.L)} style={{ fill: 'var(--green)', fillOpacity: 0.34 }} />
              <polygon points={pp(surf.F, surf.R, ssurf.R, ssurf.F)} style={{ fill: 'var(--green)', fillOpacity: 0.24 }} />
            </>}
            {/* superfície do líquido (topo brilhante) */}
            <polygon points={pp(surf.T, surf.R, surf.F, surf.L)} style={{ fill: 'color-mix(in srgb, var(--blue) 60%, #fff)' }} />
            {/* linha do guardado (tracejada) */}
            <polyline points={pp(gsurf.L, gsurf.F, gsurf.R)} style={{ fill: 'none', stroke: neg ? 'var(--red)' : 'rgba(255,255,255,.65)', strokeWidth: 1.4, strokeDasharray: '4 3' }} />
          </>
        )}
      </g>

      {/* marca do período: vermelho = Caixa caiu (drenou) — região vazia acima da água */}
      {moved && !up && <>
        <polygon points={pp(ssurf.L, ssurf.F, surf.F, surf.L)} fill="url(#hatch2)" />
        <polygon points={pp(ssurf.F, ssurf.R, surf.R, surf.F)} fill="url(#hatch2)" />
      </>}
      {/* linha do nível de início do período */}
      {moved && (
        <polyline points={pp(ssurf.L, ssurf.F, ssurf.R)} style={{ fill: 'none', stroke: up ? 'var(--green)' : 'var(--red)', strokeWidth: 1.3, strokeDasharray: '3 3', opacity: 0.85 }} />
      )}

      {/* bolhas subindo (loop) dentro do líquido */}
      {f > 0.04 && (
        <g clipPath="url(#cubeFront)">
          {bubbles.map((bb, i) => (
            <circle key={i} cx={bb.x} r={bb.r} fill="#fff" fillOpacity="0.55">
              <animate attributeName="cy" values={`${bottomY - 4};${surfFY + 4}`} dur={bb.d} begin={bb.b} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.65;0.65;0" dur={bb.d} begin={bb.b} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      )}

      {/* brilho de vidro nas faces frontais */}
      <polygon points={pp(top.L, top.F, Fb, Lb)} fill="url(#lidHi)" style={{ pointerEvents: 'none' }} />
      {/* re-contorno por cima (nitidez do vidro) */}
      <polygon points={pp(top.T, top.R, top.F, top.L)} style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.4 }} />
      <polyline points={pp(top.L, Lb)} style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.4 }} />
      <polyline points={pp(top.F, Fb)} style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.4 }} />
      <polyline points={pp(top.R, Rb)} style={{ fill: 'none', stroke: 'var(--border)', strokeWidth: 1.4 }} />

      {/* Camada de HOVER (transparente) — explica cada parte do cubo */}
      <g>
        <polygon points={pp(top.T, top.R, Rb, Fb, Lb, top.L)} data-tooltip={tResumo} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />
        <polygon points={pp(top.T, top.R, top.F, top.L)} data-tooltip={tResumo} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />
        {gf > 0 && <polygon points={bandPts(gsurf, bottomR)} data-tooltip={tGuard} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />}
        <polygon points={bandPts(surf, gsurf)} data-tooltip={tDisp} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />
        {moved && <polygon points={bandPts(up ? surf : ssurf, up ? ssurf : surf)} data-tooltip={tPeriodo} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />}
      </g>
    </svg>
  );
}

// Pré-calcula segmentos (offset acumulado) fora do render — sem mutar em map.
function donutSegments(cats) {
  const tot = cats.reduce((s, c) => s + c.v, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  const out = [];
  let acc = 0;
  for (const c of cats) { const len = C * c.v / tot; out.push({ ...c, len, off: acc }); acc += len; }
  return { R, C, tot, segs: out };
}

function Donut({ cats }) {
  if (!cats.length) return <div className="pv2-empty-note"><i className="fa-solid fa-chart-pie"></i><span>Sem gastos no período.</span></div>;
  const { R, C, tot, segs } = donutSegments(cats);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 4 }}>
      <svg viewBox="0 0 160 160" width="230" style={{ maxWidth: '100%' }}>
        {segs.map((c, i) => (
          <circle key={i} cx="80" cy="80" r={R} data-tooltip={`${c.n}: ${fmt(c.v)}`} style={{ fill: 'none', stroke: c.color, strokeWidth: 22, strokeDasharray: `${c.len} ${C - c.len}`, strokeDashoffset: -c.off, transform: 'rotate(-90deg)', transformOrigin: '80px 80px', cursor: 'pointer' }} />
        ))}
        <text x="80" y="75" textAnchor="middle" style={{ fill: 'var(--muted2)', fontSize: 11 }}>total</text>
        <text x="80" y="94" textAnchor="middle" data-money="" style={{ fill: 'var(--text)', fontSize: 17, fontWeight: 800 }}>{fmt(tot)}</text>
      </svg>
    </div>
  );
}

function Weekday({ days }) {
  const max = Math.max(...days.map(d => d.v), 1);
  const bw = 26, gap = (260 - bw * 7) / 8, base = 96;
  return (
    <svg viewBox="0 0 260 120" width="100%">
      {days.map((d, i) => {
        const bh = d.v / max * 72; const x = gap + i * (bw + gap); const wk = d.d === 'Sáb' || d.d === 'Dom';
        return (
          <g key={i}>
            <rect x={x} y={base - bh} width={bw} height={bh} rx="5" style={{ fill: wk ? 'var(--orange)' : 'var(--blue)', fillOpacity: wk ? 0.9 : 0.75 }} />
            <text x={x + bw / 2} y="112" textAnchor="middle" style={{ fill: 'var(--muted2)', fontSize: 10.5 }}>{d.d}</text>
            {/* alvo de hover da coluna inteira → média do dia */}
            <rect x={x} y="0" width={bw} height={base} data-tooltip={`${d.d}: ${fmt(d.v)}`} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />
          </g>
        );
      })}
    </svg>
  );
}

// Barras horizontais — Gastos por forma de pagamento (só formas preenchidas).
function PayBars({ items }) {
  if (!items.length) return <div className="pv2-empty-note"><i className="fa-solid fa-credit-card"></i><span>Sem gastos por forma de pagamento no período.</span></div>;
  const max = Math.max(...items.map(i => i.v), 1);
  return (
    <div className="pv2-paybars">
      {items.map((it, i) => (
        <div key={i} className="pv2-paybar" data-tooltip={`${it.n}: ${fmt(it.v)}`}>
          <span className="pv2-paybar-label">{it.n}</span>
          <div className="pv2-paybar-track">
            <div className="pv2-paybar-fill" style={{ width: `${Math.max(2, it.v / max * 100)}%`, background: it.color }} />
          </div>
          <span className="pv2-paybar-val" data-money="">{fmt(it.v)}</span>
        </div>
      ))}
    </div>
  );
}

function Evolution({ ev }) {
  const X0 = 42, X1 = 624, W = X1 - X0, Y0 = 18, Y1 = 178, Hh = Y1 - Y0;
  const maxBar = Math.max(...ev.map(e => Math.max(e.rec, e.desp)), 1);
  const gw = W / ev.length, bw = Math.min(11, gw * 0.32);
  const grid = [0, 0.5, 1].map((g, i) => <line key={'g' + i} x1={X0} y1={Y1 - g * Hh} x2={X1} y2={Y1 - g * Hh} style={{ stroke: 'var(--line)', strokeWidth: 1 }} />);
  const tipFor = (e) => `${e.m} · Receita ${fmt(e.rec)} · Despesa ${fmt(e.desp)} · Caixa ${fmt(e.caixa)}`;
  const bars = ev.map((e, i) => {
    const cx = X0 + gw * i + gw / 2; const rh = e.rec / maxBar * Hh, dh = e.desp / maxBar * Hh;
    return (
      <g key={i}>
        <rect x={cx - bw - 1} y={Y1 - rh} width={bw} height={rh} rx="3" style={{ fill: 'var(--green)', fillOpacity: 0.85 }} />
        <rect x={cx + 1} y={Y1 - dh} width={bw} height={dh} rx="3" style={{ fill: 'var(--red)', fillOpacity: 0.8 }} />
        <text x={cx} y="196" textAnchor="middle" style={{ fill: 'var(--muted2)', fontSize: 10 }}>{e.m}</text>
        {/* alvo de hover da coluna inteira → valores do mês */}
        <rect x={cx - gw / 2} y={Y0} width={gw} height={Hh} data-tooltip={tipFor(e)} style={{ fill: 'transparent', pointerEvents: 'all', cursor: 'help' }} />
      </g>
    );
  });
  const cmin = Math.min(...ev.map(e => e.caixa)), cmax = Math.max(...ev.map(e => e.caixa)), cr = (cmax - cmin) || 1;
  const cyf = (v) => Y0 + 18 + (1 - (v - cmin) / cr) * (Hh - 30);
  const pts = ev.map((e, i) => `${X0 + gw * i + gw / 2},${cyf(e.caixa)}`).join(' ');
  const dots = ev.map((e, i) => (
    <circle key={'d' + i} cx={X0 + gw * i + gw / 2} cy={cyf(e.caixa)} r="3.2" data-tooltip={`${e.m} · Caixa ${fmt(e.caixa)}`} style={{ fill: 'var(--blue)', cursor: 'help' }} />
  ));
  return (
    <svg viewBox="0 0 640 210" width="100%">
      {grid}{bars}
      <polyline points={pts} style={{ fill: 'none', stroke: 'var(--blue)', strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      {dots}
    </svg>
  );
}

// Jarro do cofrinho — IDÊNTICO ao do modal de guardar (CofreScene), só menor
// (escalado via transform). Reusa as classes globais .jar / .jar-liquid / etc.
function MiniJar({ meta }) {
  const empty = !meta;
  const pct = empty ? 0 : Math.max(0, Math.min(100, Math.round(meta.progresso_pct || 0)));
  const cor = empty ? 'var(--muted2)' : (meta.cor || 'var(--cor-azul-primario)');
  return (
    <div className="pv2-goal" data-tooltip={empty ? undefined : `${meta.nome}: guardado ${fmt(meta.saldo_atual)} de ${fmt(meta.valor_alvo)} (${pct}%)${meta.data_projetada ? ` · conclui ${fmtMonth(meta.data_projetada)}` : ''}`}>
      <div className={`pan-cofre-scaled ${empty ? 'is-empty' : ''}`}>
        <div className="jar-holder">
          <div className="jar" style={{ '--cofre-cor': cor }}>
            <div className="jar-liquid" style={{ height: pct + '%' }}>
              <div className="jar-wave"></div>
              <div className="jar-wave jar-wave-2"></div>
              <span className="jar-bubble b1"></span>
              <span className="jar-bubble b2"></span>
              <span className="jar-bubble b3"></span>
            </div>
            <div className="jar-glass"></div>
            <div className="jar-shine"></div>
          </div>
          <div className="jar-lid"></div>
        </div>
      </div>
      <div className="pv2-goal-txt">
        {empty ? (
          <>
            <div className="pv2-goal-name" style={{ color: 'var(--muted2)' }}>Vazio</div>
            <div className="pv2-goal-eta">crie um cofrinho</div>
          </>
        ) : (
          <>
            <div className="pv2-goal-name">{meta.nome}</div>
            <div className="pv2-goal-sub"><span data-money="">{fmt(meta.saldo_atual)}</span> / <span data-money="">{fmt(meta.valor_alvo)}</span></div>
            <div className="pv2-goal-pct" style={{ color: cor }}>{pct}%</div>
            <div className="pv2-goal-eta">{meta.data_projetada ? `conclui ${fmtMonth(meta.data_projetada)}` : 'sem projeção'}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function Panorama() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => computeRange('mes'));
  const [privacy, setPrivacy] = useState(() => localStorage.getItem('panorama_privacy') === 'true');
  const [attnPage, setAttnPage] = useState(0);
  const [dismissed, setDismissed] = useState(loadDismissed);

  const dismissInsight = (id) => {
    const next = { ...dismissed, [id]: Date.now() + DISMISS_MS };
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setDismissed(next);
    setAttnPage(0);
  };

  const { addToast } = useToast();
  const navigate = useNavigate();

  const togglePrivacy = () => {
    setPrivacy(p => { localStorage.setItem('panorama_privacy', String(!p)); return !p; });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const result = await getPanoramaData(range?.start, range?.end);
        if (alive) setData(result);
      } catch (error) {
        logger.error('Erro inesperado', { error: String(error) });
        addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar o Panorama.' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.start, range?.end]);

  if (loading && !data) return (
    <div className="container main-container panorama-scope">
      <div className="page-header">
        <div className="page-header-main">
          <h1><i className="fa-solid fa-gauge-high"></i> Panorama</h1>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--cor-azul-primario)' }}></i>
      </div>
    </div>
  );
  if (!data) return <div className="container">Erro ao carregar dados.</div>;

  const kpis = data.kpis || {};
  const caixa = kpis.caixa || 0;
  const guardado = data.cofrinhos?.total_guardado || 0;
  const disp = caixa - guardado;
  const total = caixa;
  const receita = kpis.receita_mes || 0, despesa = kpis.despesa_mes || 0, bal = kpis.balanco_mes || 0;

  const comp = data.comparativo;
  const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : 0);
  const dRec = comp ? pct(receita, comp.receita) : 0;
  const dDesp = comp ? pct(despesa, comp.despesa) : 0;
  const dBal = comp ? pct(bal, comp.balanco) : 0;

  // Capacidade do cubo = pico do Caixa nos últimos 12 meses → nível ganha significado.
  const peakCaixa = Math.max(caixa, guardado, 1, ...((data.evolucao_caixa_real || []).map(v => v || 0)));
  const cap = peakCaixa * 1.06;
  // Nível do Caixa no início do período (antes do balanço do período) → "marca" de receita/despesa.
  const startLevel = Math.max(0, caixa - (bal || 0));
  const neg = disp < 0;
  const denom = Math.max(Math.abs(disp) + guardado, total, 1);

  const fc = data.forecast;
  const seguro = fc ? fc.status !== 'danger' : true;
  const fcClose = fc ? (receita - fc.projetado) : 0;
  const savingsPct = receita > 0 ? Math.max(0, Math.round(bal / receita * 100)) : 0;

  const insights = (data.insights || []).filter(it => !dismissed[it.id]);
  const PER = 4;
  const attnPages = Math.max(1, Math.ceil(insights.length / PER));
  const pageIdx = Math.min(attnPage, attnPages - 1);
  const alertSlots = Array.from({ length: PER }, (_, i) => insights[pageIdx * PER + i] || null);

  const cats = (data.gastos_por_categoria?.labels || []).map((n, i) => ({
    n, v: data.gastos_por_categoria.data[i] || 0, color: data.gastos_por_categoria.colors?.[i] || 'var(--muted2)',
  }));

  const payItems = (data.gastos_por_tipo_pagamento?.labels || []).map((n, i) => ({
    n, v: data.gastos_por_tipo_pagamento.data[i] || 0, color: data.gastos_por_tipo_pagamento.colors?.[i] || 'var(--muted2)',
  }));

  const ev = (data.evolucao_labels || []).map((m, i) => ({
    m, rec: data.evolucao_mensal_receita?.[i] || 0, desp: data.evolucao_mensal_despesa?.[i] || 0, caixa: data.evolucao_caixa_real?.[i] || 0,
  }));

  const week = (data.gasto_semanal?.labels || []).map((d, i) => ({ d, v: data.gasto_semanal.data[i] || 0 }));
  const weekAvg = week.length ? Math.round(week.reduce((s, w) => s + w.v, 0) / week.length) : 0;

  const budget = data.orcamento || [];

  // Cofrinhos: sempre 3 jarros — top 3 por valor; slots vazios em modo empty.
  const metasOrdenadas = (data.cofrinhos?.metas || []).slice().sort((a, b) => (b.saldo_atual || 0) - (a.saldo_atual || 0));
  const goalSlots = [0, 1, 2].map(i => metasOrdenadas[i] || null);

  const ritmo = data.ritmo;
  const prioTotal = (kpis.tarefas_pendentes?.critica || 0) + (kpis.tarefas_pendentes?.alta || 0) + (kpis.tarefas_pendentes?.media || 0) + (kpis.tarefas_pendentes?.baixa || 0);
  const doneP = (prioTotal + (kpis.tarefas_concluidas || 0)) > 0 ? Math.round((kpis.tarefas_concluidas || 0) / (prioTotal + (kpis.tarefas_concluidas || 0)) * 100) : 0;
  const prios = [
    { label: 'Crítica', count: kpis.tarefas_pendentes?.critica || 0, color: 'var(--red)' },
    { label: 'Alta', count: kpis.tarefas_pendentes?.alta || 0, color: 'var(--orange)' },
    { label: 'Média', count: kpis.tarefas_pendentes?.media || 0, color: 'var(--blue)' },
    { label: 'Baixa', count: kpis.tarefas_pendentes?.baixa || 0, color: 'var(--muted2)' },
  ];
  const prox = kpis.proximo_compromisso;

  const kpiList = [
    { label: 'Receita', value: fmt(receita), arrow: dRec >= 0 ? '▲' : '▼', delta: fmtPct(dRec), dc: dRec >= 0 ? 'var(--green)' : 'var(--red)', vc: 'var(--text)', tip: 'Receitas efetivadas no período. A variação compara com o período anterior de mesma duração.' },
    { label: 'Despesa', value: fmt(despesa), arrow: dDesp >= 0 ? '▲' : '▼', delta: fmtPct(dDesp), dc: dDesp <= 0 ? 'var(--green)' : 'var(--red)', vc: 'var(--text)', tip: 'Despesas efetivadas no período. A variação compara com o período anterior de mesma duração.' },
    { label: 'Balanço', value: fmt(bal), arrow: bal >= 0 ? '▲' : '▼', delta: fmtPct(dBal), dc: bal >= 0 ? 'var(--green)' : 'var(--red)', vc: bal >= 0 ? 'var(--text)' : 'var(--red)', tip: 'Receitas menos despesas efetivadas no período. Positivo = sobrou; negativo = gastou mais do que entrou.' },
  ];

  return (
    <div className="container main-container panorama-scope">
      <div className="page-header">
        <div className="page-header-main">
          <h1><i className="fa-solid fa-gauge-high"></i> Panorama</h1>
        </div>
      </div>
      <div className="pv2-root" data-privacy={privacy ? 'on' : 'off'}>
        <div className="pv2-inner">

          {/* ATENÇÃO AGORA — some por completo (título + cards) quando não há alertas */}
          {insights.length > 0 && (
          <div className="pv2-section-top">
            <div className="pv2-attn-head">
              <span className="pv2-attn-dot" />
              <span className="pv2-attn-title">Atenção agora</span>
              <span className="pv2-attn-count">{insights.length ? `${insights.length} ${insights.length === 1 ? 'alerta' : 'alertas'}` : ''}</span>
              {attnPages > 1 && (
                <div className="pv2-attn-nav">
                  <button className="pv2-btn pv2-attn-arrow" onClick={() => setAttnPage(p => (p - 1 + attnPages) % attnPages)} aria-label="Anteriores"><i className="fa-solid fa-chevron-left"></i></button>
                  <div className="pv2-attn-dots">
                    {Array.from({ length: attnPages }, (_, i) => (
                      <button key={i} className={`pv2-attn-dot-btn ${i === pageIdx ? 'active' : ''}`} onClick={() => setAttnPage(i)} aria-label={`Página ${i + 1}`} />
                    ))}
                  </div>
                  <button className="pv2-btn pv2-attn-arrow" onClick={() => setAttnPage(p => (p + 1) % attnPages)} aria-label="Próximos"><i className="fa-solid fa-chevron-right"></i></button>
                </div>
              )}
            </div>
            <div className="pv2-attn-row" key={pageIdx}>
              {alertSlots.map((it, idx) => {
                if (!it) {
                  return (
                    <div key={`empty-${idx}`} className="pcard pv2-alert pv2-alert-empty">
                      <i className="fa-solid fa-circle-check" style={{ fontSize: 20, color: 'var(--green)', opacity: 0.7 }}></i>
                      <div className="pv2-alert-detail" style={{ marginTop: 0 }}>Sem aviso aqui</div>
                    </div>
                  );
                }
                const s = SEV[it.severidade] || SEV.info;
                return (
                  <div key={it.id} className="pcard pv2-alert">
                    <div className="pv2-alert-top">
                      <div className="pv2-alert-chip" style={{ background: s.bg, color: s.c }}><i className={insightIcon(it)}></i></div>
                      <div className="pv2-alert-sev" style={{ color: s.c }}>{s.label}</div>
                      <button className="pv2-alert-dismiss" title="Dispensar por 24h" onClick={(e) => { e.stopPropagation(); dismissInsight(it.id); }}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                    <div>
                      <div className="pv2-alert-title">{it.titulo}</div>
                      {it.detalhe && <div className="pv2-alert-detail">{it.detalhe}</div>}
                    </div>
                    {it.acao && (
                      <button className="pv2-btn pv2-alert-cta" style={{ color: s.c, background: s.bg, border: 'none' }} onClick={() => navigate(it.acao)}>Ver →</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* HERO: CAIXA */}
          <div className="pv2-hero">
            <div className="pv2-hero-jar"><Reservoir total={total} disp={disp} guard={guardado} cap={cap} startLevel={startLevel} /></div>
            <div>
              <div className="pv2-hero-top">
                <div className="pv2-hero-label">Caixa · patrimônio acumulado</div>
                <div className="pv2-hero-controls">
                  <DateRangeFilter initialPreset="mes" onChange={setRange} />
                  <button className={`btn-privacy-toggle ${privacy ? 'active' : ''}`} onClick={togglePrivacy} title={privacy ? 'Mostrar valores' : 'Ocultar valores'}>
                    <i className={`fa-solid ${privacy ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="pv2-hero-total"><span data-money="">{fmt(total)}</span></div>
              <div className="pv2-hero-bars">
                <div className="pv2-hero-bar">
                  <div className="pv2-hero-bar-head">
                    <span className="lbl">Disponível <span>livre</span></span>
                    <span className="val" style={{ color: disp < 0 ? 'var(--red)' : 'var(--text)' }}><span data-money="">{fmt(disp)}</span></span>
                  </div>
                  <div className="pv2-track"><div style={{ width: `${Math.max(2, Math.abs(disp) / denom * 100)}%`, height: '100%', borderRadius: 4, background: disp < 0 ? 'var(--red)' : 'linear-gradient(90deg,var(--blue),#7b8cff)' }} /></div>
                </div>
                <div className="pv2-hero-bar">
                  <div className="pv2-hero-bar-head">
                    <span className="lbl">Guardado <span><i className="fa-solid fa-lock" style={{ fontSize: 10 }}></i> travado</span></span>
                    <span className="val"><span data-money="">{fmt(guardado)}</span></span>
                  </div>
                  <div className="pv2-track"><div style={{ width: `${guardado / denom * 100}%`, height: '100%', borderRadius: 4, background: 'rgba(74,109,255,.4)' }} /></div>
                </div>
              </div>
              {neg && (
                <div className="pv2-hero-neg"><span />Descoberto de {fmt(Math.abs(disp))} — cubra o disponível ou libere um cofrinho.</div>
              )}
              <div className="pv2-hero-note">Guardar é transferência neutra — sai do disponível, vira guardado, o total não muda.</div>
            </div>
          </div>

          {/* KPI BAND */}
          <div className="pv2-kpiband">
            {kpiList.map((k, i) => (
              <div key={i} className="pv2-kpi" data-tooltip={k.tip}>
                <div className="pv2-kpi-label">{k.label}</div>
                <div className="pv2-kpi-value" style={{ color: k.vc }}><span data-money="">{k.value}</span></div>
                <div className="pv2-kpi-delta" style={{ color: k.dc }}>{k.arrow} {k.delta} <span className="muted">vs anterior</span></div>
              </div>
            ))}
            {fc && (
              <div className="pv2-kpi-extra" data-tooltip="Projeção de fechamento do período: o realizado até agora mais as pendências conhecidas. 'Seguro' quando deve fechar positivo.">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="pv2-kpi-label">Projeção</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: seguro ? 'var(--green)' : 'var(--red)', background: seguro ? 'rgba(39,174,96,.15)' : 'rgba(231,76,60,.15)' }}>{seguro ? 'seguro' : 'alerta'}</span>
                </div>
                <div className="pv2-track" style={{ marginBottom: 8 }}><div style={{ width: `${Math.min(100, Math.round(fc.realizado / (fc.projetado || 1) * 100))}%`, height: '100%', background: seguro ? 'var(--blue)' : 'var(--red)', borderRadius: 4 }} /></div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Fecha em <b style={{ color: seguro ? 'var(--green)' : 'var(--red)' }}><span data-money="">{fmt(fcClose)}</span></b> · projetado <span data-money="">{fmt(fc.projetado)}</span></div>
              </div>
            )}
            <div className="pv2-kpi-extra" data-tooltip="Taxa de poupança: percentual da receita do período que não foi gasto (quanto maior, mais você guardou).">
              <div className="pv2-kpi-label">Poupança</div>
              <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 800, color: 'var(--green)', lineHeight: 1, margin: '8px 0' }}>{savingsPct}<span style={{ fontSize: '.55em' }}>%</span></div>
              <div className="pv2-track"><div style={{ width: `${Math.min(100, savingsPct)}%`, height: '100%', background: 'var(--green)', borderRadius: 4 }} /></div>
            </div>
          </div>

          {/* GRID */}
          <div className="pv2-grid">

            <div className="pcard" style={{ gridColumn: 'span 8' }}>
              <div className="pv2-card-head">
                <span className="pv2-card-title">Evolução · últimos 12 meses</span>
                <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--green)' }} />Receita</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--red)' }} />Despesa</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--blue)' }} />Caixa</span>
                </div>
              </div>
              <Evolution ev={ev.length ? ev : [{ m: '—', rec: 0, desp: 0, caixa: 0 }]} />
            </div>

            <div className="pcard" style={{ gridColumn: 'span 4' }}>
              <div className="pv2-card-title" style={{ marginBottom: 12 }}>Gastos por categoria</div>
              <Donut cats={cats} />
            </div>

            <div className="pcard pv2-eq" style={{ gridColumn: 'span 6' }}>
              <div className="pv2-card-title" style={{ marginBottom: 16 }}>
                Orçamento por categoria
                {(budget[0]?.meses || 1) > 1 && <span className="chart-subtitle"> · limite × {budget[0].meses} meses</span>}
              </div>
              {budget.length ? (
                <div className="pv2-budget">
                  {budget.map((b) => {
                    const over = b.pct != null && b.pct > 100;
                    const near = b.pct != null && b.pct >= 90;
                    const budgetTip = `${b.nome}: gasto ${fmt(b.gasto)}${b.limite > 0 ? ` de ${fmt(b.limite)}${b.pct != null ? ` (${Math.round(b.pct)}%)` : ''}` : ' · sem limite definido'}`;
                    return (
                      <div key={b.nome} data-tooltip={budgetTip}>
                        <div className="pv2-budget-head">
                          <span className="n">{b.nome} {over && <span className="pv2-badge-over">{Math.round(b.pct)}%</span>}</span>
                          <span className="amt"><span data-money="">{fmt(b.gasto)}</span>{b.limite > 0 ? <> / <span data-money="">{fmt(b.limite)}</span></> : ''}</span>
                        </div>
                        {b.limite > 0 && (
                          <div className="pv2-bar9"><div style={{ width: `${Math.min(100, b.pct || 0)}%`, height: '100%', borderRadius: 5, background: over ? 'var(--red)' : near ? 'var(--orange)' : 'var(--blue)' }} /></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pv2-empty-note"><i className="fa-solid fa-list-check"></i><span>Sem orçamento no período (defina limites nas categorias).</span></div>
              )}
            </div>

            <div className="pcard pv2-eq" style={{ gridColumn: 'span 6' }}>
              <div className="pv2-card-title" style={{ marginBottom: 16 }}>Cofrinhos &amp; metas</div>
              <div className="pv2-goals">
                {goalSlots.map((m, i) => <MiniJar key={m ? m.id : `empty-${i}`} meta={m} />)}
              </div>
            </div>

            <div className="pcard" style={{ gridColumn: 'span 12' }}>
              <div className="pv2-card-title" style={{ marginBottom: 16 }}>Gastos por forma de pagamento</div>
              <PayBars items={payItems} />
            </div>

            <div className="pcard" style={{ gridColumn: 'span 4' }}>
              <div className="pv2-card-head">
                <span className="pv2-card-title">Média por dia</span>
                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>média <span data-money="">{fmt(weekAvg)}</span></span>
              </div>
              {week.length ? <Weekday days={week} /> : <div className="pv2-empty-note"><span>Sem dados.</span></div>}
            </div>

            <div className="pcard" style={{ gridColumn: 'span 4' }}>
              <div className="pv2-card-title" style={{ marginBottom: 14 }}>Ritmo</div>
              {ritmo ? (
                <>
                  <div className="pv2-row-baseline">
                    <span style={{ fontSize: 30, fontWeight: 800 }}>{ritmo.peso_atual != null ? String(ritmo.peso_atual).replace('.', ',') : '—'}</span>
                    <span style={{ fontSize: 14, color: 'var(--muted)' }}>kg</span>
                    {ritmo.peso_delta != null && <span style={{ fontSize: 13, fontWeight: 700, color: ritmo.peso_delta <= 0 ? 'var(--green)' : 'var(--orange)', marginLeft: 'auto' }}>{ritmo.peso_delta <= 0 ? '▼' : '▲'} {Math.abs(ritmo.peso_delta)} kg</span>}
                  </div>
                  {ritmo.objetivo && <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>objetivo {ritmo.objetivo}</div>}
                  <div className="pv2-divider" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}><i className="fa-solid fa-dumbbell" style={{ color: 'var(--blue)', width: 16, textAlign: 'center' }}></i><span style={{ color: 'var(--muted)' }}>Treino ativo</span><b style={{ marginLeft: 'auto' }}>{ritmo.plano_ativo || '—'}</b></div>
                    {ritmo.dieta_calorias ? <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}><i className="fa-solid fa-fire" style={{ color: 'var(--orange)', width: 16, textAlign: 'center' }}></i><span style={{ color: 'var(--muted)' }}>Meta calórica</span><b style={{ marginLeft: 'auto' }}>{Math.round(ritmo.dieta_calorias)} kcal</b></div> : null}
                  </div>
                </>
              ) : (
                <div className="pv2-empty-note"><i className="fa-solid fa-heart-pulse"></i><span>Sem dados de saúde. Registre no Ritmo.</span></div>
              )}
            </div>

            <div className="pcard" style={{ gridColumn: 'span 4' }}>
              <div className="pv2-card-head">
                <span className="pv2-card-title">Produtividade</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{doneP}% feitas</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {prios.map((p, i) => (
                  <div key={i} className="pv2-prio">
                    <span className="pv2-prio-dot" style={{ background: p.color }} />
                    <span style={{ flex: 1, color: 'var(--muted)' }}>{p.label}</span>
                    <b>{p.count}</b>
                  </div>
                ))}
              </div>
              <div className="pv2-divider">
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Anotações no período</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{kpis.total_anotacoes || 0}</div>
              </div>
            </div>

            <div className="pcard" style={{ gridColumn: 'span 8', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                <div className="pv2-card-title" style={{ marginBottom: 14 }}>Agenda</div>
                <div className="pv2-mini-stats">
                  <div className="pv2-mini-stat"><div className="num" style={{ color: 'var(--green)' }}>{kpis.compromissos_realizados || 0}</div><div className="cap">realizados</div></div>
                  <div className="pv2-mini-stat"><div className="num" style={{ color: 'var(--blue)' }}>{kpis.compromissos_pendentes || 0}</div><div className="cap">pendentes</div></div>
                  <div className="pv2-mini-stat"><div className="num" style={{ color: 'var(--red)' }}>{kpis.compromissos_perdidos || 0}</div><div className="cap">perdidos</div></div>
                </div>
              </div>
              <div className="pv2-next">
                <div style={{ fontSize: 11.5, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Próximo compromisso</div>
                <div style={{ fontSize: 19, fontWeight: 800, margin: '8px 0 4px' }}>{prox?.titulo || 'Nada agendado'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}><i className="fa-regular fa-clock"></i> {prox?.data ? fmtDateTime(prox.data) : '—'}</div>
              </div>
            </div>

            <div className="pcard" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 14 }}><i className="fa-solid fa-key"></i> Cofre de senhas</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{kpis.chaves_ativas || 0}</div><div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>chaves ativas</div></div>
                <div><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--orange)' }}>{kpis.chaves_expiradas || 0}</div><div style={{ fontSize: 11.5, color: 'var(--muted2)' }}>expiradas</div></div>
              </div>
            </div>

          </div>
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
