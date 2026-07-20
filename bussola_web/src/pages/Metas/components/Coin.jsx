import React from 'react';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function Coin({ valor }) {
  return (
    <div className="coin-3d">
      <div className="coin-face">
        <span className="coin-symbol">R$</span>
        <span className="coin-value">{valor ? fmt(valor).replace('R$', '').trim() : '0,00'}</span>
      </div>
    </div>
  );
}
