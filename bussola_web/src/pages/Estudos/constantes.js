// Rótulos, ícones e classes de cor dos tipos e níveis de material.
// Cores (styles.css): Aula azul, Resumo verde, Comparativo roxo, Exercícios laranja.
export const TIPOS = {
    aula: { rotulo: 'Aula', classe: 'tipo-aula', icone: 'fa-chalkboard-user' },
    resumo: { rotulo: 'Resumo', classe: 'tipo-resumo', icone: 'fa-file-lines' },
    comparativo: { rotulo: 'Comparativo', classe: 'tipo-comparativo', icone: 'fa-code-compare' },
    exercicios: { rotulo: 'Exercícios', classe: 'tipo-exercicios', icone: 'fa-pen-to-square' },
};

export const NIVEIS = {
    iniciante: 'Iniciante',
    intermediario: 'Intermediário',
    avancado: 'Avançado',
};

export function tipoDe(tipo) {
    return TIPOS[tipo] || { rotulo: tipo, classe: '', icone: 'fa-file' };
}
