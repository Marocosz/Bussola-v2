// Comandos do menu "Pedir ao Claude" — contrato com o kit (kit/compartilhado/references/acoes.md).
// Claude Code: /estudos <acao> material:<id> [bloco:<bid>] ["pergunta"]
// claude.ai:   frase em linguagem natural com as mesmas referências.

export const DESTINOS = [
    { id: 'claude-code', rotulo: 'Claude Code' },
    { id: 'claude-ai', rotulo: 'claude.ai' },
];

export const ACOES = [
    { id: 'aprofundar', rotulo: 'Aprofundar', icone: 'fa-layer-group' },
    { id: 'simplificar', rotulo: 'Simplificar', icone: 'fa-feather' },
    { id: 'exercicios', rotulo: 'Criar exercícios', icone: 'fa-list-check' },
    { id: 'comparativo', rotulo: 'Criar comparativo relacionado', icone: 'fa-code-compare' },
    { id: 'fontes', rotulo: 'Verificar/atualizar fontes', icone: 'fa-book-bookmark' },
    { id: 'duvida', rotulo: 'Tirar dúvida', icone: 'fa-circle-question', pergunta: true },
];

const CHAVE_DESTINO = 'estudos-destino';

export function lerDestino() {
    try {
        return localStorage.getItem(CHAVE_DESTINO) === 'claude-ai' ? 'claude-ai' : 'claude-code';
    } catch {
        return 'claude-code';
    }
}

export function salvarDestino(destino) {
    try {
        localStorage.setItem(CHAVE_DESTINO, destino);
    } catch {
        // sem storage: a preferência só não persiste
    }
}

function alvo(materialId, blocoId, forma) {
    const base = blocoId ? `bloco ${blocoId} do material ${materialId}` : `material ${materialId}`;
    return { o: `o ${base}`, ao: `ao ${base}`, do: `do ${base}` }[forma];
}

const FRASES = {
    aprofundar: (m, b) => `aprofundar ${alvo(m, b, 'o')}`,
    simplificar: (m, b) => `simplificar ${alvo(m, b, 'o')}`,
    exercicios: (m, b) => `criar exercícios sobre ${alvo(m, b, 'o')}`,
    comparativo: (m, b) => `criar um comparativo relacionado ${alvo(m, b, 'ao')}`,
    fontes: (m, b) => `verificar e atualizar as fontes ${alvo(m, b, 'do')}`,
    duvida: (m, b) => `responder uma dúvida sobre ${alvo(m, b, 'o')} e registrar a resposta como bloco no material`,
};

export function montarComando({ destino, acao, materialId, blocoId = null, pergunta = '' }) {
    const limpa = String(pergunta || '').replace(/\s+/g, ' ').replace(/"/g, "'").trim();
    if (destino === 'claude-ai') {
        const frase = `Use a skill estudos para ${FRASES[acao](materialId, blocoId)} no Bússola.`;
        return limpa ? `${frase} Dúvida: "${limpa}"` : frase;
    }
    const partes = ['/estudos', acao, `material:${materialId}`];
    if (blocoId) partes.push(`bloco:${blocoId}`);
    if (limpa) partes.push(`"${limpa}"`);
    return partes.join(' ');
}

export async function copiarTexto(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        try {
            const area = document.createElement('textarea');
            area.value = texto;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            area.remove();
            return ok;
        } catch {
            return false;
        }
    }
}
