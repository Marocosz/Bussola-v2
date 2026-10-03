// Datas do Roteiro no celular: chaves de dia, semana (domingo a sábado, igual ao
// calendário do backend), grade do mês, rótulos e as seções da lista.
// Funções puras (sem React). `data_hora` da API vem sem fuso: é hora local.

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' no fuso local. */
export function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date à meia-noite local a partir de 'AAAA-MM-DD'. */
export function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
}

/** As 7 chaves (domingo → sábado) da semana que contém `key`. */
export function weekKeys(key) {
    const inicio = addDays(key, -parseKey(key).getDay());
    return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

/** "27 set – 3 out", "4 – 10 out"; o ano só aparece quando o fim da semana não é do ano de `now`. */
export function weekRangeLabel(keys, now = new Date()) {
    const a = parseKey(keys[0]);
    const b = parseKey(keys[keys.length - 1]);
    const ano = b.getFullYear() !== now.getFullYear() ? ` ${b.getFullYear()}` : '';
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MESES_CURTOS[b.getMonth()]}${ano}`;
    return `${a.getDate()} ${MESES_CURTOS[a.getMonth()]} – ${b.getDate()} ${MESES_CURTOS[b.getMonth()]}${ano}`;
}

/** "Outubro de 2026" (`month` de 0 a 11). */
export function monthLabel(year, month) {
    const nome = MESES[month];
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${year}`;
}

/** Grade do mês em semanas completas de domingo a sábado (mesma regra do backend). */
export function monthGrid(year, month) {
    const primeiro = new Date(year, month, 1);
    const ultimo = new Date(year, month + 1, 0);
    const inicio = addDays(dayKey(primeiro), -primeiro.getDay());
    const total = primeiro.getDay() + ultimo.getDate() + (6 - ultimo.getDay());
    return Array.from({ length: total }, (_, i) => {
        const key = addDays(inicio, i);
        const d = parseKey(key);
        return { key, day: d.getDate(), weekday: DIAS_CURTOS[d.getDay()], isPadding: d.getMonth() !== month };
    });
}

/** Compromissos do dashboard (agrupados por mês) numa lista em ordem crescente de data/hora. */
export function flattenCompromissos(porMes) {
    return Object.values(porMes || {})
        .flat()
        .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
}

/** Map 'AAAA-MM-DD' → compromissos do dia, na ordem da lista recebida. */
export function indexByDay(list) {
    const map = new Map();
    for (const c of list) {
        const k = dayKey(new Date(c.data_hora));
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(c);
    }
    return map;
}

/** Cabeçalho do grupo do dia: { rel: 'Hoje'|'Amanhã'|'Ontem'|null, text: 'Sex, 2 de outubro' }. */
export function dayHeaderParts(key, now = new Date()) {
    const d = parseKey(key);
    const hoje = dayKey(now);
    const ano = d.getFullYear() !== now.getFullYear() ? ` de ${d.getFullYear()}` : '';
    const text = `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}${ano}`;
    let rel = null;
    if (key === hoje) rel = 'Hoje';
    else if (key === addDays(hoje, 1)) rel = 'Amanhã';
    else if (key === addDays(hoje, -1)) rel = 'Ontem';
    return { rel, text };
}

export function dayHeaderLabel(key, now = new Date()) {
    const { rel, text } = dayHeaderParts(key, now);
    return rel ? `${rel} · ${text}` : text;
}

/** Rótulo acessível do dia na faixa/calendário: "Sexta-feira, 2 de outubro, 1 compromisso". */
export function dayAriaLabel(key, count = 0) {
    const d = parseKey(key);
    const base = `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
    if (!count) return base;
    return `${base}, ${count} ${count === 1 ? 'compromisso' : 'compromissos'}`;
}

// Mesma regra da busca do desktop: título ou local, sem diferenciar maiúsculas.
const casa = (c, termo) => String(c.titulo || '').toLowerCase().includes(termo)
    || String(c.local || '').toLowerCase().includes(termo);

/**
 * Seções da lista do celular.
 * - Sem busca: o dia selecionado (sempre, mesmo vazio) e depois os dias com compromisso
 *   seguintes (`order='asc'`) ou anteriores, do mais recente ao mais antigo (`order='desc'`).
 * - Com busca: todos os dias com compromissos que casam, na ordem pedida.
 * `list` precisa estar em ordem crescente (flattenCompromissos): dentro do dia, hora crescente.
 */
export function buildDaySections(list, selectedKey, { order = 'asc', search = '' } = {}) {
    const termo = search.trim().toLowerCase();
    const porDia = indexByDay(termo ? list.filter((c) => casa(c, termo)) : list);
    const chaves = [...porDia.keys()].sort();
    if (termo) {
        const ordenadas = order === 'desc' ? chaves.reverse() : chaves;
        return ordenadas.map((key) => ({ key, items: porDia.get(key) }));
    }
    const resto = order === 'desc'
        ? chaves.filter((k) => k < selectedKey).reverse()
        : chaves.filter((k) => k > selectedKey);
    return [
        { key: selectedKey, items: porDia.get(selectedKey) || [] },
        ...resto.map((key) => ({ key, items: porDia.get(key) })),
    ];
}
