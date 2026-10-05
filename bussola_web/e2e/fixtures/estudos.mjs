// Dados falsos do módulo Estudos. A API REST não cria materiais (quem cria é o Claude pelo MCP)
// e o banco demo não tem nenhum: os testes interceptam a API e nada é gravado.
export const TEMAS = [
  { id: 901, nome: 'Banco de Dados', cor: '#4A6DFF', icone: null, descricao: null, total_materiais: 2 },
  { id: 902, nome: 'Redes de Computadores e Protocolos da Internet', cor: '#a855f7', icone: null, descricao: null, total_materiais: 1 },
  { id: 903, nome: 'Matemática', cor: '#10b981', icone: null, descricao: null, total_materiais: 1 },
];

const base = { tags: [], estudado: false, estudado_em: null, criado_em: '2026-09-30T10:00:00' };

export const MATERIAIS = [
  { ...base, id: 9101, tipo: 'aula', nivel: 'intermediario', tema_id: 901, tema_nome: 'Banco de Dados', tema_cor: '#4A6DFF',
    titulo: 'Índices B-tree e Hash: quando usar cada um em consultas reais',
    subtitulo: 'Estruturas, custos e armadilhas de escrita em tabelas grandes', tags: ['postgres', 'indices', 'desempenho', 'sql'] },
  { ...base, id: 9102, tipo: 'resumo', nivel: 'iniciante', tema_id: 901, tema_nome: 'Banco de Dados', tema_cor: '#4A6DFF',
    titulo: 'Resumo: normalização', subtitulo: null, tags: ['modelagem'], estudado: true, estudado_em: '2026-10-01T09:00:00' },
  { ...base, id: 9103, tipo: 'comparativo', nivel: 'avancado', tema_id: 902, tema_nome: 'Redes de Computadores e Protocolos da Internet', tema_cor: '#a855f7',
    titulo: 'TCP vs UDP', subtitulo: 'Confiabilidade, latência e quando cada um vence', tags: ['redes'] },
  { ...base, id: 9104, tipo: 'exercicios', nivel: 'intermediario', tema_id: 903, tema_nome: 'Matemática', tema_cor: '#10b981',
    titulo: 'Exercícios de limites', subtitulo: null, tags: [] },
  { ...base, id: 9105, tipo: 'aula', nivel: 'avancado', tema_id: null, tema_nome: null, tema_cor: null,
    titulo: 'Material sem tema com um título bem comprido para testar a quebra de linha no celular', subtitulo: null, tags: ['avulso'] },
];

export const BLOCOS = [
  { id: 'b1', tipo: 'secao', titulo: 'Formatação inline' },
  { id: 'b2', tipo: 'texto', conteudo: 'Texto com **negrito**, *itálico*, `código` e citações [1] e [2].\n\nSegundo parágrafo com um identificador_muito_longo_sem_espacos_para_testar_a_quebra_no_celular_0123456789.' },
  { id: 'b3', tipo: 'conceito', titulo: 'Índice', texto: 'Estrutura auxiliar que evita ler a tabela inteira [1].' },
  { id: 'b4', tipo: 'analogia', texto: 'Como o índice remissivo no fim de um livro.' },
  { id: 'b5', tipo: 'definicao', termo: 'B-tree', definicao: 'Árvore balanceada com nós de muitas chaves [2].' },
  { id: 'b6', tipo: 'passos', passos: [
    { titulo: 'Raiz', texto: 'Compara a chave com os separadores.' },
    { titulo: 'Folha', texto: 'Chega à página com o ponteiro para a linha [2].' },
  ] },
  { id: 'b7', tipo: 'codigo', linguagem: 'sql', legenda: 'Índice parcial composto',
    codigo: 'CREATE INDEX idx_usuario_email_criado_em ON usuario (email, criado_em) WHERE ativo = true;\n' },
  { id: 'b8', tipo: 'comparacao', colunas: ['B-tree (padrão)', 'Hash', 'GIN (texto)', 'BRIN (blocos)'], linhas: [
    { rotulo: 'Intervalos', valores: ['sim', 'não', 'não', 'sim, aproximado'], destaque: 0 },
    { rotulo: 'Igualdade', valores: ['O(log n)', 'O(1) médio', 'depende do operador', 'aproximado'], destaque: 1 },
  ] },
  { id: 'b9', tipo: 'decisao', regras: [
    { se: 'Consulta por intervalo', entao: 'use **B-tree**' },
    { se: 'Só igualdade em tabela enorme', entao: 'considere *hash*' },
  ] },
  { id: 'b10', tipo: 'lista', itens: ['Colunas do WHERE', 'Colunas do JOIN [1]'], estilo: 'checklist' },
  { id: 'b11', tipo: 'alerta', nivel: 'atencao', titulo: 'Armadilha', texto: 'Índice demais deixa INSERT lento [1].' },
  { id: 'b12', tipo: 'quiz', pergunta: 'Qual índice atende BETWEEN?', opcoes: ['Hash', 'B-tree', 'Nenhum'], correta: 1,
    explicacao: 'Hash só atende igualdade [1].' },
  { id: 'b13', tipo: 'questao_aberta', pergunta: 'Por que índices deixam escritas mais lentas?',
    resposta_modelo: 'Cada INSERT/UPDATE também atualiza a estrutura do índice [2].' },
];

