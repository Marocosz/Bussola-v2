// Rótulos curtos dos eixos do gráfico do histórico (celular).
const compacto = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});

/** "05/09/2026" → "05/09" */
export const tickDiaMes = (label) => String(label).slice(0, 5);

/** 1234 → "R$ 1,2 mil" */
export const tickBRLCompacto = (v) => compacto.format(Number(v) || 0);
