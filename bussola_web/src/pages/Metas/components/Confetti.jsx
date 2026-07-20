import React, { useMemo } from 'react';

const PALETTE = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
const SHAPES = ['rect', 'rect', 'circle', 'ribbon']; // rects mais frequentes
const COUNT = 84;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Confete de celebração: pedaços (retângulos, círculos e fitas) que estouram
 * pra cima/fora do topo-centro e caem com gravidade, balanço e rotação.
 * Parâmetros por pedaço são calculados UMA vez (useMemo) → render estável.
 * Só transform/opacity (sem thrash de layout). Duração total ~1.6s.
 * `color` (opcional) entra na paleta (ex.: cor da meta).
 */
export function Confetti({ show, color }) {
  const pieces = useMemo(() => {
    const colors = color ? [color, ...PALETTE] : PALETTE;
    return Array.from({ length: COUNT }, () => {
      const shape = pick(SHAPES);
      const isRibbon = shape === 'ribbon';
      const isCircle = shape === 'circle';
      const size = isRibbon ? rand(4, 6) : rand(7, 13);
      return {
        shape,
        color: pick(colors),
        width: size,
        height: isRibbon ? rand(16, 26) : (isCircle ? size : rand(7, 14)),
        radius: isCircle ? '50%' : (isRibbon ? '3px' : '2px'),
        // origem: perto do topo-centro, com leve dispersão
        left: rand(38, 62),
        dx: rand(-46, 46),         // deriva horizontal final (vw)
        sway: rand(-6, 6),         // balanço horizontal (vw) no pico
        burst: rand(60, 190),      // subida no estouro (px)
        fall: rand(240, 440),      // queda final (px)
        rot: rand(-540, 540),      // rotação total (deg)
        delay: rand(0, 0.28),      // stagger
        dur: rand(1.15, 1.55),     // dentro do contrato de 1.6s
      };
    });
  }, [color]);

  if (!show) return null;

  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece confetti-${p.shape}`}
          style={{
            left: `${p.left}%`,
            width: `${p.width}px`,
            height: `${p.height}px`,
            borderRadius: p.radius,
            background: p.color,
            '--dx': `${p.dx}vw`,
            '--sway': `${p.sway}vw`,
            '--burst': `${p.burst}px`,
            '--fall': `${p.fall}px`,
            '--rot': `${p.rot}deg`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
