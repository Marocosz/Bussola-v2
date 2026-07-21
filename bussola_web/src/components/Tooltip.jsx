import React, { useEffect, useState } from 'react';
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
 */
const stash = new WeakMap();

export function TooltipHost() {
  const [tip, setTip] = useState(null); // { text, rect }
  const [cur, setCur] = useState(null);

  useEffect(() => {
    let current = null;

    const show = (el, text) => {
      current = el;
      setCur(el);
      setTip({ text, rect: el.getBoundingClientRect() });
    };
    const hide = () => {
      if (current && stash.has(current)) {
        current.setAttribute('title', stash.get(current));
        stash.delete(current);
      }
      current = null;
      setCur(null);
      setTip(null);
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
      if (text) show(el, text);
    };

    const onOut = (e) => {
      if (!current) return;
      if (!e.relatedTarget || !current.contains(e.relatedTarget)) hide();
    };

    const onScrollOrClick = () => { if (current) hide(); };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    window.addEventListener('scroll', onScrollOrClick, true);
    document.addEventListener('click', onScrollOrClick, true);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('scroll', onScrollOrClick, true);
      document.removeEventListener('click', onScrollOrClick, true);
    };
  }, []);

  if (!tip || !cur) return null;

  const gap = 10;
  const r = tip.rect;
  const cx = r.left + r.width / 2;
  const above = r.top > 96;
  const left = Math.min(Math.max(cx, 96), window.innerWidth - 96);
  const top = above ? r.top - gap : r.bottom + gap;
  const transform = above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';

  return createPortal(
    <div className={`app-tooltip ${above ? 'tt-above' : 'tt-below'}`} style={{ left, top, transform }} role="tooltip">
      {tip.text}
    </div>,
    document.body,
  );
}
