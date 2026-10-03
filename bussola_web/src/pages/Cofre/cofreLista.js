// Lógica pura do Cofre: busca, validade e formatação de data. Sem React.
const DIA_MS = 86_400_000;

/** Dias até a expiração em que a validade aparece em cor de alerta. */
export const DIAS_ALERTA = 30;

export function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

/** Filtra por título e serviço, sem acento e sem diferenciar maiúsculas. */
export function filtrarSegredos(segredos, busca) {
    const termo = normalizar(busca);
    if (!termo) return segredos;
    return segredos.filter((s) => normalizar(`${s.titulo} ${s.servico || ''}`).includes(termo));
}

// 'AAAA-MM-DD' como data LOCAL. new Date('AAAA-MM-DD') seria meia-noite UTC, ou seja,
// o dia anterior no Brasil.
function dataLocal(iso) {
    const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(ano, mes - 1, dia);
}

/** 'AAAA-MM-DD' do dia LOCAL de `data` (toISOString seria UTC: depois das 21h no Brasil já é amanhã). */
export function dataISOLocal(data) {
    const p = (n) => String(n).padStart(2, '0');
    return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

/** Data de expiração em pt-BR (dia gravado, sem deslocamento de fuso) ou 'Não expira'. */
export function formatarData(iso) {
    return iso ? dataLocal(iso).toLocaleDateString('pt-BR') : 'Não expira';
}

/** Texto e nível (cor) da validade de um segredo, relativo a `agora`. */
export function validadeInfo(iso, agora = new Date()) {
    if (!iso) return { nivel: 'nenhuma', texto: 'Não expira' };
    const alvo = dataLocal(iso);
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const dias = Math.round((alvo - hoje) / DIA_MS);
    const data = formatarData(iso);
    if (dias < 0) return { nivel: 'expirado', texto: `Expirou em ${data}` };
    if (dias === 0) return { nivel: 'perto', texto: 'Expira hoje' };
    if (dias === 1) return { nivel: 'perto', texto: 'Expira amanhã' };
    if (dias <= DIAS_ALERTA) return { nivel: 'perto', texto: `Expira em ${dias} dias` };
    return { nivel: 'ok', texto: `Expira em ${data}` };
}
