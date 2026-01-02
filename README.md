<div align="center">

  <img src="docs/images/bussola_cabecalho.png" alt="Bussola V2 Header" width="100%">

  <br>
  <br>

  <img src="https://img.shields.io/github/repo-size/Marocosz/bussola-v2?style=for-the-badge" alt="Repo Size">
  <img src="https://img.shields.io/github/languages/count/Marocosz/bussola-v2?style=for-the-badge" alt="Language Count">
  <img src="https://img.shields.io/badge/license-AGPL%20v3-blue?style=for-the-badge" alt="License">

  <br>
  
  <img src="https://img.shields.io/github/forks/Marocosz/bussola-v2?style=for-the-badge" alt="Forks">
  <img src="https://img.shields.io/github/issues/Marocosz/bussola-v2?style=for-the-badge" alt="Open Issues">
  <img src="https://img.shields.io/github/issues-pr/Marocosz/bussola-v2?style=for-the-badge" alt="Pull Requests">
  
  <br>

  <img src="https://img.shields.io/github/v/release/Marocosz/bussola-v2?style=for-the-badge" alt="Latest Release">
  <img src="https://img.shields.io/github/downloads/Marocosz/bussola-v2/total?style=for-the-badge" alt="Total Downloads">

</div>

---

O **Bússola V2** é a resposta definitiva para a fragmentação da vida moderna. Projetado como um **Sistema Operacional Pessoal**, ele elimina a necessidade de alternar entre múltiplos aplicativos desconexos (planilhas financeiras, apps de treino, notas soltas e agendas), unificando todos os aspectos vitais da sua rotina em uma única plataforma inteligente e segura.

> [!TIP]
> Atuando como um hub central de dados, o sistema oferece uma visão de 360º sobre sua performance pessoal. Ele cruza informações de **Finanças** e **Saúde** para gerar *insights*, utiliza **Inteligência Artificial** para otimizar sua rotina e fornece um **Panorama** em tempo real com métricas decisivas para o seu dia a dia.

Seja para gerenciar o fluxo de caixa, monitorar a dieta ou blindar senhas sensíveis, o Bússola V2 coloca você no controle total, transformando dados brutos em clareza mental e ação.

# Índice

