# 📅 Módulo Roteiro (Agenda)

O módulo **Roteiro** é o sistema de **Gestão Temporal** do Bússola V2. Ele oferece uma visão unificada dos compromissos do usuário, combinando uma lista cronológica detalhada com um calendário visual interativo.

> [!TIP]
> **Objetivo:** Permitir que o usuário visualize seu mês rapidamente, gerencie prazos e acompanhe o status de execução de eventos (Pendentes vs. Realizados).

---

## 📂 Arquitetura e Arquivos

O módulo centraliza a lógica pesada de cálculo de datas no **Backend**, entregando para o Frontend uma estrutura pronta para renderização (Server-Driven UI parcial para o grid).

| Camada | Arquivo | Responsabilidade |
| :--- | :--- | :--- |
| **Controller** | `app/api/endpoints/agenda.py` | Exposição de rotas HTTP, injeção de dependência de usuário e validação Pydantic. |
| **Service** | `app/services/agenda.py` | **Core Logic.** Gera o grid do calendário (dias, padding), gerencia status automático (Perdido) e CRUD. |
| **Model** | `app/models/agenda.py` | Tabela `compromisso` com colunas de data, local, descrição e status. |
| **Schema** | `app/schemas/agenda.py` | DTOs de entrada e saída, incluindo a estrutura complexa do `CalendarDay` para o grid visual. |
| **Frontend** | `src/pages/Roteiro/index.jsx` | Renderização da tela dividida (Lista vs Calendário), Tooltips e Gestão de Estado (Accordions). |
| **Componente**| `CompromissoCard.jsx` | Card inteligente com ações de concluir, editar e excluir, além de estilização por status. |

---

## 🧠 Lógica de Negócio e Funcionalidades

### 1. Grid de Calendário (Processamento no Backend)

Ao contrário de muitas aplicações que enviam apenas uma lista de datas e deixam o Frontend calcular o calendário, o Bússola V2 realiza o cálculo matemático do grid no **Service (`agenda_service._generate_month_grid`)**.

* **Grid Completo (7 Colunas):** O sistema calcula os dias de "Padding" (dias do mês anterior ou posterior) necessários para preencher a primeira e a última semana do mês, garantindo que o calendário visual seja sempre um retângulo perfeito.
* **Performance:** Isso evita loops complexos de data no JavaScript do navegador, centralizando a lógica de tempo no Python (`datetime` e `dateutil`).

```python
# Exemplo da estrutura retornada para o Frontend (CalendarDay)
{
    "type": "day",
    "day_number": "31",
    "weekday_short": "Ter",
    "is_today": false,
    "is_padding": true, // Dia pertence ao mês anterior, renderizar cinza
    "compromissos": [...] // Lista leve para o Tooltip
}
```

### 2. Ciclo de Vida do Compromisso (Auto-Update)

O sistema possui uma lógica de atualização passiva de status. Sempre que o usuário solicita o Dashboard (`GET /`), o serviço verifica a integridade temporal dos dados:

> [!NOTE]
> **Regra de Negócio (Status 'Perdido'):**
> Se um compromisso possui status `Pendente` e sua `data_hora` é anterior ao momento atual (`now`), o sistema altera automaticamente o status para `Perdido` antes de devolver a resposta. Isso mantém a agenda atualizada sem a necessidade de Jobs assíncronos complexos.

### 3. Dashboard Agregado

A rota `GET /` retorna um payload híbrido (`AgendaDashboardResponse`) contendo duas estruturas principais para alimentar as duas colunas da UI simultaneamente:
1.  **`compromissos_por_mes`**: Um dicionário agrupado (ex: "Janeiro/2025") para a lista lateral.
2.  **`calendar_days`**: Uma lista linear contendo dias e divisores de mês para desenhar o grid do calendário.

---

## 🎨 UX, UI e Comportamento

O design adota um layout de colunas duplas para maximizar a densidade de informação sem poluir a tela.

### A. Coluna Esquerda: Lista Detalhada (Accordions)
* **Navegação por Mês:** Os compromissos são agrupados em accordions mensais. O estado de "aberto/fechado" é persistido no `localStorage` (`@Bussola:agenda_accordions`), lembrando a preferência do usuário entre sessões.
* **Cards Modernos:** O `CompromissoCard` exibe visualmente o status através de cores:
    * 🔵 **Pendente:** Padrão.
    * 🟢 **Realizado:** Opacidade reduzida, botão de "Reabrir" disponível.
    * 🔴 **Perdido:** Indicador visual de alerta.

### B. Coluna Direita: Calendário Interativo
* **Visualização Rápida:** O grid mostra apenas indicadores visuais (bolinhas).
* **Smart Tooltip:** Ao passar o mouse sobre um dia (`onMouseEnter`), o sistema calcula a posição da tela e exibe um Tooltip flutuante (`position: absolute`) listando os títulos e horários dos eventos daquele dia. Isso evita que o calendário fique ilegível com muito texto.

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
| `GET` | `/agenda/` | **Dashboard.** Retorna grid do calendário e lista agrupada. Atualiza status 'Perdido'. |
| `POST` | `/agenda/` | Cria novo compromisso. |
| `PUT` | `/agenda/{id}` | Atualiza dados (título, data, local, etc). |
| `PATCH`| `/agenda/{id}/toggle-status` | Alterna status entre `Pendente` e `Realizado`. |
| `DELETE` | `/agenda/{id}` | Remove o compromisso permanentemente. |