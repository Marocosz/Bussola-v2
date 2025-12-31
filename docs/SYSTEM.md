# ⚙️ Arquitetura de Sistema e Infraestrutura (System Core)

> **Documento Técnico Nível 2** > Este arquivo detalha o funcionamento interno, configurações de ambiente e a arquitetura de integração do **Bússola V2**. Enquanto o `README.md` apresenta o produto, este documento explica "como a mágica acontece" no backend e na camada de dados.

---

## 1. Ciclo de Vida da Aplicação (`main.py`)

O ponto de entrada do Backend é o arquivo `app/main.py`. O ciclo de inicialização segue uma ordem estrita para garantir estabilidade antes de aceitar requisições:

1.  **Carregamento de Ambiente:** O `dotenv` é carregado imediatamente para injetar as variáveis do arquivo `.env` no sistema operacional.
2.  **Bootstrap do Banco de Dados:**
    * O sistema verifica a conexão com o banco.
    * Executa `Base.metadata.create_all(bind=engine)`. Isso garante que, se o banco estiver vazio (primeiro deploy), todas as tabelas (User, Finanças, etc.) sejam criadas automaticamente sem precisar rodar migrações manuais.
3.  **Configuração de Middlewares:**
    * **CORS:** Configurado via `BACKEND_CORS_ORIGINS` para permitir que o Frontend (React) em portas diferentes converse com a API.
    * **SlowAPI (Rate Limiter):** Inicializa o limitador de requisições baseado no IP do cliente (`get_remote_address`) para proteger contra *Brute Force* e *DDoS*.
4.  **Registro de Rotas:** Importa o `api_router` central e o acopla à aplicação com o prefixo `/api/v1`.

---

## 2. Configuração e Variáveis de Ambiente (`.env`)

O sistema utiliza a biblioteca `pydantic-settings` (`app/core/config.py`) para validar e tipar as configurações. Abaixo, a referência completa de todas as variáveis suportadas:

### 🔐 Segurança e Core
| Variável | Obrigatório | Descrição |
| :--- | :---: | :--- |
| `SECRET_KEY` | **SIM** | Chave mestra (hash) usada para assinar Tokens JWT. Se vazada, invalida toda a segurança. |
| `ENCRYPTION_KEY` | **SIM** | Chave simétrica usada pelo módulo **Cofre** para criptografar senhas no banco. |
| `ALGORITHM` | Não | Algoritmo de assinatura JWT. Padrão: `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Não | Tempo de vida do token de acesso. Padrão: `15`. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Não | Tempo de vida do refresh token. Padrão: `7` (SaaS) ou `30` (Self-Hosted). |

### 🏗️ Infraestrutura
| Variável | Obrigatório | Descrição |
| :--- | :---: | :--- |
| `DATABASE_URL` | **SIM** | Connection string (ex: `postgresql://user:pass@db:5432/bussola` ou `sqlite:///./bussola.db`). |
| `REDIS_URL` | **SIM** | URL do Redis para Cache e Rate Limiting (ex: `redis://localhost:6379/0`). |
| `BACKEND_CORS_ORIGINS` | Não | Lista de URLs permitidas para acessar a API (separadas por vírgula ou JSON). |

### 🤖 Integrações e IA
| Variável | Obrigatório | Descrição |
| :--- | :---: | :--- |
| `OPENWEATHER_API_KEY` | **SIM** | Chave da OpenWeatherMap para o widget de clima na Home. |
| `NEWS_API_KEY` | **SIM** | (Legado) Chave para API de notícias. O novo sistema usa RSS, mas mantemos para fallback. |
| `GROQ_API_KEY` | Não | Provedor de IA de baixíssima latência (Recomendado para Agents). |
| `OPENAI_API_KEY` | Não | Chave da OpenAI (GPT-4o/Mini). |
| `GEMINI_API_KEY` | Não | Chave do Google Gemini. |
| `LLM_PROVIDER` | Não | Define qual IA o sistema usará: `groq`, `openai` ou `gemini`. |

### 💼 Regras de Negócio (Deploy)
| Variável | Padrão | Efeito no Sistema |
| :--- | :--- | :--- |
| `DEPLOYMENT_MODE` | `SELF_HOSTED` | Define o comportamento macro. <br>• **SAAS:** Ativa verificação de e-mail, rate limits rígidos e Stripe. <br>• **SELF_HOSTED:** Libera recursos premium, rate limits relaxados. |
| `ENABLE_PUBLIC_REGISTRATION`| `True` | Se `False`, bloqueia a criação de novas contas (útil para servidor privado). |

