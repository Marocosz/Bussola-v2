# Design: Status "Cancelado" no Módulo Roteiro (Agenda)

**Data:** 2026-03-28
**Status:** Aprovado

---

## Contexto

O módulo Roteiro (Agenda) possui atualmente 3 estados de compromisso: `Pendente`, `Realizado` e `Perdido` (auto-atribuído quando o horário passa sem conclusão). A solicitação é adicionar o status `Cancelado` com botão dedicado no card, mantendo a lógica de `Perdido` e permitindo reabrir compromissos perdidos/cancelados diretamente para `Realizado` ou `Cancelado`.

---

## Estados e Transições

```
[Novo] → Pendente
Pendente → Realizado    (botão "Concluir")
Pendente → Cancelado    (botão "Cancelar")
Pendente → Perdido      (automático: horário passou)
Realizado → Pendente    (botão "Reabrir")
Perdido → Realizado     (botão "Concluir")
Perdido → Cancelado     (botão "Cancelar")
Cancelado → Realizado   (botão "Concluir")
Cancelado → Pendente    (botão "Reabrir")
```

---

## Backend

### Service (`bussola_api/app/services/agenda.py`)
- **Remove** `toggle_status`
- **Adiciona** `set_status(db, id, new_status, user_id)`:
  - Valores aceitos: `'Realizado'`, `'Cancelado'`, `'Pendente'`
  - Filtra por `id` + `user_id` (segurança multi-tenant)
  - Retorna o compromisso atualizado ou `None` se não encontrado

### Endpoint (`bussola_api/app/api/v1/endpoints/agenda.py`)
- **Remove** `PATCH /{id}/toggle-status`
- **Adiciona** `PATCH /{id}/status`:
  - Body: `{ "status": "Realizado" | "Cancelado" | "Pendente" }`
  - Valida valores permitidos (400 se inválido)
  - Delega para `agenda_service.set_status`

### Model (`bussola_api/app/models/agenda.py`)
- Sem alteração — `status = Column(String(50))` já aceita `Cancelado`

### Schema (`bussola_api/app/schemas/agenda.py`)
- Sem alteração obrigatória (status é `str`), mas documentar os valores válidos no endpoint

---

## Frontend

### `bussola_web/src/services/api.ts`
- **Remove** `toggleCompromissoStatus`
- **Adiciona** `setCompromissoStatus(id: number, status: 'Realizado' | 'Cancelado' | 'Pendente')`
- **Atualiza** interface `Compromisso`: `status: 'Pendente' | 'Realizado' | 'Perdido' | 'Cancelado'`

### `CompromissoCard.jsx`
Lógica de botões no rodapé por status:

| Status | Botões |
|---|---|
| `Pendente` | `[Concluir ✓]` `[Cancelar ✕]` |
| `Realizado` | `[Reabrir ↩]` (volta para Pendente) |
| `Perdido` | `[Concluir ✓]` `[Cancelar ✕]` |
| `Cancelado` | `[Concluir ✓]` `[Reabrir ↩]` (volta para Pendente) |

- `statusClass` ganha case `cancelado`
- Badge e borda esquerda usam cor cinza para `Cancelado`

### `styles.css`
```css
/* Card border */
.compromisso-card-modern.cancelado {
    border-left: 5px solid #6b7280;
    opacity: 0.8;
}

/* Status badge */
.status-badge-modern.cancelado {
    background: rgba(107, 114, 128, 0.15);
    color: #9ca3af;
}

/* Botão Cancelar (outline vermelho suave) */
.btn-cancelar-action {
    background: transparent;
    border: 1px solid var(--cor-vermelho-delete);
    color: var(--cor-vermelho-delete);
    /* mesma estrutura de padding/border-radius do btn-concluir-action */
}
.btn-cancelar-action:hover {
    background: rgba(231, 76, 60, 0.1);
}
```

---

## O que NÃO muda

- Lógica de auto-`Perdido` no `get_dashboard` (só afeta `Pendente`)
- Estrutura do modal de criação/edição
- Calendário visual e tooltips
- Lógica de deleção
