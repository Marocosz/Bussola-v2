# Agenda Status Cancelado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o status `Cancelado` ao módulo Roteiro (Agenda), com botão dedicado no card, substituindo o toggle binário por um endpoint de set_status explícito e atualizando toda a UI para refletir as novas transições de estado.

**Architecture:** Backend substitui `toggle-status` por `PATCH /{id}/status` com payload `{ status }`. Frontend substitui `toggleCompromissoStatus` por `setCompromissoStatus(id, status)` e atualiza `CompromissoCard` para exibir os botões corretos por estado.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy (backend); React 19 / Vite / Axios (frontend)

---

## File Map

| Arquivo | Ação |
|---|---|
| `bussola_api/app/services/agenda.py` | Modificar: remove `toggle_status`, adiciona `set_status` |
| `bussola_api/app/api/v1/endpoints/agenda.py` | Modificar: remove rota toggle, adiciona rota `PATCH /{id}/status` |
| `bussola_web/src/services/api.ts` | Modificar: remove `toggleCompromissoStatus`, adiciona `setCompromissoStatus`, atualiza interface `Compromisso` |
| `bussola_web/src/pages/Agenda/components/CompromissoCard.jsx` | Modificar: nova lógica de botões por status + classe `cancelado` |
| `bussola_web/src/pages/Agenda/styles.css` | Modificar: estilos para `.cancelado` no card, badge e botão cancelar |

---

### Task 1: Backend — substituir `toggle_status` por `set_status`

**Files:**
- Modify: `bussola_api/app/services/agenda.py`

- [ ] **Step 1: Abrir o arquivo de serviço**

Abrir `bussola_api/app/services/agenda.py`. Localizar o método `toggle_status` (linha ~189).

- [ ] **Step 2: Substituir `toggle_status` por `set_status`**

Remover o método `toggle_status` inteiro e substituir por:

```python
def set_status(self, db: Session, id: int, new_status: str, user_id: int):
    """Define explicitamente o status de um compromisso."""
    VALID_STATUSES = {'Realizado', 'Cancelado', 'Pendente'}
    if new_status not in VALID_STATUSES:
        return None
    comp = db.query(Compromisso).filter(
        Compromisso.id == id, Compromisso.user_id == user_id
    ).first()
    if comp:
        comp.status = new_status
        db.commit()
        db.refresh(comp)
    return comp
```

- [ ] **Step 3: Verificar que `agenda_service` (instância no final do arquivo) ainda existe**

A última linha do arquivo deve continuar sendo:
```python
agenda_service = AgendaService()
```

- [ ] **Step 4: Commit**

```bash
git add bussola_api/app/services/agenda.py
git commit -m "refactor(agenda): substituir toggle_status por set_status explícito"
```

---

### Task 2: Backend — atualizar endpoint

**Files:**
- Modify: `bussola_api/app/api/v1/endpoints/agenda.py`

- [ ] **Step 1: Adicionar import do Pydantic para o body**

No topo do arquivo, após os imports existentes, adicionar:

```python
from pydantic import BaseModel
```

- [ ] **Step 2: Criar schema inline para o body do endpoint**

Logo após os imports, antes de `router = APIRouter()`, adicionar:

```python
class StatusUpdate(BaseModel):
    status: str
```

- [ ] **Step 3: Remover a rota `toggle-status`**

Remover completamente o bloco:
```python
@router.patch("/{id}/toggle-status")
def toggle_status(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    ...
    agenda_service.toggle_status(db, id, current_user.id)
    return {"status": "success"}
```

- [ ] **Step 4: Adicionar a nova rota `PATCH /{id}/status`**

No lugar da rota removida, adicionar:

```python
@router.patch("/{id}/status")
def set_status(
    id: int,
    body: StatusUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Define explicitamente o status de um compromisso.
    Valores aceitos: 'Realizado', 'Cancelado', 'Pendente'
    """
    VALID = {'Realizado', 'Cancelado', 'Pendente'}
    if body.status not in VALID:
        raise HTTPException(status_code=400, detail=f"Status inválido. Use: {VALID}")
    result = agenda_service.set_status(db, id, body.status, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado.")
    return {"status": "success", "new_status": result.status}
```

- [ ] **Step 5: Verificar que `HTTPException` já está importado**