### 📧 SMTP e Auth Social
| Variável | Descrição |
| :--- | :--- |
| `MAIL_SERVER`, `MAIL_PORT`, etc. | Configurações para envio de e-mails transacionais (Reset de Senha/Verificação). |
| `GOOGLE_CLIENT_ID` | Ativa o botão "Entrar com Google" no frontend. |
| `DISCORD_CLIENT_ID` | Ativa integração com Discord. |

---

## 3. Camada de Dados e Sessão (`app/db`)

O backend utiliza o padrão **Dependency Injection** para gerenciar conexões com o banco de dados, garantindo que não haja vazamento de conexões (connection leaks).

* **Engine (`session.py`):** Configurada com `pool_pre_ping=True`. Isso faz a API testar a conexão antes de usá-la, evitando erros 500 se o banco reiniciar.
    * *SQLite Hack:* Se detectar SQLite, adiciona `check_same_thread=False` para permitir multithreading.
* **Base (`base.py`):** Atua como um registro central. Importa todos os modelos (`User`, `Transacao`, `RitmoBio`, etc.) para que o `Alembic` consiga detectar mudanças e gerar migrações automáticas.

---

## 4. Roteamento e Modularização (`app/api`)

O arquivo `router.py` atua como um **Gateway Central**. Ele não contém lógica, apenas agrega os "Sub-routers" de cada módulo.

**Mapa de Prefixos (v1):**
* `/auth` -> Login, Logout, Refresh, Registro.
* `/users` -> Perfil, Admin, Verificação de E-mail.
* `/home` -> Dados externos (Clima, Notícias).
* `/financas`, `/agenda`, `/ritmo` -> Módulos de domínio específicos.
* `/system` -> Configurações globais expostas ao front.

---

## 5. Módulo Home e Dados Externos (`app/services/external.py`)

Este módulo é responsável por enriquecer o dashboard inicial sem sobrecarregar o banco de dados local. Ele implementa um padrão de **Cache-Aside** robusto usando Redis.

### Arquitetura de Notícias (RSS Aggregator)
O Bússola V2 possui um agregador de notícias próprio, eliminando a dependência de APIs pagas.

1.  **Configuração (`TOPIC_CONFIG`):** Um dicionário mapeia tópicos (`tech`, `finance`, `crypto`) para listas de URLs RSS (G1, TechCrunch, etc.) e regras de filtro.
2.  **Filtragem Inteligente:**
    * **Blocklist:** Remove artigos com termos como "promoção", "cupom", "patrocinado".
    * **Keywords:** Garante relevância (ex: em `tech`, prioriza "AI", "Apple", "Linux").
3.  **Paralelismo (Performance):**
    * O parsing de XML (RSS) é uma operação bloqueante (CPU/IO bound).
    * O serviço utiliza `ThreadPoolExecutor` para baixar e processar múltiplos feeds simultaneamente, reduzindo o tempo de resposta de ~4s para ~0.8s.
4.  **Cache:** O resultado processado é salvo no Redis com TTL de 1 hora.

### Serviço de Clima (OpenWeather)
1.  Frontend solicita `/api/v1/home/weather`.
2.  Backend verifica cache `weather:{cidade}`.
3.  Se vazio, consulta a API da OpenWeatherMap.
4.  Cacheia o resultado por 30 minutos.
5.  Normaliza os ícones para classes CSS (`wi-day-sunny`, `wi-rain`), desacoplando o frontend da API externa.

---

## 6. Integração Frontend-Backend (`system.py`)

O endpoint `/api/v1/system/config` é vital para a experiência do usuário (UX). Ele é chamado assim que a aplicação React inicia.

**Feature Flags Dinâmicas:**
O backend informa ao frontend quais recursos estão disponíveis.
* *Exemplo:* Se o administrador não configurar `GOOGLE_CLIENT_ID` no `.env`, o backend retorna `google_login_enabled: false`. O React, ao ler isso, **remove automaticamente** o botão "Entrar com Google" da tela de login, evitando erros de clique.

**Bootstrap de Instalação:**
No modo `SELF_HOSTED`, se o sistema detecta que há **0 usuários** no banco, ele força a variável `public_registration: true` na resposta da API, permitindo que o dono do servidor crie sua conta Admin, mesmo que a configuração padrão seja de registro fechado.

---