- [Índice](#índice)
  - [🗺️ Roadmap](#️-roadmap)
    - [✅ Concluído (Fase 1: Fundação)](#-concluído-fase-1-fundação)
    - [🚧 Em Desenvolvimento (Fase 2: Inteligência \& Infra)](#-em-desenvolvimento-fase-2-inteligência--infra)
    - [🔭 Futuro (Fase 3: Expansão)](#-futuro-fase-3-expansão)
- [🛠️ Tecnologias Usadas](#️-tecnologias-usadas)
  - [🎨 Frontend (SPA)](#-frontend-spa)
  - [⚙️ Backend \& Dados](#️-backend--dados)
  - [🤖 Inteligência Artificial (Agentic Workflow)](#-inteligência-artificial-agentic-workflow)
- [📂Estrutura](#estrutura)
- [📦 Módulos do Sistema](#-módulos-do-sistema)
- [📐 Diagrama de Entidade-Relacionamento (ERD)](#-diagrama-de-entidade-relacionamento-erd)
- [📚 Documentação da API](#-documentação-da-api)
- [🐳 Deploy com Docker](#-deploy-com-docker)
  - [🏗️ Arquitetura dos Containers](#️-arquitetura-dos-containers)
  - [🚀 Como Rodar](#-como-rodar)
    - [Pré-requisitos](#pré-requisitos)
    - [Passo a Passo](#passo-a-passo)
  - [⚙️ Detalhes Técnicos Importantes](#️-detalhes-técnicos-importantes)
    - [💾 Persistência de Dados (SQLite)](#-persistência-de-dados-sqlite)
    - [🌐 Variáveis de Ambiente e Networking](#-variáveis-de-ambiente-e-networking)
    - [🛠️ Comandos Úteis](#️-comandos-úteis)
- [🤝 Agradecimentos e Contato](#-agradecimentos-e-contato)
  - [Dúvidas, Bugs ou Sugestões?](#dúvidas-bugs-ou-sugestões)
  - [Vamos nos Conectar!](#vamos-nos-conectar)

---

## 🗺️ Roadmap

O desenvolvimento do **Bússola V2** é contínuo, evoluindo de um sistema de gestão pessoal para um **ecossistema inteligente**. Abaixo, o status atual e os planos futuros:

### ✅ Concluído (Fase 1: Fundação)

- [x] **Core da Arquitetura:** Estrutura `Monorepo` (`FastAPI` + `React`) e configuração de ambiente.
- [x] **Segurança:** Autenticação `JWT`, Hashing de senhas e proteção de rotas (`CORS`/`Middlewares`).
- [x] **Camada de Dados:** Modelagem relacional complexa (`SQLAlchemy`) e Migrações (`Alembic`).
- [x] **Módulos Essenciais:** Implementação funcional de *Finanças* (Fluxo de Caixa), *Ritmo* (Treino/Dieta) e *Registros* (Tarefas).
- [x] **Documentação:** Integração automática com `Scalar` e `Swagger UI`.
- [x] - [ ] **Agentes de IA Avançados:** Refinamento dos agentes (`Brains`) dos Módulos Ritmo e Registros.

### 🚧 Em Desenvolvimento (Fase 2: Inteligência & Infra)

- [ ] **ChatBot Inteligente:** Criando ChatBot inteligente interativo e dinâmico referente a toda aplicação, dados e informação.
- [ ] **Documentação:** Documentando todos os módulos e funcionalidades do projeto.

### 🔭 Futuro (Fase 3: Expansão)

- [ ] **Feedback Loop & Memória:** Evoluir a interface dos cards de IA com botões de Aceitar (executa a ação automaticamente) e Descartar. O descarte deve alimentar uma Blacklist no Redis para impedir que a IA repita a mesma sugestão rejeitada nos próximos dias.
- [ ] **Contexto Expandido (RAG):** Implementar Retrieval-Augmented Generation para que os agentes (ex: SpendingDetective) consultem todo o histórico do usuário via busca vetorial, eliminando a limitação de enviar apenas as "Top 30" linhas e permitindo análises estatísticas profundas.
- [ ] **Meta-Orquestração (Cross-Domain):** Criar uma camada de comunicação entre módulos, permitindo que o CFO Digital (Finanças) saiba que o usuário está em fase de Bulking (Nutrição) para não bloquear gastos essenciais de dieta, evitando conselhos contraditórios entre os agentes.
- [ ] **Mobile Experience:** Adaptação da interface para PWA (Progressive Web App) ou melhorar 100% da responsividade.- 
- [ ] **Interface de Voz:** Integração com Whisper para registrar gastos e tarefas via comando de voz.
- [ ] **Gamificação:** Sistema de XP e níveis baseado no cumprimento de metas financeiras e de saúde.
- [ ] **Postgre:** Migrar para BD PostgreSQL no modo SaaS para maior robustez.
- [ ] **Dockerização:** Containerização completa da aplicação (Backend, Frontend, Redis, Banco) via Docker Compose.
- [ ] **Padronização:** Refatoração global para padronizar nomes de arquivos/variáveis de todo projeto (Code Clean-up).

---

# 🛠️ Tecnologias Usadas

O projeto foi construído sobre uma **arquitetura moderna**, utilizando bibliotecas de ponta para garantir performance, reatividade e inteligência.

## 🎨 Frontend (SPA)
Interface reativa construída com **React 19**, focada em visualização de dados e edição de conteúdo.

<div style="display: inline_block"><br>
  <img align="center" alt="React" src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img align="center" alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img align="center" alt="Chart.js" src="https://img.shields.io/badge/Chart.js-F5788D?style=for-the-badge&logo=chart.js&logoColor=white" />
  <img align="center" alt="Router" src="https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white" />
</div>

<br>

* **React 19 & Vite:** Performance extrema com a versão mais recente da biblioteca e `build tool`.
* **Chart.js:** Renderização de gráficos financeiros e biométricos para o módulo *Panorama*.
* **React Quill:** Editor de texto rico (`WYSIWYG`) utilizado no módulo *Registros*.
* **Axios:** Cliente `HTTP` para comunicação eficiente com a API.

## ⚙️ Backend & Dados
API assíncrona robusta capaz de processamento pesado de dados e cache.

<div style="display: inline_block"><br>
  <img align="center" alt="Python" src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img align="center" alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img align="center" alt="Pandas" src="https://img.shields.io/badge/Pandas-150458?style=for-the-badge&logo=pandas&logoColor=white" />
  <img align="center" alt="Redis" src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img align="center" alt="SQLAlchemy" src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" />
</div>

<br>

* **FastAPI:** Framework central para a `API RESTful`.
* **Pandas & NumPy:** Processamento analítico de dados financeiros e de saúde.
* **Redis:** Sistema de `cache` e mensageria para alta disponibilidade.
* **SQLAlchemy & Alembic:** `ORM` e versionamento de banco de dados.
* **FastAPI-Mail:** Serviço de notificações e e-mails transacionais.

## 🤖 Inteligência Artificial (Agentic Workflow)
O diferencial do projeto: uma arquitetura de **múltiplos agentes orquestrados**.

<div style="display: inline_block"><br>
  <img align="center" alt="LangChain" src="https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white" />
  <img align="center" alt="LangGraph" src="https://img.shields.io/badge/LangGraph-FF9900?style=for-the-badge&logoColor=black" />
  <img align="center" alt="Google Gemini" src="https://img.shields.io/badge/Google_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img align="center" alt="Groq" src="https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logoColor=white" />
</div>

<br>

* **LangGraph:** Orquestração de agentes estatais cíclicos (`Stateful Multi-Agent`), permitindo fluxos de raciocínio complexos.
* **LangChain:** Framework base para integração com `LLMs`.
* **Modelos:** Suporte híbrido para **Google GenAI** (`Gemini`), **Groq** (`Llama` de baixa latência) e **OpenAI**.

---

# 📂Estrutura

> [!NOTE]
> O projeto segue uma arquitetura de **Monorepo**, dividindo claramente as responsabilidades entre a API de dados (`Backend`) e a interface do usuário (`Frontend`).

```text
Bussola-v2/
├── 📁 bussola_api/           # Backend (Python/FastAPI)
│   ├── 📂 alembic/           # Migrações de Banco de Dados
│   ├── 📂 app/
│   │   ├── 📂 api/           # Endpoints e Rotas (v1)
│   │   ├── 📂 core/          # Configurações globais (Env/Security)
│   │   ├── 📂 db/            # Configuração do Banco de Dados (Session)
│   │   ├── 📂 models/        # Modelos ORM (SQLAlchemy)
│   │   ├── 📂 schemas/       # Schemas Pydantic (Serialização)
│   │   └── 📂 services/      # Lógica de Negócio
│   │       └── 📂 ai/        # 🤖 Camada de Agentes Inteligentes
│   ├── 📂 scripts/           # Scripts de automação e setup
│   └── 📄 requirements.txt
│
├── 📁 bussola_web/           # Frontend (React/Vite)
│   ├── 📂 public/            # Assets estáticos públicos
│   ├── 📂 src/
│   │   ├── 📂 assets/        # Imagens e Estilos globais
│   │   ├── 📂 components/    # Componentes de UI Reutilizáveis
│   │   ├── 📂 context/       # Estado Global (Auth, System)
│   │   ├── 📂 pages/         # Telas dos Módulos (Agenda, Ritmo, etc.)
│   │   ├── 📂 routes/        # Configuração do React Router
│   │   └── 📂 services/      # Cliente HTTP (Axios)
│   └── 📄 package.json
│
└── 📁 docs/                  # Documentação e Imagens
```

---

# 📦 Módulos do Sistema

O **Bússola V2** é composto por subsistemas independentes que conversam entre si. Para entender as **regras de negócio**, fluxos e detalhes técnicos de cada um, acesse a documentação específica:

| Módulo | Descrição | Doc |
| :--- | :--- | :---: |
| **🔭 Panorama (BI)** | Central de Inteligência que agrega dados de todos os módulos para gerar `KPIs`, gráficos (`Chart.js`) e relatórios unificados. | [Ler ➔](docs/PANORAMA.md) |
| **🔐 Segurança & Auth** | Gestão de usuários, autenticação `JWT`, `hashing` de senhas e controle de sessão. | [Ler ➔](docs/SECURITY.md) |
| **💰 Finanças** | Controle de fluxo de caixa, cartões, categorias e relatórios financeiros. | [Ler ➔](docs/FINANCE.md) |
| **💪 Ritmo (Saúde)** | Fichas de treino, controle de dieta, `macros` e `bio-tracking`. | [Ler ➔](docs/RITMO.md) |
| **🧠 Registros** | Segundo cérebro: notas, gestão de tarefas (`To-Do`) e organização de conhecimento. | [Ler ➔](docs/REGISTROS.md) |
| **📅 Agenda** | Gestão temporal, compromissos e integração com rotina. | [Ler ➔](docs/AGENDA.md) |
| **🛡️ Cofre** | `Vault` criptografado para armazenamento de segredos e senhas. | [Ler ➔](docs/COFRE.md) |
| **🤖 Inteligência Artificial** | Orquestração de agentes (`LangGraph`) que atuam como Nutricionista, Coach e Assistente Pessoal. | [Ler ➔](docs/AI.md) |
| **⚙️ Sistema & Core** | Configurações globais, `health checks`, `middlewares` e infraestrutura. | [Ler ➔](docs/SYSTEM.md) |

---

# 📐 Diagrama de Entidade-Relacionamento (ERD)

> [!IMPORTANT]
> O diagrama abaixo ilustra a estrutura do banco de dados, evidenciando o modelo **User-Centric**, onde todas as funcionalidades (Finanças, Saúde, Produtividade) orbitam em torno da entidade `User` para garantir a privacidade e isolamento dos dados (`Multi-tenancy`).

```mermaid
erDiagram
    %% ==========================================
    %% NÚCLEO (Core & Auth)
    %% ==========================================
    User {
        int id PK
        string email
        string full_name
        boolean is_premium
        string plan_status
        string auth_provider
    }

    Segredo {
        int id PK
        int user_id FK
        string titulo
        string servico
        string _valor_criptografado
    }

    Compromisso {
        int id PK
        int user_id FK
        string titulo
        datetime data_hora
        boolean lembrete
        string status
    }

    %% ==========================================
    %% MÓDULO FINANÇAS
    %% ==========================================
    Categoria {
        int id PK
        int user_id FK
        string nome
        string tipo "receita | despesa"
        float meta_limite
    }

    Transacao {
        int id PK
        int user_id FK
        int categoria_id FK
        string descricao
        float valor
        string tipo_recorrencia
        string status
        float valor_total_parcelamento
        boolean recorrencia_encerrada
    }

    HistoricoGastoMensal {
        int id PK
        int categoria_id FK
        float total_gasto
        date data_referencia
    }

    %% ==========================================
    %% MÓDULO REGISTROS (Produtividade)
    %% ==========================================
    GrupoAnotacao {
        int id PK
        int user_id FK
        string nome
        string cor
    }

    Anotacao {
        int id PK
        int user_id FK
        int grupo_id FK
        string titulo
        text conteudo
        boolean fixado
    }

    Link {
        int id PK
        int anotacao_id FK
        string url
    }

    Tarefa {
        int id PK
        int user_id FK
        string titulo
        string prioridade
        string status "Pendente | Em Andamento | Concluido"
        datetime prazo
    }

    Subtarefa {
        int id PK
        int tarefa_id FK
        int parent_id FK "Auto-relacionamento (Recursivo)"
        string titulo
        boolean concluido
    }

    %% ==========================================
    %% MÓDULO RITMO (Saúde & Treino)
    %% ==========================================
    RitmoBio {
        int id PK
        int user_id FK
        float peso
        float bf_estimado
        float tmb
        float meta_proteina
        float meta_carbo
    }

    RitmoPlanoTreino {
        int id PK
        int user_id FK
        string nome
        boolean ativo
    }

    RitmoDiaTreino {
        int id PK
        int plano_id FK
        string nome "ex: Treino A"
        int ordem
    }

    RitmoExercicioItem {
        int id PK
        int dia_treino_id FK
        string nome_exercicio
        int series
        int repeticoes_min
        int repeticoes_max
    }

    RitmoDietaConfig {
        int id PK
        int user_id FK
        string nome
        float calorias_calculadas
    }

    RitmoRefeicao {
        int id PK
        int dieta_id FK
        string nome "ex: Almoço"
        int ordem
    }

    RitmoAlimentoItem {
        int id PK
        int refeicao_id FK
        string nome
        float quantidade
        float calorias
        float proteina
    }

    %% ==========================================
    %% RELACIONAMENTOS (User é o centro)
    %% ==========================================
    
    %% Core Relationships
    User ||--o{ Segredo : "possui"
    User ||--o{ Compromisso : "agenda"

    %% Finanças
    User ||--o{ Categoria : "gerencia"
    User ||--o{ Transacao : "registra"
    Categoria ||--o{ Transacao : "classifica"
    Categoria ||--o{ HistoricoGastoMensal : "agrega"

    %% Registros
    User ||--o{ GrupoAnotacao : "organiza"
    User ||--o{ Anotacao : "escreve"
    User ||--o{ Tarefa : "planeja"
    GrupoAnotacao ||--o{ Anotacao : "contém"
    Anotacao ||--o{ Link : "referencia"
    Tarefa ||--o{ Subtarefa : "quebra em"
    Subtarefa ||--o{ Subtarefa : "filha de"

    %% Ritmo (Saúde)
    User ||--o{ RitmoBio : "monitora"
    User ||--o{ RitmoPlanoTreino : "segue"
    User ||--o{ RitmoDietaConfig : "consome"
    
    %% Ritmo - Estrutura de Treino
    RitmoPlanoTreino ||--o{ RitmoDiaTreino : "divide em"
    RitmoDiaTreino ||--o{ RitmoExercicioItem : "contém"

    %% Ritmo - Estrutura de Dieta
    RitmoDietaConfig ||--o{ RitmoRefeicao : "agrupa"
    RitmoRefeicao ||--o{ RitmoAlimentoItem : "lista"
```

---

# 📚 Documentação da API

O `backend` do **Bússola V2** gera automaticamente a documentação de todos os `endpoints` seguindo o padrão **OpenAPI**. Você pode escolher a interface que melhor se adapta ao seu fluxo de trabalho:

| Interface | Rota Local | Melhor uso para... |
| :--- | :--- | :--- |
| **Scalar** (Moderno) | [`/scalar`](http://localhost:8000/scalar) | ✨ **Visualização & Consumo:** Design moderno (Dark Mode), busca rápida (`Ctrl+K`) e gera exemplos de código prontos (`cURL`, `Python`, `JS`) para cada rota. |
| **Swagger UI** (Clássico) | [`/docs`](http://localhost:8000/docs) | 🧪 **Testes & Debug:** Interface padrão do `FastAPI`. Ideal para executar requisições rápidas ("Try it out") e testar validações de erro. |
| **ReDoc** | [`/redoc`](http://localhost:8000/redoc) | 📖 **Leitura Técnica:** Layout focado em leitura de documentação estática, excelente para entender a estrutura dos `schemas JSON` e modelos de dados. |

> [!TIP]
> **Nota:** Para importar a coleção no **Postman** ou **Insomnia**, utilize o `JSON` bruto disponível em:  
> [`http://localhost:8000/api/v1/openapi.json`](http://localhost:8000/api/v1/openapi.json)

---

---

# 🐳 Deploy com Docker

Para facilitar a execução em qualquer ambiente e garantir a paridade entre desenvolvimento e produção, o **Bússola V2** foi containerizado. Utilizamos uma arquitetura de **Microserviços** onde Backend e Frontend rodam em containers isolados, porém orquestrados para funcionarem como uma unidade coesa.

## 🏗️ Arquitetura dos Containers

O sistema não roda em um único "blocão". Utilizamos o **Docker Compose** para orquestrar dois serviços distintos, cada um com sua responsabilidade e otimização específica:

1.  **Backend (`bussola_backend`):**
    * Construído a partir de uma imagem `python:3.12-slim`.
    * Roda o servidor `Uvicorn` na porta interna `8000`.
    * Responsável pela lógica de negócios, acesso ao SQLite e comunicação com LLMs.

2.  **Frontend (`bussola_frontend`):**
    * Utiliza **Multi-stage Build**:
        1.  **Stage 1 (Node):** Compila o código React/Vite para arquivos estáticos (`build`).
        2.  **Stage 2 (Nginx):** Descarta o Node e usa um servidor Nginx Alpine (super leve) para servir os arquivos.
    * Atua também como **Proxy Reverso**: Redireciona chamadas de `/api/v1` automaticamente para o container do backend, evitando problemas de CORS e expondo apenas a porta `3000` para o usuário.

> [!NOTE]
> **Por que separado?** Essa separação permite escalar o frontend (estático) independentemente do backend (processamento), além de reduzir drasticamente o tamanho final da imagem do frontend, já que não precisamos manter o Node.js rodando em produção.

---

## 🚀 Como Rodar

### Pré-requisitos
* [Docker](https://www.docker.com/get-started) e Docker Compose instalados.

### Passo a Passo

1.  **Configuração de Ambiente:**
    Certifique-se de que o arquivo `.env` dentro de `bussola_api/` esteja configurado com suas chaves de API (OpenAI/Gemini) e configurações de segurança.
    * *O Docker injetará essas variáveis automaticamente no container do Backend.*

2.  **Subir a Aplicação:**
    Na raiz do projeto (onde está o `docker-compose.yml`), execute:

    ```bash
    docker compose up -d --build
    ```
    * `-d`: Roda em segundo plano (Detached).
    * `--build`: Força a recriação das imagens se houver alterações no código.

3.  **Acessar:**
    * 💻 **Aplicação:** [http://localhost:3000](http://localhost:3000)
    * 📚 **Documentação API:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ⚙️ Detalhes Técnicos Importantes

### 💾 Persistência de Dados (SQLite)
Uma dúvida comum é: *"Se eu deletar o container, perco meu banco de dados?"*
**Não.** Configuramos um **Volume** no Docker que espelha o diretório de dados do container para sua máquina local.

```yaml
volumes:
  - ./bussola_api/data:/app/data
```

Isso significa que o arquivo `bussola.db` que vive dentro do container é, na verdade, o mesmo arquivo que está na sua pasta `bussola_api/data/`. Você pode parar, destruir e recriar os containers quantas vezes quiser; seus dados financeiros e de saúde permanecerão intactos.

### 🌐 Variáveis de Ambiente e Networking
O Frontend detecta automaticamente se está rodando via Docker (`import.meta.env.PROD`).
* **Local (`dev`):** O Front chama `http://127.0.0.1:8000`.
* **Docker (`prod`):** O Front chama `/api/v1` (caminho relativo). O Nginx intercepta essa chamada e a repassa para o container `bussola_backend` através da rede interna do Docker (`bussola_net`).

### 🛠️ Comandos Úteis

| Ação | Comando |
| :--- | :--- |
| **Ver logs em tempo real** | `docker compose logs -f` |
| **Parar e remover containers** | `docker compose down` |
| **Status dos containers** | `docker compose ps` |
| **Limpar tudo (Reset total)** | `docker compose down -v --rmi all` |

---

# 🤝 Agradecimentos e Contato

Agradeço imensamente pelo seu interesse no **Bussola**! Este projeto foi uma jornada de aprendizado e desenvolvimento, e fico feliz em compartilhá-lo com a comunidade.

Um agradecimento especial a todas as fantásticas tecnologias e comunidades *open-source* que tornaram este projeto possível, especialmente às equipes por trás do `React`, `FastAPI`, `LangChain` e todos `LLMs`.

---

## Dúvidas, Bugs ou Sugestões?

Este projeto foi desenvolvido com base nas **minhas necessidades pessoais** e fluxos de trabalho. Por isso, é natural que algumas funcionalidades esperadas em apps comerciais de finanças ou saúde não estejam presentes, ou que existam lógicas que não se apliquem a todos.

Se você encontrar algum *bug*, notar a falta de alguma feature essencial (como um campo específico no financeiro, uma métrica de saúde, etc.) ou tiver sugestões de melhoria, **eu quero saber!** Como não sou especialista em contabilidade ou administração, o feedback da comunidade é vital para tornar o Bússola mais robusto para todos.

A melhor forma de contribuir é **abrindo uma Issue** diretamente no repositório do **GitHub**. Isso ajuda a manter tudo organizado e visível.

- **[➡️ Abrir uma Issue no GitHub](https://github.com/Marocosz/Bussola-v2/issues)**

---

## Vamos nos Conectar!

Adoraria ouvir seu *feedback* e me conectar com outros desenvolvedores e entusiastas de tecnologia. Você pode me encontrar nas seguintes plataformas:

- **Desenvolvido por:** `Marcos Rodrigues`
- 💼 **LinkedIn:** [https://www.linkedin.com/in/marcosrodriguesptc](https://www.linkedin.com/in/marcosrodriguesptc/)
- 🐙 **GitHub:** [https://github.com/Marocosz](https://github.com/Marocosz)
- 📧 **Email:** `marcosrodriguesepro@gmail.com`

Sinta-se à vontade para se conectar!