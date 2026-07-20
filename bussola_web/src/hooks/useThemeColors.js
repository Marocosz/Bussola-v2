import { useState, useEffect } from 'react';

/**
 * Lê as cores do tema atual (CSS custom properties) para uso em bibliotecas que
 * exigem strings de cor (Chart.js), e reage à troca de tema (classe no <body>).
 * Corrige gráficos que antes usavam hex/rgba hardcoded (invisíveis no tema claro).
 */
function readColors() {
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const get = (name, fallback) => {
    const b = (body.getPropertyValue(name) || '').trim();
    if (b) return b;
    const r = (root.getPropertyValue(name) || '').trim();
    return r || fallback;
  };
  return {
    texto: get('--cor-texto-principal', '#E8EAED'),
    textoSec: get('--cor-texto-secundario', '#BDC1C6'),
    azul: get('--cor-azul-primario', '#4A6DFF'),
    verde: get('--cor-verde-sucesso', '#27ae60'),
    vermelho: get('--cor-vermelho-delete', '#e74c3c'),
    laranja: get('--cor-laranja-aviso', '#f39c12'),
    card2: get('--cor-card-secundario', '#38393E'),
    // Neutros translúcidos que funcionam em claro E escuro (trilhos/grades):
    grid: 'rgba(128,128,128,0.15)',
    trilho: 'rgba(128,128,128,0.18)',
  };
}

export function useThemeColors() {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(readColors()));
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return colors;
}
