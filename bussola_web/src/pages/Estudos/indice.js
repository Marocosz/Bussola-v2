// Ícones dos blocos respondíveis e itens do índice da leitura (IndiceLeitura.jsx).
export const RESPONDIVEIS = { quiz: 'fa-circle-question', questao_aberta: 'fa-pen' };

// Itens a partir dos blocos: uma seção abre um grupo; quizzes ficam recuados sob ela.
export function itensDoIndice(material) {
    const itens = [];
    for (const bloco of material.blocos) {
        if (bloco.tipo === 'secao') {
            itens.push({ id: `bloco-${bloco.id}`, bloco: bloco.id, tipo: 'secao', titulo: bloco.titulo });
        } else if (RESPONDIVEIS[bloco.tipo]) {
            itens.push({ id: `bloco-${bloco.id}`, bloco: bloco.id, tipo: bloco.tipo, titulo: bloco.pergunta });
        }
    }
    if (material.fontes.length > 0) itens.push({ id: 'estudo-fontes', tipo: 'fontes', titulo: 'Fontes' });
    return itens;
}
