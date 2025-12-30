# 📅 Módulo Roteiro (Agenda)

O módulo **Roteiro** é o sistema de **Gestão Temporal** do Bússola V2. Ele oferece uma visão unificada dos compromissos do usuário, combinando uma lista cronológica detalhada com um calendário visual interativo e navegável.

> [!TIP]
> **Objetivo:** Permitir que o usuário visualize seu mês rapidamente, gerencie prazos, navegue entre datas passadas/futuras e acompanhe o status de execução de eventos.

---

## 📂 Arquitetura e Arquivos

O módulo centraliza a lógica pesada de cálculo de datas no **Backend**, mas empodera o **Frontend** com capacidades de filtro local e memoização para alta performance.

| Camada | Arquivo | Responsabilidade |
| :--- | :--- | :--- |
| **Controller** | `app/api/endpoints/agenda.py` | Exposição de rotas HTTP. Aceita parâmetros opcionais `mes` e `ano` para navegação temporal. |
| **Service** | `app/services/agenda.py` | **Core Logic Híbrida.** Gera o grid do calendário específico para o mês solicitado, mas busca o histórico completo para a lista lateral. Otimizado com mapas de dicionário $O(1)$. |
| **Model** | `app/models/agenda.py` | Tabela `compromisso` com colunas de data, local, descrição e status. |
| **Frontend** | `src/pages/Roteiro/index.jsx` | Lógica de UI complexa: Busca textual local, Ordenação (Recente/Antigo), Navegação de Mês e Memoização (`React.memo`) para evitar re-renders. |
| **Estilos** | `src/pages/Roteiro/styles.css` | Design de colunas duplas, tratamento de scrollbars e animações de tooltip. |

---

## 🧠 Lógica de Negócio e Funcionalidades

### 1. Estratégia de Busca Híbrida (Backend)

Para atender aos requisitos de UX onde a lista lateral deve permitir busca em todo o histórico, enquanto o calendário foca em um mês específico, o endpoint `GET /agenda/` adota uma estratégia dupla:

1.  **Lista Lateral (Esquerda):** O Backend busca **todos** os compromissos do usuário (passado e futuro) ordenados por data. Isso permite que o Frontend aplique filtros de busca e ordenação instantâneos sem novas requisições.
2.  **Grid de Calendário (Direita):** O Backend utiliza os parâmetros `mes` e `ano` da URL para calcular matematicamente apenas os dias (e paddings) daquele mês específico.

### 2. Otimização de Performance (Backend & Frontend)

* **Backend ($O(1)$ Lookup):** Ao gerar o grid do calendário, o serviço converte a lista de compromissos em um dicionário (Hash Map) agrupado por data (`{ '2025-01-01': [...] }`). Isso elimina a necessidade de iterar a lista inteira para cada célula do calendário, reduzindo drasticamente o tempo de processamento.
* **Frontend (Memoization):** Utiliza `React.memo` nos sub-componentes `CalendarDay` e `MonthGroup`, além de `useCallback` nos handlers. Isso impede que a interface inteira trave ou pisque ao passar o mouse sobre os dias para ver os Tooltips.

### 3. Ciclo de Vida do Compromisso (Auto-Update)

O sistema possui uma lógica de atualização passiva de status. Sempre que o usuário solicita o Dashboard:

> [!NOTE]
> **Regra de Negócio (Status 'Perdido'):**
> Se um compromisso possui status `Pendente` e sua `data_hora` é anterior ao momento atual (`now`), o sistema altera automaticamente o status para `Perdido` antes de devolver a resposta.

---

## 🎨 UX, UI e Comportamento

O design adota um layout de colunas duplas para maximizar a densidade de informação sem poluir a tela.

### A. Coluna Esquerda: Lista de Gestão
* **Header Rico:** Contém barra de busca textual (estilo Registros), botão de ordenação (Mais Recente <-> Mais Antigo) e botão de adicionar.
* **Busca Local:** A filtragem por texto acontece no cliente (Client-side filtering), proporcionando feedback instantâneo enquanto o usuário digita.
* **Accordions Informativos:** Os grupos mensais mostram, no lado direito do cabeçalho, um badge com a contagem exata de itens (ex: "5 compromissos").

### B. Coluna Direita: Calendário de Navegação
* **Navegação Temporal:** O título do mês possui setas `<` e `>` que disparam novas requisições ao backend para recalcular o grid visual, sem perder o estado da lista da esquerda.
* **Smart Tooltip:** Ao passar o mouse sobre um dia, um tooltip flutuante exibe os detalhes. Graças à memoização, essa ação é fluida e não causa re-render no resto da página.

### C. Ações Rápidas (Toggle Status)
O botão de "Concluir" no card dispara uma rota específica `PATCH /{id}/toggle-status`. Isso oferece uma resposta instantânea na interface, permitindo que o usuário marque vários itens como feitos em sequência rapidamente.

---

## 📸 Estrutura de Dados (Model)

### `Compromisso`
A entidade principal que representa um evento no tempo.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | Integer | Chave primária. |
| `titulo` | String | Nome do evento. |
| `descricao` | Text | Detalhes opcionais. |
| `local` | String | Endereço ou Link (Google Meet/Zoom). |
| `data_hora` | DateTime | O momento exato do evento. Usado para ordenação e lógica de 'Perdido'. |
| `status` | String | `Pendente`, `Realizado` ou `Perdido`. |
| `lembrete` | Boolean | Flag para futuros workers de notificação. |
| `user_id` | FK | Isolamento de dados por usuário (Multi-tenancy). |

---

## 🔌 API Endpoints

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/agenda/?mes=X&ano=Y` | **Dashboard.** Retorna grid do calendário (filtrado por mes/ano) e lista completa. |
| `POST` | `/agenda/` | Cria novo compromisso. |
| `PUT` | `/agenda/{id}` | Atualiza dados (título, data, local, etc). |
| `PATCH`| `/agenda/{id}/toggle-status` | Alterna status entre `Pendente` e `Realizado`. |
| `DELETE` | `/agenda/{id}` | Remove o compromisso permanentemente. |