A linha de imports já contém `from fastapi import APIRouter, Depends, HTTPException, Query`. Se não estiver, adicionar `HTTPException`.

- [ ] **Step 6: Commit**

```bash
git add bussola_api/app/api/v1/endpoints/agenda.py
git commit -m "feat(agenda): endpoint PATCH /{id}/status substitui toggle-status"
```

---

### Task 3: Frontend — atualizar `api.ts`

**Files:**
- Modify: `bussola_web/src/services/api.ts`

- [ ] **Step 1: Atualizar interface `Compromisso`**

Localizar (linha ~618):
```typescript
status: 'Pendente' | 'Realizado' | 'Perdido';
```
Substituir por:
```typescript
status: 'Pendente' | 'Realizado' | 'Perdido' | 'Cancelado';
```

- [ ] **Step 2: Remover `toggleCompromissoStatus`**

Remover a função:
```typescript
export const toggleCompromissoStatus = async (id: number) => {
    const response = await api.patch(`/agenda/${id}/toggle-status`);
    return response.data;
};
```

- [ ] **Step 3: Adicionar `setCompromissoStatus`**

No lugar da função removida, adicionar:
```typescript
export const setCompromissoStatus = async (
    id: number,
    status: 'Realizado' | 'Cancelado' | 'Pendente'
) => {
    const response = await api.patch(`/agenda/${id}/status`, { status });
    return response.data;
};
```

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/services/api.ts
git commit -m "feat(agenda): setCompromissoStatus substitui toggleCompromissoStatus"
```

---

### Task 4: Frontend — atualizar `CompromissoCard.jsx`

**Files:**
- Modify: `bussola_web/src/pages/Agenda/components/CompromissoCard.jsx`

- [ ] **Step 1: Atualizar o import**

Localizar a linha:
```javascript
import { toggleCompromissoStatus, deleteCompromisso } from '../../../services/api';
```
Substituir por:
```javascript
import { setCompromissoStatus, deleteCompromisso } from '../../../services/api';
```

- [ ] **Step 2: Substituir `handleToggle` por `handleSetStatus`**

Remover:
```javascript
const handleToggle = async () => {
    await toggleCompromissoStatus(comp.id);
    onUpdate();
};
```
Adicionar:
```javascript
const handleSetStatus = async (newStatus) => {
    await setCompromissoStatus(comp.id, newStatus);
    onUpdate();
};
```

- [ ] **Step 3: Atualizar `statusClass`**

Localizar o bloco:
```javascript
let statusClass = 'pendente';
if(comp.status === 'Realizado') statusClass = 'realizado';
if(comp.status === 'Perdido') statusClass = 'perdido';
```
Substituir por:
```javascript
let statusClass = 'pendente';
if(comp.status === 'Realizado') statusClass = 'realizado';
if(comp.status === 'Perdido') statusClass = 'perdido';
if(comp.status === 'Cancelado') statusClass = 'cancelado';
```

- [ ] **Step 4: Remover a variável `isRealizado` e substituir o rodapé**

Remover:
```javascript
const isRealizado = comp.status === 'Realizado';
```

Localizar o bloco `{/* 4. RODAPÉ (Status Esquerda | Botão Direita) */}` inteiro e substituir por:

```jsx
{/* 4. RODAPÉ (Status Esquerda | Botões Direita) */}
<div className="card-footer-row">

    {/* Status na Esquerda */}
    <span className={`status-badge-modern ${statusClass}`}>
        {comp.status}
    </span>

    {/* Botões na Direita */}
    <div className="footer-actions">
        {comp.status === 'Pendente' && (
            <>
                <button
                    className="btn-cancelar-action"
                    onClick={() => handleSetStatus('Cancelado')}
                >
                    <i className="fa-solid fa-xmark"></i> Cancelar
                </button>
                <button
                    className="btn-concluir-action complete"
                    onClick={() => handleSetStatus('Realizado')}
                >
                    Concluir <i className="fa-solid fa-check"></i>
                </button>
            </>
        )}
        {comp.status === 'Realizado' && (
            <button
                className="btn-concluir-action undo"
                onClick={() => handleSetStatus('Pendente')}
            >
                <i className="fa-solid fa-rotate-left"></i> Reabrir
            </button>
        )}
        {comp.status === 'Perdido' && (
            <>
                <button
                    className="btn-cancelar-action"
                    onClick={() => handleSetStatus('Cancelado')}
                >
                    <i className="fa-solid fa-xmark"></i> Cancelar
                </button>
                <button
                    className="btn-concluir-action complete"
                    onClick={() => handleSetStatus('Realizado')}
                >
                    Concluir <i className="fa-solid fa-check"></i>
                </button>
            </>
        )}
        {comp.status === 'Cancelado' && (
            <>
                <button
                    className="btn-concluir-action complete"
                    onClick={() => handleSetStatus('Realizado')}
                >
                    Concluir <i className="fa-solid fa-check"></i>
                </button>
                <button
                    className="btn-concluir-action undo"
                    onClick={() => handleSetStatus('Pendente')}
                >
                    <i className="fa-solid fa-rotate-left"></i> Reabrir
                </button>
            </>
        )}
    </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add bussola_web/src/pages/Agenda/components/CompromissoCard.jsx
