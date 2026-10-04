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

/**
 * onKeyDown de um grupo (radiogroup, listbox, tablist): move o foco entre os itens `seletor` do
 * grupo e devolve o índice novo (ou null se a tecla não navega). Quem chama decide se seleciona.
 */
export function moverFocoRoving(e, seletor, orientacao = 'ambas') {
    const itens = [...e.currentTarget.querySelectorAll(seletor)].filter((el) => !el.disabled);
    const atual = itens.indexOf(document.activeElement);
    if (atual === -1) return null;
    const prox = proximoIndiceRoving(e.key, atual, itens.length, orientacao);
    if (prox === null) return null;
    e.preventDefault();
    itens[prox].focus();
    return prox;
}

/** tabIndex do item i num grupo com tabindex móvel: o selecionado (ou o primeiro, se nenhum) é 0. */
export const tabIndexRoving = (i, selecionado) => (i === (selecionado >= 0 ? selecionado : 0) ? 0 : -1);
