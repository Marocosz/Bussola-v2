// Teclado de grupos com tabindex móvel (abas, radios, chips): devolve o índice de destino para a
// tecla, ou null se a tecla não navega. Circular nas setas; Home/End vão às pontas.
// orientacao: 'horizontal' (←/→), 'vertical' (↑/↓) ou 'ambas' (as quatro setas, como radiogroup).
export function proximoIndiceRoving(key, atual, total, orientacao = 'ambas') {
    if (total <= 0) return null;
    const h = orientacao !== 'vertical';
    const v = orientacao !== 'horizontal';
    if ((h && key === 'ArrowRight') || (v && key === 'ArrowDown')) return (atual + 1) % total;
    if ((h && key === 'ArrowLeft') || (v && key === 'ArrowUp')) return (atual - 1 + total) % total;
    if (key === 'Home') return 0;
    if (key === 'End') return total - 1;
    return null;
}
