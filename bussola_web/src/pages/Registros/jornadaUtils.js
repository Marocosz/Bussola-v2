// Helpers puros da Jornada (hábitos do dia). `now` é injetável para teste.
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function getTodayKey(now = new Date()) {
    return DIAS[now.getDay()];
}

/** Hábitos ativos que ocorrem hoje e quantos deles já foram feitos. */
export function contarHabitosHoje(habitos, now = new Date()) {
    const hoje = getTodayKey(now);
    const ativos = habitos.filter(h => h.status === 'ativo' && h.frequencia.includes(hoje));
    const feitos = ativos.filter(h => h.registro_hoje?.concluido).length;
    return { feitos, total: ativos.length, pct: ativos.length ? Math.round((feitos / ativos.length) * 100) : 0 };
}

export function calcularProgressoJornada(habitos, now = new Date()) {
    const { total, pct } = contarHabitosHoje(habitos, now);
    if (!total) return { pct: 0, mensagem: 'Comece sua jornada!' };
    const mensagem = pct === 0 ? 'Comece sua jornada!'
        : pct < 25 ? 'Você está começando.'
        : pct < 50 ? 'Siga em frente!'
        : pct < 75 ? 'Mais da metade. Bora!'
        : pct < 100 ? 'Quase lá, não pare!'
        : 'Jornada completa! 🎉';
    return { pct, mensagem };
}

export function formatarDataJornada(d = new Date()) {
    return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
