// ESC fecha só o que está por cima (modal, sheet, confirmação, picker), em qualquer tela.
//
// A pilha do Voltar (sheetHistory.js) só existe no celular e anda junto com o histórico do navegador;
// o ESC precisa da mesma ordem também no desktop, sem mexer no histórico. Por isso uma pilha própria e
// mínima: cada camada aberta se registra (na ordem em que abriu) e um único ouvinte de teclado chama
// só a de cima.

const pilha = []; // [{ fechar }] — o último é o de cima
let instalado = false;

function aoTeclar(e) {
    if (e.key !== 'Escape' || e.defaultPrevented || pilha.length === 0) return;
    e.preventDefault();
    pilha[pilha.length - 1].fechar(e);
}

/** Registra uma camada aberta; devolve a função que a remove (fechou/desmontou). */
export function registrarEsc(fechar) {
    if (!instalado) {
        instalado = true;
        window.addEventListener('keydown', aoTeclar);
    }
    const reg = { fechar };
    pilha.push(reg);
    return () => {
        const i = pilha.indexOf(reg);
        if (i !== -1) pilha.splice(i, 1);
    };
}

// Dev (HMR): a versão nova do módulo instala o próprio ouvinte; o antigo sai.
if (import.meta.hot) {
    import.meta.hot.dispose(() => window.removeEventListener('keydown', aoTeclar));
}