export const FONTES = [
  { titulo: 'PostgreSQL Docs — Index Types', url: 'https://www.postgresql.org/docs/current/indexes-types.html' },
  { titulo: 'Use The Index, Luke — Anatomy of an Index', url: 'https://use-the-index-luke.com/sql/anatomy' },
];

const API = /^http:\/\/127\.0\.0\.1:8000\/api\/v1\/estudos/;
const rota = (sufixo) => new RegExp(`${API.source}${sufixo}`);

export async function mockEstudos(page, { materiais = MATERIAIS, respostas = [] } = {}) {
  await page.route(rota('/temas(\\?.*)?$'), (r) => r.fulfill({ json: TEMAS }));
  await page.route(rota('/materiais(\\?.*)?$'), (r) => r.fulfill({ json: materiais }));
  await page.route(rota('/materiais/(\\d+)$'), (r) => {
    const id = Number(r.request().url().match(/materiais\/(\d+)$/)[1]);
    const resumo = materiais.find((m) => m.id === id);
    if (!resumo) return r.fulfill({ status: 404, json: { detail: 'Material não encontrado' } });
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ json: { ...resumo, blocos: BLOCOS, fontes: FONTES } });
  });
  await page.route(rota('/materiais/(\\d+)/estudado$'), (r) => {
    const { estudado } = r.request().postDataJSON();
    return r.fulfill({ json: { estudado, estudado_em: estudado ? '2026-10-02T12:00:00' : null } });
  });
  await page.route(rota('/materiais/(\\d+)/respostas$'), (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: respostas });
    // Ecoa o bloco respondido; no quiz (b12) o acerto é calculado como no servidor.
    const { bloco_id: blocoId, resposta, acertou } = r.request().postDataJSON();
    const quiz = BLOCOS.find((b) => b.id === blocoId && b.tipo === 'quiz');
    return r.fulfill({
      status: 201,
      json: {
        id: 1, material_id: 9101, bloco_id: blocoId, resposta,
        acertou: quiz ? resposta === quiz.correta : Boolean(acertou), respondido_em: '2026-10-02T12:00:00',
      },
    });
  });
  await page.route(rota('/kit/versao$'), (r) => r.fulfill({ json: { versao: '1.0.0' } }));
  await page.route(rota('/kit/instrucoes-projeto$'), (r) => r.fulfill({ json: { texto: 'Instruções de teste do Projeto Estudos.' } }));
  await page.route(rota('/kit/[a-z-]+\\.zip$'), (r) => r.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK') }));
}

// Área de transferência falsa: registra as escritas e pode falhar.
export async function stubClipboard(page) {
  await page.addInitScript(() => {
    window.__clip = [];
    window.__clipFalha = false;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: (t) => {
          if (window.__clipFalha) return Promise.reject(new DOMException('negado', 'NotAllowedError'));
          window.__clip.push(t);
          return Promise.resolve();
        },
      }),
    });
  });
}
