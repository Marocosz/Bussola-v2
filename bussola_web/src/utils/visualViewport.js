// Expõe a área realmente visível (descontando o teclado virtual) como variáveis CSS,
// para sheets/painéis não ficarem com o rodapé escondido atrás do teclado.
export function initVisualViewportVars() {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
        raf = 0;
        // Pinch-zoom também encolhe o visualViewport: não é teclado. Usa a altura do layout
        // viewport. Um teclado aberto durante o zoom é ignorado de propósito (raro; sem inset).
        if (Math.abs((vv.scale || 1) - 1) > 0.01) {
            root.style.setProperty('--vvh', `${document.documentElement.clientHeight}px`);
            root.style.setProperty('--kb-inset', '0px');
            return;
        }
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty('--vvh', `${vv.height}px`);
        root.style.setProperty('--kb-inset', `${inset}px`);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    apply();
}
