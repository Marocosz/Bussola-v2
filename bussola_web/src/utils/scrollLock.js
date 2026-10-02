// Trava o scroll do body enquanto houver ao menos um modal/sheet aberto.
// `overflow: hidden` sozinho não segura o iOS Safari; `position: fixed` com o
// deslocamento atual segura e, ao destravar, restauramos a posição.
let locks = 0;
let savedY = 0;

export function lockScroll() {
    locks += 1;
    if (locks > 1) return;
    savedY = window.scrollY;
    const s = document.body.style;
    s.position = 'fixed';
    s.top = `-${savedY}px`;
    s.left = '0';
    s.right = '0';
    s.width = '100%';
    s.overflow = 'hidden';
}

export function unlockScroll() {
    if (locks === 0) return;
    locks -= 1;
    if (locks > 0) return;
    const s = document.body.style;
    s.position = '';
    s.top = '';
    s.left = '';
    s.right = '';
    s.width = '';
    s.overflow = '';
    window.scrollTo(0, savedY);
}