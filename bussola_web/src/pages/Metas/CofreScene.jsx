import React, { useRef, useState, useEffect } from 'react';
import { animate } from 'framer-motion';
import { createMovimentacao } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Confetti } from './components/Confetti';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const CHIPS = [50, 100, 500, 1000];

/**
 * Cena do cofre — "Cofre de Vidro" em 2 colunas: controles à esquerda
 * (guardar/retirar + valor + valores rápidos), jarra de líquido à direita.
 * Guardar e retirar convivem na mesma tela (toggle). Movimentações abrem
 * numa view de topo do MetasModal (via onOpenHistorico). Conteúdo puro.
 */
export function CofreScene({ meta, onUpdate, onOpenHistorico }) {
  const [valor, setValor] = useState('');
  const [mode, setMode] = useState('guardar');        // guardar | retirar
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [displaySaldo, setDisplaySaldo] = useState(meta.saldo_atual);
  const jarRef = useRef(null);
  const prevSaldo = useRef(meta.saldo_atual);
  const { addToast } = useToast();

  const alvo = meta.valor_alvo || 1;
  const saldo = meta.saldo_atual || 0;
  const amount = Number(valor) || 0;
  const cor = meta.cor || '#4A6DFF';

  const currentPct = Math.max(0, Math.min(100, (saldo / alvo) * 100));
  const guardarPct = Math.max(0, Math.min(100, ((saldo + amount) / alvo) * 100));
  const retirarPct = Math.max(0, Math.min(100, ((saldo - amount) / alvo) * 100));

  // Count-up do saldo quando a meta atualiza
  useEffect(() => {
    const controls = animate(prevSaldo.current, meta.saldo_atual, {
      duration: 0.8, ease: 'easeOut', onUpdate: (v) => setDisplaySaldo(v),
    });
    prevSaldo.current = meta.saldo_atual;
    return () => controls.stop();
  }, [meta.saldo_atual]);

  // ── Arrastar o nível pra definir o valor ─────────────────────────────────
  const setAmountFromPointer = (clientY) => {
    const el = jarRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let frac = (r.bottom - clientY) / r.height;
    frac = Math.max(0, Math.min(1, frac));
    const curFrac = saldo / alvo;
    // guardar: arrasta acima do nível atual · retirar: arrasta abaixo
    const delta = mode === 'guardar' ? (frac - curFrac) : (curFrac - frac);
    const amt = Math.round(Math.max(0, delta) * alvo * 100) / 100;
    setValor(amt > 0 ? String(amt) : '');
  };
  const onPointerDown = (e) => {
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setAmountFromPointer(e.clientY);
  };
  const onPointerMove = (e) => { if (dragging) setAmountFromPointer(e.clientY); };
  const onPointerUp = (e) => { setDragging(false); e.currentTarget.releasePointerCapture?.(e.pointerId); };

  const addChip = (v) => setValor(String(Math.round((amount + v) * 100) / 100));

  const confirm = async () => {
    if (amount <= 0 || busy) return;
    setBusy(true);
    try {
      await createMovimentacao(meta.id, { tipo: mode === 'guardar' ? 'aporte' : 'retirada', valor: amount, observacao: null });
      if (mode === 'guardar' && saldo + amount >= alvo) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1600);
      }
      addToast({
        type: 'success',
        title: mode === 'guardar' ? 'Guardado!' : 'Retirado',
        description: mode === 'guardar' ? `${fmt(amount)} no cofrinho.` : `${fmt(amount)} de volta ao disponível.`,
      });
      setValor('');
      onUpdate?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Ops', description: err.response?.data?.detail || 'Falha na operação.' });
    } finally {
      setBusy(false);
    }
  };

  // Preview (banda no líquido): guardar sobe, retirar desce
  const showPreview = amount > 0;
  const previewStyle = mode === 'guardar'
    ? { bottom: `${currentPct}%`, height: `${Math.max(0, guardarPct - currentPct)}%` }
    : { bottom: `${retirarPct}%`, height: `${Math.max(0, currentPct - retirarPct)}%` };

  return (
    <div className="modal-body cofre-body">
      <Confetti show={celebrate} color={cor} />

      <div className="cofre-layout">
        {/* ESQUERDA — controles */}
        <div className="cofre-controls">
          <div className="cofre-progress-num">
            <strong>{fmt(displaySaldo)}</strong>
            <span className="muted">de {fmt(alvo)} · {Math.round(currentPct)}%</span>
          </div>

          <div className="mov-toggle cofre-mode">
            <button type="button" className={mode === 'guardar' ? 'active' : ''} onClick={() => { setMode('guardar'); setValor(''); }}>
              <i className="fa-solid fa-plus"></i> Guardar
            </button>
            <button type="button" className={mode === 'retirar' ? 'active' : ''} onClick={() => { setMode('retirar'); setValor(''); }}>
              <i className="fa-solid fa-minus"></i> Retirar
            </button>
          </div>

          <input
            className="form-input cofre-amount"
            type="number" step="0.01" min="0" inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="R$ 0,00"
          />

          <div className="cofre-chips">
            {CHIPS.map((v) => (
              <button key={v} type="button" onClick={() => addChip(v)}>+{v}</button>
            ))}
          </div>

          <button
            type="button"
            className={`btn-primary cofre-action ${mode === 'retirar' ? 'is-retirar' : ''}`}
            disabled={amount <= 0 || busy}
            onClick={confirm}
          >
            {mode === 'guardar' ? 'Guardar' : 'Retirar'}{amount > 0 ? ` ${fmt(amount)}` : ''}
          </button>

          <button type="button" className="cofre-hist-btn" onClick={() => onOpenHistorico?.()}>
            <i className="fa-solid fa-clock-rotate-left"></i> Ver movimentações
          </button>
        </div>

        {/* DIREITA — jarra */}
        <div className="cofre-jar-side">
          <div className="jar-holder">
          <div
            className={`jar ${dragging ? 'jar-dragging' : ''} ${celebrate ? 'jar-celebrate' : ''}`}
            ref={jarRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ '--cofre-cor': cor }}
          >
            {showPreview && previewPctIsVisible(mode, currentPct, guardarPct, retirarPct) && (
              <div className={`jar-preview ${mode === 'retirar' ? 'is-retirar' : ''}`} style={previewStyle}>
                <span className="jar-preview-label">{mode === 'guardar' ? '+' : '−'}{fmt(amount)}</span>
              </div>
            )}

            <div className="jar-liquid" style={{ height: `${currentPct}%` }}>
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
          <span className="cofre-drag-hint"><i className="fa-solid fa-up-down"></i> arraste o líquido</span>
        </div>
      </div>
    </div>
  );
}

function previewPctIsVisible(mode, cur, g, r) {
  return mode === 'guardar' ? g > cur : r < cur;
}