git commit -m "feat(agenda): lógica de botões por status incluindo Cancelado"
```

---

### Task 5: Frontend — adicionar estilos CSS para `Cancelado`

**Files:**
- Modify: `bussola_web/src/pages/Agenda/styles.css`

- [ ] **Step 1: Adicionar estilo de borda do card cancelado**

Localizar o bloco:
```css
.compromisso-card-modern.perdido {
    border-left: 5px solid var(--cor-vermelho-delete);
}
```
Logo após, adicionar:
```css
.compromisso-card-modern.cancelado {
    border-left: 5px solid #6b7280;
    opacity: 0.8;
}
```

- [ ] **Step 2: Adicionar estilo do badge cancelado**

Localizar o bloco:
```css
.status-badge-modern.perdido {
    background: rgba(231, 76, 60, 0.15);
    color: #e74c3c;
}
```
Logo após, adicionar:
```css
.status-badge-modern.cancelado {
    background: rgba(107, 114, 128, 0.15);
    color: #9ca3af;
}
```

- [ ] **Step 3: Adicionar estilo do botão Cancelar e ajustar `.footer-actions`**

Localizar o bloco `.btn-concluir-action.undo:hover { ... }`. Logo após, adicionar:

```css
.footer-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.btn-cancelar-action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--cor-vermelho-delete);
    color: var(--cor-vermelho-delete);
    transition: all 0.2s;
}

.btn-cancelar-action:hover {
    background: rgba(231, 76, 60, 0.1);
    transform: translateY(-1px);
}
```

- [ ] **Step 4: Commit**

```bash
git add bussola_web/src/pages/Agenda/styles.css
git commit -m "feat(agenda): estilos para status Cancelado e botão cancelar"
```

---

### Task 6: Verificação manual

- [ ] **Step 1: Subir o backend**

```bash
cd bussola_api
source venvbussola2/Scripts/activate   # Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- [ ] **Step 2: Subir o frontend**

```bash
cd bussola_web
npm run dev
```

- [ ] **Step 3: Verificar fluxo completo**

Testar cada transição na UI:
1. Criar compromisso → status `Pendente` → botões [Cancelar] [Concluir] aparecem
2. Clicar "Concluir" → status vira `Realizado` → botão [Reabrir] aparece
3. Clicar "Reabrir" em `Realizado` → volta para `Pendente`
4. Clicar "Cancelar" em `Pendente` → status vira `Cancelado` → botões [Concluir] [Reabrir] aparecem
5. No compromisso `Cancelado`: clicar "Concluir" → vai para `Realizado`
6. No compromisso `Cancelado`: clicar "Reabrir" → volta para `Pendente`
7. Criar compromisso com data no passado → status auto `Perdido` → botões [Cancelar] [Concluir] aparecem
8. No `Perdido`: clicar "Concluir" → vai para `Realizado`
9. No `Perdido`: clicar "Cancelar" → vai para `Cancelado`
10. Verificar cores: azul (Pendente), verde (Realizado), vermelho (Perdido), cinza (Cancelado)

- [ ] **Step 4: Verificar endpoint diretamente (Swagger)**

Acessar http://localhost:8000/docs → testar `PATCH /agenda/{id}/status` com `{ "status": "Cancelado" }`, `{ "status": "Realizado" }` e um status inválido (deve retornar 400).
