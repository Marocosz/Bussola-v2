import React, { useRef, useState } from 'react';
// Nota: alias em maiúscula (Motion) evita falso-positivo do eslint core no-unused-vars
// com JSXMemberExpression minúsculo (<motion.div>) — ver eslint-scope/JSX docs.
import { motion as Motion, useMotionValue, animate } from 'framer-motion';
import { createMovimentacao } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { BaseModal } from '../../components/BaseModal';
import { Coin } from './components/Coin';
import { Confetti } from './components/Confetti';
import { MetaHistorico } from './components/MetaHistorico';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function CofreScene({ meta, closeModal, onUpdate }) {
  const [valor, setValor] = useState('');
  const [mode, setMode] = useState('guardar');
  const [depositing, setDepositing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const bauRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const { addToast } = useToast();

  const pct = meta.progresso_pct ?? Math.min(100, (meta.saldo_atual / meta.valor_alvo) * 100);

  const doAporte = async (amount) => {
    setDepositing(true);
    try {
      await createMovimentacao(meta.id, { tipo: 'aporte', valor: amount, observacao: null });
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1400);
      addToast({ type: 'success', title: 'Guardado!', description: `${fmt(amount)} no cofrinho.` });
      setValor('');
      onUpdate?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Ops', description: err.response?.data?.detail || 'Falha ao guardar.' });
    } finally {
      x.set(0); y.set(0);
      setDepositing(false);
    }
  };

  const onDragEnd = (_e, info) => {
    const bau = bauRef.current?.getBoundingClientRect();
    const hit = bau && info.point.x >= bau.left && info.point.x <= bau.right && info.point.y >= bau.top && info.point.y <= bau.bottom;
    if (!hit || !Number(valor)) {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 25 });
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 25 });
      return;
    }
    animate(y, y.get() + 40, { duration: 0.18 });
    doAporte(Number(valor));
  };

  const doRetirada = async (e) => {
    e.preventDefault();
    try {
      await createMovimentacao(meta.id, { tipo: 'retirada', valor: Number(valor), observacao: null });
      addToast({ type: 'success', title: 'Retirado', description: `${fmt(Number(valor))} de volta ao disponível.` });
      setValor('');
      onUpdate?.();
      closeModal();
    } catch (err) {
      addToast({ type: 'error', title: 'Ops', description: err.response?.data?.detail || 'Falha ao retirar.' });
    }
  };

  return (
    <BaseModal onClose={closeModal} className="modal">
      <div className="modal-content cofre-modal" onClick={(e) => e.stopPropagation()}>
        <Confetti show={celebrate} />
        <div className="modal-header">
          <h2>{meta.nome}</h2>
          <span className="close-btn" onClick={closeModal}>&times;</span>
        </div>

        <div className="cofre-progress">
          <div className="meta-progress-bar"><span style={{ width: `${pct}%`, background: meta.cor }} /></div>
          <span className="muted">{fmt(meta.saldo_atual)} / {fmt(meta.valor_alvo)} · {Math.round(pct)}%</span>
        </div>

        <div className="mov-toggle">
          <button type="button" className={mode === 'guardar' ? 'active' : ''} onClick={() => setMode('guardar')}>Guardar</button>
          <button type="button" className={mode === 'retirar' ? 'active' : ''} onClick={() => setMode('retirar')}>Retirar</button>
        </div>

        {mode === 'guardar' ? (
          <div className="cofre-stage">
            <input className="cofre-valor-input" type="number" step="0.01" min="0" value={valor}
              onChange={(e) => setValor(e.target.value)} placeholder="Digite o valor e arraste a moeda ↓" />
            <Motion.div className="coin-draggable" drag dragSnapToOrigin={false} style={{ x, y }}
              onDragEnd={onDragEnd} whileDrag={{ scale: 1.15, rotate: 12 }}>
              <Coin valor={Number(valor)} />
            </Motion.div>
            <Motion.div ref={bauRef} className={`bau-drop ${depositing ? 'bau-open' : ''}`}
              animate={celebrate ? { scale: [1, 1.08, 1] } : {}}>
              <i className="fa-solid fa-box-open bau-icon"></i>
              <span className="bau-label">Solte aqui</span>
            </Motion.div>
          </div>
        ) : (
          <form onSubmit={doRetirada} className="cofre-retirar">
            <div className="form-row"><div className="form-group">
              <label>Valor a retirar (R$)</label>
              <input className="form-input" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required autoFocus />
            </div></div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
              <button type="submit" className="btn-primary">Retirar</button>
            </div>
          </form>
        )}

        <MetaHistorico meta={meta} onChange={onUpdate} />
      </div>
    </BaseModal>
  );
}
