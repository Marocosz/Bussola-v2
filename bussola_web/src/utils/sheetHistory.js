// Botão Voltar (Android / navegador) fecha o sheet de cima no celular, sem brigar com o
// react-router (BrowserRouter, sem useBlocker).
//
// Cada sheet aberto empilha uma entrada de histórico na MESMA URL, com uma marca em
// history.state (o resto do state do router é copiado, inclusive `idx`).
// - Voltar do usuário (popstate): fecha os sheets empilhados depois da entrada em que o
//   navegador parou (normalmente só o de cima).
// - Fechar pelo app (X, overlay, ESC, ação): a entrada sai com history.back(), mas só se ela
//   ainda estiver no topo um tick depois. Se o app navegou (push) no mesmo tick, a entrada fica
//   "órfã" embaixo da nova rota; quando o Voltar chegar nela, ela é pulada. Um sheet que abre
//   enquanto uma órfã está no topo (ex.: ação do ActionSheet que abre outro sheet) reaproveita a
//   entrada dela (replaceState) em vez de empilhar outra.
// - Fechamento recusado: se o `fechar` chamado pelo Voltar devolve false (ou promessa de false),
//   o sheet continua aberto e ganha uma entrada nova (o próximo Voltar ainda fecha/pergunta).
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

// Entradas de sheets já fechados cujo back() ainda está agendado (ver o cleanup de registrarSheet).
const aguardandoSaida = new Set();

const ehOrfa = (token) => token !== null && !pilha.some((r) => r.token === token);

/** Empilha (ou re-empilha) a entrada de um sheet. Uma órfã no topo é reaproveitada (replace). */
function empilhar(reg) {
    seq += 1;
    const token = `${SESSAO}:${seq}`;
    const { [MARCA]: anterior, ...estado } = window.history.state ?? {};
    const reaproveitar = ehOrfa(tokenAtual());
    try {
        // Safari lança SecurityError acima de 100 push/replaceState em 30 s: o sheet só fica sem entrada.
        if (reaproveitar) window.history.replaceState({ ...estado, [MARCA]: token }, '');
        else window.history.pushState({ ...estado, [MARCA]: token }, '');
    } catch {
        return;
    }
    if (reaproveitar) aguardandoSaida.delete(anterior);
    travarRestauracao();
    reg.n = seq;
    reg.token = token;
    reg.empilhado = true;
    pilha.push(reg);
}

/**
 * O fechamento pelo Voltar pode ser recusado (ex.: "Descartar alterações?" → Cancelar): se `fechar`
 * devolver false (ou uma promessa de false) e o sheet seguir aberto, ele ganha uma entrada nova.
 */
function fecharPeloVoltar(reg) {
    const reempilharSeRecusou = (fechou) => {
        if (fechou === false && !reg.cancelado) empilhar(reg);
    };
    const r = reg.fechar();
    if (r && typeof r.then === 'function') r.then(reempilharSeRecusou, () => {});
    else reempilharSeRecusou(r);
}

function aoPopState() {
    const atual = tokenAtual();
    if (ehOrfa(atual)) {
        // Entrada órfã (o sheet dela já fechou): pula primeiro. Os sheets acima de onde o navegador
        // vai parar fecham no popstate seguinte, sem fechar nada por causa da órfã.
        aguardandoSaida.delete(atual);
        window.history.back();
        return;
    }
    const limite = atual === null ? -1 : numero(atual);
    // Fecha, de cima para baixo, os sheets cujas entradas ficaram acima de onde o navegador parou.
    while (pilha.length > 0 && pilha[pilha.length - 1].n > limite) {
        fecharPeloVoltar(pilha.pop());
    }
    liberarRestauracao();
}

function instalar() {
    if (instalado) return;
    instalado = true;
    window.addEventListener('popstate', aoPopState);
}

// Recarregar com um sheet aberto deixa a entrada dele (de outra carga) no topo: sai dela já na carga,
// senão o primeiro Voltar ficaria "morto" (mesma URL, nada muda).
if (typeof window !== 'undefined' && tokenAtual() !== null) {
    instalar();
    window.history.back();
}

// Dev (HMR): a versão nova do módulo instala o próprio listener; o antigo sai.
if (import.meta.hot) {
    import.meta.hot.dispose(() => window.removeEventListener('popstate', aoPopState));
}

/** Registra um sheet aberto; devolve a função a chamar quando ele fechar/desmontar. */
export function registrarSheet(fechar) {
    instalar();
    const reg = { token: null, n: 0, fechar, empilhado: false, cancelado: false };
    // Microtarefa: no StrictMode (dev) o efeito monta, desmonta e remonta no mesmo tick;
    // só a montagem que sobrevive empilha a entrada.
    queueMicrotask(() => {
        if (!reg.cancelado) empilhar(reg);
    });
    return () => {
        reg.cancelado = true;
        if (!reg.empilhado) return;
        const i = pilha.indexOf(reg);
        if (i === -1) return; // já fechado pelo Voltar
        pilha.splice(i, 1);
        const { token } = reg;
        aguardandoSaida.add(token);
        // Um tick depois: se a entrada ainda é o topo (ninguém navegou), sai com back(). Se o
        // popstate já pulou essa entrada (como órfã) ou outro sheet a reaproveitou, não volta de novo.
        window.setTimeout(() => {
            const pendente = aguardandoSaida.delete(token);
            if (pendente && tokenAtual() === token) window.history.back();
            else liberarRestauracao();
        }, 0);
    };
}

/** Navega a partir de um sheet aberto sem deixar entrada órfã (a rota nova substitui a do sheet). */
export function navegarFechandoSheet(navigate, to) {
    navigate(to, { replace: tokenAtual() !== null });
}
