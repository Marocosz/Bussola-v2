import React from 'react';

const COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

export function Confetti({ show }) {
  if (!show) return null;
  const pieces = Array.from({ length: 40 });
  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i / 40) * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 10) * 0.05}s`,
            transform: `rotate(${(i * 37) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}
