// Botão Voltar (Android / navegador) fecha o sheet de cima no celular, sem brigar com o
// react-router (BrowserRouter, sem useBlocker).
//
// Cada sheet aberto empilha uma entrada de histórico na MESMA URL, com uma marca em
// history.state (o resto do state do router é copiado, inclusive `idx`).
// - Voltar do usuário (popstate): fecha os sheets empilhados depois da entrada em que o
//   navegador parou (normalmente só o de cima).
// - Fechar pelo app (X, overlay, ESC, ação): a entrada sai com history.back(), mas só se ela
//   ainda estiver no topo um tick depois. Se o app navegou (push) no mesmo tick, a entrada fica
//   "órfã" embaixo da nova rota; quando o Voltar chegar nela, ela é pulada.
// - Para navegar a partir de um sheet sem deixar órfã, use navegarFechandoSheet: a rota nova
//   SUBSTITUI a entrada do sheet.
// - Enquanto houver entrada de sheet, a restauração de rolagem do navegador fica manual: o
//   pushState acontece com o body travado (scrollY 0) e o scrollLock já devolve a posição.

const MARCA = '__sheet';
// Distingue entradas desta carga da página das de uma carga anterior (recarregar com um sheet aberto).
const SESSAO = Math.random().toString(36).slice(2, 8);
let seq = 0;
const pilha = []; // [{ token, n, fechar }] na ordem em que as entradas foram empilhadas
let instalado = false;
let restauracaoAnterior = null;

function tokenAtual() {
    return window.history.state?.[MARCA] ?? null;
}

// Número da entrada nesta sessão; entradas de outra carga contam como as mais antigas.
function numero(token) {
    const [sessao, n] = String(token).split(':');
    return sessao === SESSAO ? Number(n) : -1;
}

function travarRestauracao() {
    if (restauracaoAnterior !== null || !('scrollRestoration' in window.history)) return;
    restauracaoAnterior = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
}

function liberarRestauracao() {
    if (restauracaoAnterior === null || pilha.length > 0 || tokenAtual() !== null) return;
    window.history.scrollRestoration = restauracaoAnterior;
    restauracaoAnterior = null;
}

function aoPopState() {
    const atual = tokenAtual();
    const limite = atual === null ? -1 : numero(atual);
    // Fecha, de cima para baixo, os sheets cujas entradas ficaram acima de onde o navegador parou.
    while (pilha.length > 0 && pilha[pilha.length - 1].n > limite) {
        pilha.pop().fechar();
    }
    if (atual !== null && !pilha.some((r) => r.token === atual)) {
        window.history.back(); // entrada órfã (o sheet dela já fechou): pula
        return;
    }
    liberarRestauracao();
}

function instalar() {
    if (instalado) return;
    instalado = true;
    window.addEventListener('popstate', aoPopState);
}

/** Registra um sheet aberto; devolve a função a chamar quando ele fechar/desmontar. */
export function registrarSheet(fechar) {
    instalar();
    const reg = { token: null, n: 0, fechar, empilhado: false, cancelado: false };
    // Microtarefa: no StrictMode (dev) o efeito monta, desmonta e remonta no mesmo tick;
    // só a montagem que sobrevive empilha a entrada.
    queueMicrotask(() => {
        if (reg.cancelado) return;
        seq += 1;
        reg.n = seq;
        reg.token = `${SESSAO}:${seq}`;
        travarRestauracao();
        window.history.pushState({ ...window.history.state, [MARCA]: reg.token }, '');
        reg.empilhado = true;
        pilha.push(reg);
    });
    return () => {
        reg.cancelado = true;
        if (!reg.empilhado) return;
        const i = pilha.indexOf(reg);
        if (i === -1) return; // já fechado pelo Voltar
        pilha.splice(i, 1);
        // Um tick depois: se a entrada ainda é o topo (ninguém navegou), sai com back().
        window.setTimeout(() => {
            if (tokenAtual() === reg.token) window.history.back();
            else liberarRestauracao();
        }, 0);
    };
}

/** Navega a partir de um sheet aberto sem deixar entrada órfã (a rota nova substitui a do sheet). */
export function navegarFechandoSheet(navigate, to) {
    navigate(to, { replace: tokenAtual() !== null });
}
