# 🧠 Arquitetura Base de IA (AI Core)

Esta seção documenta a **Camada de Infraestrutura** que sustenta todo o ecossistema de Inteligência Artificial do projeto.

Antes de entrarmos nos módulos específicos (Nutrição, Treino, Finanças, etc.), é fundamental entender o "Sistema Nervoso Central". Projetamos uma arquitetura robusta, agnóstica e resiliente para que os **Brains** (os Agentes Especialistas de cada módulo) possam focar puramente em regra de negócio, sem se preocupar com conexões de API, tratamento de erros ou validação de dados.

Abaixo detalhamos os 4 pilares fundamentais desta arquitetura.


## Indice

    - [🧠 Arquitetura Base de IA (AI Core)](#-arquitetura-base-de-ia-ai-core)
- [🧠 Arquitetura Base de IA (AI Core)](#-arquitetura-base-de-ia-ai-core)
  - [Indice](#indice)
  - [1. O Contrato Universal (`base_schema.py`)](#1-o-contrato-universal-base_schemapy)
    - [Estruturas Chave:](#estruturas-chave)
  - [2. A Fábrica de Conexões (`llm_factory.py`)](#2-a-fábrica-de-conexões-llm_factorypy)
  - [3. O Sanitizador de Saída (`post_processor.py`)](#3-o-sanitizador-de-saída-post_processorpy)
  - [4. O Gerenciador de Memória (`cache.py`)](#4-o-gerenciador-de-memória-cachepy)
  - [🔄 Fluxo de Dados (Pipeline de Execução)](#-fluxo-de-dados-pipeline-de-execução)
- [🛠️ Técnicas Avançadas de Engenharia de Prompt](#️-técnicas-avançadas-de-engenharia-de-prompt)
  - [1. Persona Adoption (Role-Playing Estrito)](#1-persona-adoption-role-playing-estrito)
  - [2. Few-Shot Prompting (Aprendizado por Exemplos)](#2-few-shot-prompting-aprendizado-por-exemplos)
  - [3. Chain-of-Thought Guidance (Raciocínio Guiado)](#3-chain-of-thought-guidance-raciocínio-guiado)
  - [4. Data Grounding (Aterramento de Dados)](#4-data-grounding-aterramento-de-dados)
  - [5. Negative Constraints (Restrições Negativas)](#5-negative-constraints-restrições-negativas)
- [🏦 Módulo de Finanças (Financial Intelligence)](#-módulo-de-finanças-financial-intelligence)
  - [🧠 Os 4 Brains Financeiros](#-os-4-brains-financeiros)
    - [1. 👮‍♂️ Budget Sentinel (O Guarda de Orçamento)](#1-️-budget-sentinel-o-guarda-de-orçamento)
    - [2. 🔮 Cash Flow Oracle (O Oráculo de Fluxo)](#2--cash-flow-oracle-o-oráculo-de-fluxo)
    - [3. 🕵️‍♂️ Spending Detective (O Detetive de Gastos)](#3-️️-spending-detective-o-detetive-de-gastos)
    - [4. 🏛️ Strategy Architect (O Arquiteto de Estratégia)](#4-️-strategy-architect-o-arquiteto-de-estratégia)
  - [🎼 O Orquestrador Financeiro (`orchestrator.py`)](#-o-orquestrador-financeiro-orchestratorpy)
    - [Fluxo de Decisão (CFO Logic):](#fluxo-de-decisão-cfo-logic)
- [📝 Módulo de Registros (Produtividade e Tarefas)](#-módulo-de-registros-produtividade-e-tarefas)
  - [🧠 Os 4 Brains de Produtividade](#-os-4-brains-de-produtividade)
    - [1. ⏱️ Time Strategist (O Estrategista de Tempo)](#1-️-time-strategist-o-estrategista-de-tempo)
    - [2. 🌊 Flow Architect (O Arquiteto de Fluxo)](#2--flow-architect-o-arquiteto-de-fluxo)
    - [3. ⚗️ Priority Alchemist (O Alquimista de Prioridades)](#3-️-priority-alchemist-o-alquimista-de-prioridades)
    - [4. 🔨 Task Breaker (O Quebrador de Tarefas)](#4--task-breaker-o-quebrador-de-tarefas)
  - [🎼 O Orquestrador de Registros (`orchestrator.py`)](#-o-orquestrador-de-registros-orchestratorpy)
    - [Fluxo de Execução (Parallel Graph):](#fluxo-de-execução-parallel-graph)
- [❤️ Módulo Ritmo (Saúde Integrada)](#️-módulo-ritmo-saúde-integrada)
  - [🥗 O Brain de Nutrição (`NutriOrchestrator`)](#-o-brain-de-nutrição-nutriorchestrator)
    - [1. 🧮 Macro Auditor (O Auditor de Macros)](#1--macro-auditor-o-auditor-de-macros)
    - [2. 🍽️ Meal Detective (O Detetive de Refeições)](#2-️-meal-detective-o-detetive-de-refeições)
    - [3. 🍲 Variety Expert (O Especialista em Variedade)](#3--variety-expert-o-especialista-em-variedade)
  - [🏋️‍♂️ O Brain de Treino (`CoachOrchestrator`)](#️️-o-brain-de-treino-coachorchestrator)
    - [1. 🏗️ Volume Architect (O Arquiteto de Volume)](#1-️-volume-architect-o-arquiteto-de-volume)
    - [2. 🥋 Technique Master (O Mestre da Técnica)](#2--technique-master-o-mestre-da-técnica)
    - [3. 🔥 Intensity Strategist (O Estrategista de Intensidade)](#3--intensity-strategist-o-estrategista-de-intensidade)
  - [🎼 O Orquestrador Geral (`RitmoOrchestrator`)](#-o-orquestrador-geral-ritmoorchestrator)
    - [Responsabilidades de Orquestração:](#responsabilidades-de-orquestração)
- [📅 Módulo de Roteiro (Agenda e Logística)](#-módulo-de-roteiro-agenda-e-logística)
  - [🧠 Os 4 Brains de Roteiro](#-os-4-brains-de-roteiro)
    - [1. 🛡️ Conflict Guardian (O Guardião de Conflitos)](#1-️-conflict-guardian-o-guardião-de-conflitos)
    - [2. 🚦 Density Auditor (O Auditor de Densidade)](#2--density-auditor-o-auditor-de-densidade)
    - [3. 🚑 Recovery Agent (O Agente de Recuperação)](#3--recovery-agent-o-agente-de-recuperação)
    - [4. ✈️ Travel Marshal (O Marshal de Viagem)](#4-️-travel-marshal-o-marshal-de-viagem)
  - [🎼 O Orquestrador de Roteiro (`orchestrator.py`)](#-o-orquestrador-de-roteiro-orchestratorpy)
    - [Fluxo de Execução (Scatter-Gather):](#fluxo-de-execução-scatter-gather)
- [📡 Endpoints de IA (O Controlador Central)](#-endpoints-de-ia-o-controlador-central)
  - [🎯 Objetivo e Responsabilidades](#-objetivo-e-responsabilidades)
  - [🔗 Endpoints Principais](#-endpoints-principais)
    - [1. `/ritmo/insight` (Saúde Integrada)](#1-ritmoinsight-saúde-integrada)
    - [2. `/registros/insight` (Produtividade)](#2-registrosinsight-produtividade)
    - [3. `/roteiro/insight` (Agenda)](#3-roteiroinsight-agenda)
    - [4. `/financas/insight` (CFO Digital)](#4-financasinsight-cfo-digital)
  - [🛠️ Exemplo de Fluxo de Dados (Finanças)](#️-exemplo-de-fluxo-de-dados-finanças)
- [🎨 Interface de Usuário (O FAB Flutuante)](#-interface-de-usuário-o-fab-flutuante)
  - [🧩 Arquitetura do Componente (`AiAssistant.jsx`)](#-arquitetura-do-componente-aiassistantjsx)
    - [1. Contexto Dinâmico](#1-contexto-dinâmico)
    - [2. Gestão de Estado e Cache Local](#2-gestão-de-estado-e-cache-local)
    - [3. Posicionamento Inteligente (Smart Positioning)](#3-posicionamento-inteligente-smart-positioning)
  - [💅 Design System \& Estilização (`styles.css`)](#-design-system--estilização-stylescss)
    - [Hierarquia Visual dos Cards](#hierarquia-visual-dos-cards)
    - [Interatividade e Micro-interações](#interatividade-e-micro-interações)
  - [🔄 Ciclo de Vida da Requisição](#-ciclo-de-vida-da-requisição)
  - [📱 Screenshot](#-screenshot)
    - [1. FAB](#1-fab)


---

## 1. O Contrato Universal (`base_schema.py`)

Para que o Frontend consiga renderizar sugestões vindas de um nutricionista robô ou de um auditor financeiro sem mudar uma linha de código, criamos um **Contrato de Dados Universal**.

* **Objetivo:** Garantir que todos os Agentes falem a "mesma língua".
* **Principal Componente:** `AtomicSuggestion` (Sugestão Atômica).

### Estruturas Chave:
* **`AtomicSuggestion`**: É a menor unidade de valor gerada pela IA. Contém título, conteúdo, severidade e ações. É o objeto exato que o Frontend recebe.
* **`ActionKind` (Enum Inteligente):** Define o que o botão da interface fará (ex: `SWAP` para trocar alimento, `REMOVE` para deletar gasto). Possui **lógica fuzzy** para entender sinônimos vindos da IA (ex: se a IA escrever "delete", o sistema converte automaticamente para `REMOVE`).
* **`SeverityLevel` & `SuggestionType`:** Padronizam a urgência (cores e ícones na UI). A IA pode dizer "Fatal", e o sistema converte para `CRITICAL` automaticamente.

---

## 2. A Fábrica de Conexões (`llm_factory.py`)

Centraliza toda a comunicação externa com os provedores de LLM (Large Language Models). Os Agentes nunca chamam a OpenAI ou Groq diretamente; eles pedem à Fábrica.

* **Padrão de Projeto:** Factory + Singleton.
* **Abstração de Provedor:** Permite trocar o cérebro da operação (ex: de OpenAI para Groq ou Gemini) apenas alterando uma variável de ambiente (`LLM_PROVIDER`), sem refatorar o código dos agentes.
* **Resiliência (Retry):** Utiliza a biblioteca `tenacity` para tentar novamente automaticamente caso a API da IA falhe ou dê timeout (até 3 tentativas exponenciais).
* **LangChain Integration:** Gerencia a complexidade de templates de prompt e parsers de saída.

---

## 3. O Sanitizador de Saída (`post_processor.py`)

Modelos de Linguagem (LLMs) são criativos e, às vezes, **alucinam na formatação**. Este componente atua como uma barreira de segurança entre a IA e o nosso sistema.

* **Função Principal:** "Limpar a bagunça da IA".
* **Correções Automáticas:**
    * Se a IA devolver um Dicionário quando esperávamos uma Lista, o processador corrige.
    * Se a IA esquecer campos obrigatórios (como IDs ou Domínio), o processador injeta valores padrão (Fallbacks).
* **Validação Estrita:** Utiliza o Pydantic para garantir que, se algo passar daqui, é 100% seguro para o Frontend renderizar. Se um item estiver corrompido, ele é descartado individualmente para não quebrar a aplicação.

---

## 4. O Gerenciador de Memória (`cache.py`)

Inteligência Artificial custa dinheiro (tokens) e tempo (latência). O sistema de Cache evita que o usuário espere ou pague por uma análise que já foi feita minutos atrás.

* **Backend:** Redis.
* **Estratégia:** Cache-Aside com Hashing Determinístico.
* **Como funciona:**
    1. O sistema pega todos os dados do usuário (contexto).
    2. Gera uma assinatura digital única (Hash MD5) desses dados.
    3. Verifica se já existe uma resposta pronta para essa assinatura no Redis.
    4. **HIT:** Retorna instantaneamente (milissegundos).
    5. **MISS:** Chama a IA, processa e salva no Redis por 24 horas.

---

## 🔄 Fluxo de Dados (Pipeline de Execução)

Quando um **Brain** (Agente) é acionado, os dados fluem da seguinte maneira:

1.  **Contextualização:** O Agente coleta dados do banco.
2.  **Verificação de Cache:** O `cache.py` verifica se essa análise já existe.
3.  **Geração (Se não houver cache):** A `llm_factory.py` monta o prompt e chama o provedor (Groq/OpenAI).
4.  **Sanitização:** O `post_processor.py` recebe o texto bruto da IA, corrige falhas e valida os Enums.
5.  **Persistência:** O resultado limpo é salvo no Cache.
6.  **Entrega:** Uma lista de `AtomicSuggestion` é devolvida ao Orquestrador.

---

# 🛠️ Técnicas Avançadas de Engenharia de Prompt

Para garantir que a IA não apenas "converse", mas atue como um sistema especialista confiável, utilizamos uma combinação de técnicas avançadas de Prompt Engineering nos arquivos `prompts.py` de cada agente.

## 1. Persona Adoption (Role-Playing Estrito)
Não utilizamos prompts genéricos. Cada agente recebe uma **Identidade Funcional** clara.
* **Técnica:** Definimos o "Quem sou eu", a "Missão" e o "Tom de Voz".
* **No Código:** *"Você é o **CashFlowOracle**, um estrategista de liquidez implacável. Sua prioridade é evitar insolvência."*
* **Resultado:** Isso modula a rigidez da análise. O *SpendingDetective* é cético e analítico, enquanto o *StrategyArchitect* é consultivo e estratégico.

## 2. Few-Shot Prompting (Aprendizado por Exemplos)
Esta é a técnica mais crítica para garantir a estabilidade do JSON de saída. Em vez de apenas explicar as regras, nós **mostramos** para a IA exatamente o que queremos.
* **Técnica:** Injetamos no System Prompt 3 a 4 pares de "Cenário -> Resposta JSON Ideal".
* **Aplicação Prática:**
    * Ensinamos quando usar `severity: critical` (ex: saldo negativo) vs `severity: warning` (ex: saldo baixo).
    * Ensinamos como preencher o objeto `action: { kind: 'brake', value: '...' }`.
* **Benefício:** A IA aprende a lógica de negócio e o schema de dados sem necessidade de fine-tuning (treinamento) do modelo.

## 3. Chain-of-Thought Guidance (Raciocínio Guiado)
Não deixamos a IA "adivinhar" o processo de análise. O prompt quebra a tarefa em etapas lógicas sequenciais.
* **Estrutura do Prompt:**
    1.  *Análise:* "Primeiro, compare o % do mês decorrido com o % gasto."
    2.  *Diagnóstico:* "Se o gasto for maior, classifique como Burn Rate Alto."
    3.  *Decisão:* "Sugira uma ação de 'Freio' (brake)."
* **Resultado:** Reduz alucinações matemáticas e garante que a conclusão siga uma lógica dedutiva auditável.

## 4. Data Grounding (Aterramento de Dados)
Para evitar que a IA invente números, nós injetamos os dados pré-calculados pelo Python diretamente no prompt do usuário (`USER_PROMPT`).
* **Técnica:** O Python faz a matemática pesada (somas, médias, projeções) e entrega o resumo mastigado no prompt.
* **Restrição:** Instruímos explicitamente: *"Confie no cálculo do contexto. Não tente recalcular de cabeça."*

## 5. Negative Constraints (Restrições Negativas)
Tão importante quanto dizer o que fazer, é dizer o que **não** fazer.
* **Exemplos no Código:**
    * *"Não dê conselhos genéricos como 'economize mais'."*
    * *"Não ignore desvios pequenos em valores absolutos."*
    * *"Nunca cite que você é uma IA."*

---

# 🏦 Módulo de Finanças (Financial Intelligence)

Esta seção detalha a arquitetura do **CFO Digital** (Chief Financial Officer), o sistema de inteligência artificial responsável por auditar, prever e otimizar a vida financeira do usuário.

Diferente de assistentes genéricos que apenas categorizam gastos, este módulo atua com **4 Brains Especialistas** que trabalham em paralelo, cobrindo Passado, Presente e Futuro.

## 🧠 Os 4 Brains Financeiros

Cada agente possui uma responsabilidade temporal e tática única, evitando sobreposição de funções.

### 1. 👮‍♂️ Budget Sentinel (O Guarda de Orçamento)
* **Foco:** O AGORA (Tático/Imediato).
* **Pergunta Chave:** *"Estou gastando rápido demais para o dia de hoje?"*
* **Lógica de Negócio (Pacing):**
    * Utiliza matemática pura (não IA) para calcular o **Burn Rate**.
    * Exemplo: Se estamos no dia 15 (50% do mês) e você já gastou 90% do orçamento de Lazer, ele emite um alerta de "Queima Rápida".
* **Diferencial:** Filtra transações futuras agendadas para não gerar pânico falso.

### 2. 🔮 Cash Flow Oracle (O Oráculo de Fluxo)
* **Foco:** O FUTURO CURTO (30-60 Dias).
* **Pergunta Chave:** *"Vou ter dinheiro para pagar o aluguel dia 15?"*
* **Lógica de Negócio (Liquidez):**
    * Simula o saldo dia-a-dia com base nas contas a pagar/receber.
    * Detecta o **Ponto de Quebra** (dia exato que o saldo fica negativo).
    * Se o saldo sobra muito, sugere investimentos (Custo de Oportunidade).

### 3. 🕵️‍♂️ Spending Detective (O Detetive de Gastos)
* **Foco:** O PASSADO (Auditoria Forense).
* **Pergunta Chave:** *"Por que minha fatura veio tão alta este mês?"*
* **Lógica de Negócio (Variância):**
    * Compara o gasto atual com a **Média Histórica de 90 dias**.
    * Identifica anomalias estatísticas (ex: "Delivery subiu 200%").
    * Busca nas transações o "Culpado" (ex: "Foi aquele jantar de R$ 300").

### 4. 🏛️ Strategy Architect (O Arquiteto de Estratégia)
* **Foco:** O FUTURO LONGO (Política & Metas).
* **Pergunta Chave:** *"Minhas metas são realistas ou estou me enganando?"*
* **Lógica de Negócio (Calibragem):**
    * **Teto de Vidro:** Detecta quando a meta é sempre estourada (sugere aumentar a meta para a realidade).
    * **Capital Zumbi:** Detecta dinheiro alocado em categorias que nunca são usadas (sugere reduzir a meta para liberar verba).

---

## 🎼 O Orquestrador Financeiro (`orchestrator.py`)

O Orquestrador é o cérebro executivo que não pensa, mas decide quem deve pensar.

### Fluxo de Decisão (CFO Logic):
1.  **Coleta:** Busca saldo, transações, metas e histórico no banco.
2.  **Disparo:** Aciona os 4 agentes em paralelo (Scatter-Gather).
3.  **Deduplicação:** Se o *Detetive* e o *Sentinel* reclamarem do mesmo gasto em "Mercado", o Orquestrador funde os avisos.
4.  **Priorização (Ranking de Severidade):**
    1.  **CRÍTICO:** Risco de Insolvência (Oracle) vem sempre primeiro.
    2.  **ALTO:** Estouro de Orçamento (Sentinel).
    3.  **MÉDIO:** Anomalia de Gasto (Detective).
    4.  **BAIXO:** Ajuste de Meta (Architect).
5.  **Corte:** Retorna apenas os **Top 6 Insights** para não sobrecarregar cognitivamente o usuário.

# 📝 Módulo de Registros (Produtividade e Tarefas)

Esta seção detalha a arquitetura da inteligência responsável pela gestão de produtividade e execução de tarefas.

Diferente da Agenda (que lida com *onde* e *quando*), o Módulo de Registros foca no **O QUÊ**. Ele não apenas lista tarefas, mas audita a clareza, a viabilidade e a prioridade do backlog do usuário.

---

## 🧠 Os 4 Brains de Produtividade

Este módulo emprega 4 agentes especialistas que atuam em diferentes níveis de granularidade: do micro (clareza do texto) ao macro (fluxo da semana).

### 1. ⏱️ Time Strategist (O Estrategista de Tempo)
* **Foco:** O AGORA (Curto Prazo e Urgência).
* **Pergunta Chave:** *"Dá tempo de fazer tudo isso hoje?"*
* **Lógica de Negócio (Viabilidade):**
    * **Regra das 18h:** Se já passou do horário comercial e ainda há muitas tarefas, sugere mover para amanhã.
    * **Auditoria de Atrasos:** Identifica tarefas vencidas e cobra uma resolução imediata.
    * **Gargalo de Realismo:** Alerta se o usuário tentar agendar mais de 8 tarefas para um único dia.

### 2. 🌊 Flow Architect (O Arquiteto de Fluxo)
* **Foco:** O FUTURO (Médio Prazo e Carga).
* **Pergunta Chave:** *"Como está a distribuição da minha semana?"*
* **Lógica de Negócio (Balanceamento):**
    * **Detecção de Vácuos:** Encontra dias vazios que podem ser adiantados ou usados para lazer.
    * **Nivelamento de Carga:** Identifica dias sobrecarregados vizinhos de dias livres e sugere redistribuição.
    * **Bem-Estar:** Valida e reforça a importância de finais de semana livres.

### 3. ⚗️ Priority Alchemist (O Alquimista de Prioridades)
* **Foco:** A IMPORTÂNCIA (Saneamento de Backlog).
* **Pergunta Chave:** *"Isso é realmente urgente ou é apenas ruído?"*
* **Lógica de Negócio (Essencialismo):**
    * **Zombie Tasks:** Identifica tarefas criadas há mais de 15 dias que nunca são concluídas e sugere arquivamento.
    * **Inflação de Prioridade:** Detecta se o usuário marcou "Alta Prioridade" em excesso (>5 itens) e sugere escolher apenas um foco principal ("Big Rock").

### 4. 🔨 Task Breaker (O Quebrador de Tarefas)
* **Foco:** A CLAREZA (Semântica e Granularidade).
* **Pergunta Chave:** *"Essa tarefa está clara o suficiente para ser executada sem pensar?"*
* **Lógica de Negócio (GTD - Getting Things Done):**
    * **Monster Tasks:** Detecta "Projetos Disfarçados" (ex: "TCC", "Reforma") e sugere quebrar no primeiro passo físico (ex: "Escrever Sumário").
    * **Verbos de Ação:** Sugere renomear tarefas vagas (ex: "Dentista") para ações concretas (ex: "Agendar Dentista").

---

## 🎼 O Orquestrador de Registros (`orchestrator.py`)

O `RegistrosOrchestrator` coordena a execução simultânea desses agentes utilizando um grafo de execução (LangGraph).

### Fluxo de Execução (Parallel Graph):
1.  **Estado Inicial:** Recebe o contexto (Tarefas, Data, Hora).
2.  **Scatter (Espalhamento):** O LangGraph dispara os 4 nós (`run_time_strategist`, `run_flow_architect`, etc.) ao mesmo tempo a partir do ponto `START`.
3.  **Processamento Isolado:** Cada nó adapta os dados para o seu agente específico e trata suas próprias falhas.
4.  **Gather (Coleta):** Os resultados são acumulados na lista `suggestions` do estado compartilhado (`RegistrosState`).
5.  **Priorização Final:** O Orquestrador ordena a lista final para que alertas de **Burnout (TimeStrategist)** ou **Atrasos Críticos** apareçam no topo da interface.


# ❤️ Módulo Ritmo (Saúde Integrada)

Esta seção detalha a arquitetura do ecossistema **Ritmo**, o módulo responsável por gerenciar o bem-estar físico do usuário.

Diferente de apps isolados, o Ritmo atua como um "Hub de Saúde" que conecta Nutrição e Treino. Ele utiliza dois sub-orquestradores especializados que, embora independentes, trabalham em harmonia sob a regência do `RitmoOrchestrator`.

---

## 🥗 O Brain de Nutrição (`NutriOrchestrator`)

A inteligência nutricional não se limita a contar calorias. Ela busca qualidade, variedade e segurança alimentar através de 3 agentes:

### 1. 🧮 Macro Auditor (O Auditor de Macros)
* **Foco:** Matemática & Segurança Fisiológica.
* **Pergunta Chave:** *"A conta fecha?"*
* **Lógica de Negócio (Auditoria):**
    * **Validação de Objetivos:** Se o usuário quer hipertrofia mas come menos que o gasto basal (GET), o agente emite um alerta crítico de erro de planejamento.
    * **Segurança:** Detecta dietas de fome (<1200 kcal) e emite avisos de desnutrição.

### 2. 🍽️ Meal Detective (O Detetive de Refeições)
* **Foco:** Qualidade & Crononutrição.
* **Pergunta Chave:** *"Essa refeição é biologicamente eficiente para este horário?"*
* **Lógica de Negócio (Composição):**
    * **Pré-Treino:** Alerta se houver excesso de gordura (digestão lenta) antes do exercício.
    * **Saciedade:** Identifica refeições com baixa proteína ou fibra, prevendo fome precoce.

### 3. 🍲 Variety Expert (O Especialista em Variedade)
* **Foco:** Aderência & Experiência.
* **Pergunta Chave:** *"Essa dieta é monótona demais?"*
* **Lógica de Negócio (Substituição):**
    * Detecta repetições excessivas (ex: "Frango todo dia") e sugere trocas equivalentes (ex: "Tilápia" ou "Lombo").
    * Garante que a substituição respeite a equivalência calórica.

---

## 🏋️‍♂️ O Brain de Treino (`CoachOrchestrator`)

O Coach Digital foca em performance segura, garantindo que o treino seja desafiador mas não lesivo.

### 1. 🏗️ Volume Architect (O Arquiteto de Volume)
* **Foco:** Carga de Trabalho & Periodização.
* **Pergunta Chave:** *"Estou treinando o suficiente (ou demais)?"*
* **Lógica de Negócio (MRV - Maximum Recoverable Volume):**
    * Calcula o volume semanal (séries x repetições) por grupo muscular.
    * Alerta sobre **"Junk Volume"** (excesso inútil que só gera fadiga) ou negligência (músculos esquecidos).

### 2. 🥋 Technique Master (O Mestre da Técnica)
* **Foco:** Biomecânica & Segurança.
* **Pergunta Chave:** *"Como executo isso sem me machucar?"*
* **Lógica de Negócio (Cues):**
    * Identifica exercícios complexos (Agachamento, Terra) e fornece "dicas de ouro" (Cues) sobre postura e respiração.
    * Ignora exercícios de máquina simples para focar onde o risco de lesão é real.

### 3. 🔥 Intensity Strategist (O Estrategista de Intensidade)
* **Foco:** Esforço & Progressão.
* **Pergunta Chave:** *"Estou treinando fofo?"*
* **Lógica de Negócio (Sobrecarga Progressiva):**
    * Analisa o nível do usuário e sugere técnicas de intensificação adequadas (Drop-set para avançados, controle de descida para iniciantes).

---

## 🎼 O Orquestrador Geral (`RitmoOrchestrator`)

O `RitmoOrchestrator` é o ponto de entrada único para o Frontend. Ele não possui inteligência própria sobre dieta ou treino, mas possui inteligência de **Fluxo**.

### Responsabilidades de Orquestração:
1.  **Roteamento Dinâmico:** Verifica se o usuário tem dieta cadastrada, treino cadastrado, ou ambos, e aciona apenas os orquestradores necessários.
2.  **Paralelismo Real:** Dispara `NutriOrchestrator` e `CoachOrchestrator` simultaneamente via `asyncio.gather`.
3.  **Unificação de Insights:** Recebe listas de sugestões de fontes diferentes e as funde em um único relatório de saúde.
4.  **Priorização Cruzada:**
    * Um alerta de **"Risco de Lesão" (Treino)** é mais urgente que um alerta de **"Falta de Variedade" (Nutrição)**.
    * O orquestrador reordena a lista final para garantir que a segurança física venha sempre em primeiro lugar.


# 📅 Módulo de Roteiro (Agenda e Logística)

Esta seção detalha a arquitetura da inteligência responsável pela gestão do tempo, deslocamento e integridade da agenda do usuário.

Enquanto o módulo de Registros foca no *backlog* (O Quê), o módulo de Roteiro foca no **CALENDÁRIO** (Quando e Onde). Sua função é garantir que o planejamento seja fisicamente possível e logisticamente viável.

---

## 🧠 Os 4 Brains de Roteiro

Este módulo emprega 4 agentes especialistas que atuam como auditores de viabilidade temporal e espacial.

### 1. 🛡️ Conflict Guardian (O Guardião de Conflitos)
* **Foco:** Lógica e Física (Hard Constraints).
* **Pergunta Chave:** *"É fisicamente possível estar nestes dois lugares ao mesmo tempo?"*
* **Lógica de Negócio (Integridade):**
    * **Sobreposição:** Detecta eventos simultâneos (ex: Reunião A às 14h e Reunião B às 14h15).
    * **Teletransporte:** Identifica se o usuário precisa estar em locais distantes (ex: Centro -> Zona Sul) sem tempo hábil de deslocamento entre o fim de um e o início do outro.
    * **Modalidade:** Diferencia conflitos presenciais de conflitos online.

### 2. 🚦 Density Auditor (O Auditor de Densidade)
* **Foco:** Ergonomia e Energia (Soft Constraints).
* **Pergunta Chave:** *"Essa agenda é sustentável ou vai gerar exaustão?"*
* **Lógica de Negócio (Saúde Mental):**
    * **Burnout:** Alerta sobre dias com carga horária excessiva (>10h).
    * **Fragmentação:** Identifica "Agenda Queijo Suíço" (muitos intervalos curtos e inúteis de 15min) que impedem o foco profundo.
    * **Context Switching:** Detecta trocas bruscas de contexto (ex: Criativo -> Financeiro -> Criativo) que drenam energia cognitiva.

### 3. 🚑 Recovery Agent (O Agente de Recuperação)
* **Foco:** O Passado e a Contingência.
* **Pergunta Chave:** *"O que ficou para trás e onde vamos encaixar?"*
* **Lógica de Negócio (Saneamento):**
    * **Triagem de Atrasos:** Diferencia "Esquecimento de Check" (tarefa antiga simples) de "Procrastinação Real" (tarefa recente complexa).
    * **Tetris de Agenda:** Analisa os espaços livres no futuro próximo para sugerir slots de reagendamento para as pendências.

### 4. ✈️ Travel Marshal (O Marshal de Viagem)
* **Foco:** Logística e Deslocamento (A -> B).
* **Pergunta Chave:** *"Como chego lá e o que preciso levar?"*
* **Lógica de Negócio (Operacional):**
    * **Porta-a-Porta:** Calcula o horário de saída considerando trânsito e antecedência (ex: Aeroporto exige 2h antes).
    * **Checklists Contextuais:** Se detectar uma viagem para outra cidade, sugere checklist de mala/documentos.
    * **Filtro Inteligente:** Ignora eventos online (Zoom) para não gerar alertas de trânsito desnecessários.

---

## 🎼 O Orquestrador de Roteiro (`orchestrator.py`)

O `RoteiroOrchestrator` é o maestro que rege esses 4 agentes, garantindo que a análise seja rápida e coerente.

### Fluxo de Execução (Scatter-Gather):
1.  **Single Source of Truth:** O Orquestrador monta o `RoteiroContext`, um objeto unificado com toda a agenda, datas e preferências.
2.  **Paralelismo Real:** Dispara os 4 agentes simultaneamente via `asyncio.gather`. O tempo de resposta é ditado pelo agente mais lento, não pela soma.
3.  **Tratamento de Erros:** Se o `TravelMarshal` falhar (ex: erro na API de mapas), o sistema apenas loga o erro e entrega os resultados dos outros agentes (Degradação Graciosa).
4.  **Filtros de UX (Pós-Processamento):**
    * **Lobotomia do Marshal:** Remove checklists de viagem gerados incorretamente para eventos que não são viagens claras.
    * **Deduplicação:** Remove alertas repetidos sobre o mesmo evento.
5.  **Priorização:** Ordena a lista final para que **Conflitos Físicos (Guardian)** apareçam antes de **Dicas de Ergonomia (Auditor)**.

# 📡 Endpoints de IA (O Controlador Central)

Esta seção documenta o arquivo `ai.py`, que atua como o **Controlador (Controller)** da API de Inteligência Artificial.

Enquanto os `Orchestrators` (Nutrição, Finanças, etc.) contêm a lógica de negócio dos agentes, este arquivo é responsável pela **Engenharia de Dados e Contexto**. Ele conecta o mundo do banco de dados (SQLAlchemy) ao mundo dos agentes (Pydantic).

---

## 🎯 Objetivo e Responsabilidades

Este arquivo não toma decisões; ele prepara o terreno para que a IA possa decidir. Suas funções principais são:

1.  **Gestão Temporal (Timezone Authority):**
    * O banco de dados armazena tudo em UTC (Universal Time Coordinated).
    * A IA (e o usuário) pensam em Horário Local (ex: "Agora são 14h em São Paulo").
    * Este controlador converte todas as datas antes de enviar para a IA, garantindo que o agente saiba exatamente "que horas são agora".

2.  **Pré-Processamento Matemático (Data Engineering):**
    * A IA é ruim de somar milhares de linhas. O Python é excelente nisso.
    * Antes de chamar o agente financeiro, este controlador calcula médias de 90 dias, somatórios de categorias e saldos projetados via SQL. A IA recebe apenas o resumo mastigado.

3.  **Roteamento e Segurança:**
    * Garante que apenas o usuário autenticado (`current_user`) acesse seus próprios dados.
    * Valida a existência de dados mínimos (ex: Bioimpedância) antes de gastar tokens chamando a IA.

---

## 🔗 Endpoints Principais

A API expõe 4 rotas principais, uma para cada grande domínio do sistema.

### 1. `/ritmo/insight` (Saúde Integrada)
* **Função:** Analisar o corpo humano.
* **Fluxo de Dados:**
    * Busca a última Bioimpedância (Peso, Gordura, TMB).
    * Busca a Dieta Ativa e o Treino Ativo.
    * Se não houver Bio, retorna vazio (sem contexto, sem IA).
    * Delega para `RitmoOrchestrator` que aciona Nutri e Coach em paralelo.

### 2. `/registros/insight` (Produtividade)
* **Função:** Analisar a lista de tarefas.
* **Transformação de Dados:**
    * Converte modelos `Tarefa` do banco para `TaskItemContext`.
    * Calcula metadados como "atraso em dias" e "data de criação relativa".
    * Define o contexto `hora_atual` (ex: "18:30") fundamental para o agente `TimeStrategist` aplicar a "Regra das 18h".

### 3. `/roteiro/insight` (Agenda)
* **Função:** Analisar o calendário.
* **Lógica Temporal Crítica:**
    * Define uma janela de análise de **30 dias** (passado e futuro próximo).
    * Converte todos os compromissos de UTC para Local Time.
    * Isso permite que o agente `ConflictGuardian` detecte, por exemplo, que uma reunião às 08:00 UTC na verdade é às 05:00 Local (madrugada), gerando um alerta de horário impróprio.

### 4. `/financas/insight` (CFO Digital)
* **Função:** Analisar o dinheiro.
* **Engenharia de Prompt (Pré-Cálculo):**
    * **Query A (Mês Atual):** Busca transações do dia 1 até hoje.
    * **Query B (Histórico 90d):** Busca transações dos 3 meses anteriores para criar a "Baseline" (Média) usada pelo `SpendingDetective`.
    * **Query C (Futuro):** Busca contas a pagar dos próximos 30 dias para o `CashFlowOracle`.
    * **Cálculo de Sobra:** (Receita Média - Despesa Média) é calculado aqui no Python, garantindo precisão contábil para o `StrategyArchitect`.

---

## 🛠️ Exemplo de Fluxo de Dados (Finanças)

1.  **Request:** O Frontend pede `/financas/insight`.
2.  **Controller (`ai.py`):**
    * Define `agora = 14:00 (Local)`.
    * Executa Query SQL complexa para somar gastos por categoria nos últimos 90 dias.
    * Calcula: "Média de Mercado = R$ 800,00".
    * Monta o objeto `FinancasContext`.
3.  **Service (`orchestrator.py`):** Recebe o contexto e dispara os 4 agentes.
4.  **Agente (`agent.py`):** Recebe "Média: 800, Atual: 1200". Conclui: "Alerta de Desvio".
5.  **Response:** Retorna JSON `AtomicSuggestion` para o Frontend.


# 🎨 Interface de Usuário (O FAB Flutuante)

Esta seção documenta a implementação do componente visual `AiAssistant`, a interface que conecta o usuário aos "Brains" de IA.

Projetado como um **Botão de Ação Flutuante (FAB)** inteligente, este componente não é invasivo, mas está sempre presente. Ele atua como um "Portal de Inteligência" que muda de contexto dependendo da tela onde o usuário está navegando.

---

## 🧩 Arquitetura do Componente (`AiAssistant.jsx`)

O componente foi construído pensando em três pilares: **Discrição, Contexto e Fluidez**.

### 1. Contexto Dinâmico
O `AiAssistant` não é genérico. Ele recebe uma prop `context` (ex: `'financas'`, `'ritmo'`, `'agenda'`) que define qual endpoint de IA será chamado.
* **Na tela de Finanças:** Ele chama o CFO Digital.
* **Na tela de Agenda:** Ele chama o Marshal de Viagem.
* **Benefício:** O mesmo componente visual serve para todo o sistema, mas o conteúdo é hiperespecalizado.

### 2. Gestão de Estado e Cache Local
Para evitar custos excessivos de API (e latência), o componente implementa uma lógica de **Cooldown** no Frontend.
* **LocalStorage:** Salva a última análise (`ai_insight_{context}`) e o timestamp (`ai_last_update_{context}`).
* **Cooldown de 3h:** Se o usuário clicar no botão novamente em menos de 3 horas, o componente exibe os dados do cache local instantaneamente, sem bater no servidor.
* **Feedback Visual:** Um contador regressivo ("Próxima análise em: 02:45") informa ao usuário quando ele poderá solicitar novos insights frescos.

### 3. Posicionamento Inteligente (Smart Positioning)
O componente é arrastável (`Draggable`), permitindo que o usuário o coloque onde preferir na tela.
* **Lógica de Ancoragem:** Ao soltar o botão, ele calcula em qual quadrante da tela está (Esquerda/Direita, Cima/Baixo).
* **Animação de Abertura:** O painel de conteúdo (`slider`) se abre na direção oposta ao canto da tela, garantindo que o conteúdo nunca fique "cortado" fora da janela.

---

## 💅 Design System & Estilização (`styles.css`)

A estética segue o conceito de **"Glassmorphism"** para transmitir modernidade e tecnologia.

### Hierarquia Visual dos Cards
Os insights retornados pela IA (`AtomicSuggestion`) são renderizados em cards com estilos semânticos distintos baseados no `type` e `severity`.

* **🔴 Crítico/Erro:** Borda vermelha pulsante (`animation: pulse-red`). Ícone de alerta. Usado para riscos financeiros ou de saúde.
* **🟠 Aviso (Warning):** Borda amarela. Usado para desvios de meta ou conflitos de agenda.
* **🔵 Dica (Tip):** Borda azul. Sugestões de otimização leve.
* **🟣 Sugestão (Suggestion):** Borda roxa. Ideias criativas da IA (ex: receitas, treinos).
* **🟢 Elogio (Praise):** Borda verde. Reforço positivo quando o usuário atinge metas.

### Interatividade e Micro-interações
* **Glow Effect:** O botão FAB possui um brilho pulsante (`fab-glow`) quando há novos insights não lidos.
* **Skeleton Loading:** Enquanto a IA processa (o que pode levar 3-5 segundos), um esqueleto de carregamento anima a interface, reduzindo a ansiedade da espera.
* **Markdown Rendering:** O texto da IA suporta negrito (`**texto**`) para destacar valores e nomes importantes.

---

## 🔄 Ciclo de Vida da Requisição

1.  **Mount:** O componente verifica o `localStorage`. Se houver dados válidos e recentes, carrega do cache.
2.  **User Action:** O usuário clica no FAB. Se o cache expirou ou for a primeira vez, chama `aiService.getInsight(context)`.
3.  **API Call:** O Frontend chama `GET /ai/{context}/insight`.
4.  **Processing:** O Backend processa (ver seções anteriores de Orchestrator).
5.  **Render:** O JSON de resposta é mapeado para os cards visuais.
6.  **Cooldown:** O botão de "Refresh" fica desabilitado até o fim do temporizador.


## 📱 Screenshot

### 1. FAB
<div align="center">
  <img src="images/ia_1.png" alt="FAB" width="48%">
</div>


---