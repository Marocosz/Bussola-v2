// Expõe a área realmente visível (descontando o teclado virtual) como variáveis CSS,
// para sheets/painéis não ficarem com o rodapé escondido atrás do teclado.
export function initVisualViewportVars() {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
        raf = 0;
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty('--vvh', `${vv.height}px`);
        root.style.setProperty('--kb-inset', `${inset}px`);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    apply();
}
