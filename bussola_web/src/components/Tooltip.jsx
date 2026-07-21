import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * TooltipHost — tooltip global e estilizado (substitui o tooltip nativo do
 * navegador em TODO o site). Montado uma vez no App.
 *
 * Como funciona:
 *  - Escuta hover no documento. Qualquer elemento com `title` (nativo) tem o
 *    título "sequestrado" (removido para o navegador não mostrar o feio) e
 *    exibido no nosso balão; ao sair, o `title` é restaurado (acessibilidade).
 *  - Também suporta `data-tooltip="..."` (usado nos SVGs do Panorama, onde
 *    não dá pra usar o atributo title do jeito normal).
 *  - O balão SEGUE O CURSOR (mousemove, throttle via rAF) e é sempre reposicionado
 *    dentro da viewport: mede o próprio tamanho e faz clamp nos dois eixos, virando
 *    para cima quando estouraria embaixo. Assim nunca é cortado, independente de
 *    onde o elemento está ou de quão grande é a área de hover.
 */
const stash = new WeakMap();

// Deslocamento do balão em relação ao cursor e margem mínima das bordas.
const CURSOR_GAP = 16;
const EDGE = 8;

export function TooltipHost() {
  const [tip, setTip] = useState(null);       // { text }
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [measured, setMeasured] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let current = null;
    let raf = 0;

    const show = (el, text, x, y) => {
      current = el;
      setMeasured(false);          // remede o novo conteúdo antes de exibir
      setTip({ text });
      setMouse({ x, y });
    };
    const hide = () => {
      if (current && stash.has(current)) {
        current.setAttribute('title', stash.get(current));
        stash.delete(current);
      }
      current = null;
      setTip(null);
      setMeasured(false);
    };

    const onOver = (e) => {
      const el = e.target?.closest?.('[data-tooltip], [title]');
      if (!el || el === current) return;
      let text = el.getAttribute('title');
      if (text) {
        stash.set(el, text);
        el.removeAttribute('title'); // suprime o tooltip nativo
      } else {
        text = el.getAttribute('data-tooltip');
      }
      if (text) show(el, text, e.clientX, e.clientY);
    };

    const onMove = (e) => {
      if (!current) return;
      if (raf) return; // throttle: no máximo uma atualização por frame
      const x = e.clientX, y = e.clientY;
      raf = requestAnimationFrame(() => { raf = 0; setMouse({ x, y }); });
    };

    const onOut = (e) => {
      if (!current) return;
      if (!e.relatedTarget || !current.contains(e.relatedTarget)) hide();
    };

    const onScrollOrClick = () => { if (current) hide(); };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    window.addEventListener('scroll', onScrollOrClick, true);
    document.addEventListener('click', onScrollOrClick, true);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('scroll', onScrollOrClick, true);
      document.removeEventListener('click', onScrollOrClick, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Mede o balão assim que o texto muda, antes do paint, para o clamp usar o
  // tamanho real (evita corte). Enquanto não medido, fica invisível (opacity 0).
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    setMeasured(true);
  }, [tip]);

  if (!tip) return null;

  const { w, h } = size;
  const vw = window.innerWidth, vh = window.innerHeight;

  // Centrado no cursor no eixo X, com clamp às bordas.
  let left = mouse.x - w / 2;
  left = Math.max(EDGE, Math.min(left, vw - w - EDGE));

  // Abaixo do cursor por padrão; vira para cima se estouraria embaixo.
  let top = mouse.y + CURSOR_GAP;
  if (top + h > vh - EDGE) top = mouse.y - CURSOR_GAP - h;
  top = Math.max(EDGE, Math.min(top, vh - h - EDGE));

  return createPortal(
    <div
      ref={ref}
      className="app-tooltip"
      role="tooltip"
      style={{ left, top, opacity: measured ? 1 : 0 }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
