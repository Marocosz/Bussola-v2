import React, { useState } from 'react';

// Um nó editável da árvore de subtarefas.
function TreeNode({ sub, path, onToggle, onDelete, onAddChild, level }) {
    const [isAdding, setIsAdding] = useState(false);
    const [childTitle, setChildTitle] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!childTitle.trim()) return;
        onAddChild(path, childTitle.trim());
        setChildTitle('');
        setIsAdding(false);
    };

    return (
        <div className="kb-tree-node">
            <div className="kb-tree-row">
                <i
                    className={`fa-regular ${sub.concluido ? 'fa-square-check' : 'fa-square'} kb-tree-check`}
                    onClick={() => onToggle(path)}
                ></i>
                <span className={`kb-tree-title ${sub.concluido ? 'kb-riscado' : ''}`}>{sub.titulo}</span>
                <div className="kb-tree-actions">
                    {level < 4 && (
                        <button type="button" className="kb-icon-btn" onClick={() => setIsAdding(v => !v)} title="Sub-etapa">
                            <i className="fa-solid fa-plus"></i>
                        </button>
                    )}
                    <button type="button" className="kb-icon-btn danger" onClick={() => onDelete(path)} title="Remover">
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="kb-tree-add">
                    <input
                        className="form-input" autoFocus value={childTitle}
                        onChange={e => setChildTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(e)}
                        placeholder="Nome da sub-etapa..."
                    />
                    <button type="button" className="btn-primary kb-mini" onClick={handleAdd}><i className="fa-solid fa-check"></i></button>
                    <button type="button" className="btn-secondary kb-mini" onClick={() => setIsAdding(false)}><i className="fa-solid fa-xmark"></i></button>
                </div>
            )}

            {sub.subtarefas && sub.subtarefas.length > 0 && (
                <div className="kb-tree-children">
                    {sub.subtarefas.map((child, i) => (
                        <TreeNode
                            key={i} sub={child} path={[...path, i]}
                            onToggle={onToggle} onDelete={onDelete} onAddChild={onAddChild}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function SubtaskTree({ subtarefas, onChange }) {
    const [novaRaiz, setNovaRaiz] = useState('');

    const clone = () => JSON.parse(JSON.stringify(subtarefas));

    const nodeAt = (arr, path) => {
        let node = { subtarefas: arr };
        for (const idx of path) node = node.subtarefas[idx];
        return node;
    };

    const addRaiz = (e) => {
        if (e) e.preventDefault();
        if (!novaRaiz.trim()) return;
        onChange([...subtarefas, { titulo: novaRaiz.trim(), concluido: false, subtarefas: [] }]);
        setNovaRaiz('');
    };

    const addChild = (path, titulo) => {
        const next = clone();
        const parent = nodeAt(next, path);
        if (!parent.subtarefas) parent.subtarefas = [];
        parent.subtarefas.push({ titulo, concluido: false, subtarefas: [] });
        onChange(next);
    };

    const toggle = (path) => {
        const next = clone();
        const node = nodeAt(next, path);
        node.concluido = !node.concluido;
        onChange(next);
    };

    const remove = (path) => {
        const next = clone();
        const parentPath = path.slice(0, -1);
        const idx = path[path.length - 1];
        const parentArr = parentPath.length ? nodeAt(next, parentPath).subtarefas : next;
        parentArr.splice(idx, 1);
        onChange(next);
    };

    return (
        <div className="kb-subtree">
            <div className="kb-tree-addroot">
                <input
                    className="form-input" value={novaRaiz}
                    onChange={e => setNovaRaiz(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRaiz(e)}
                    placeholder="Adicionar etapa principal..."
                />
                <button type="button" className="btn-secondary kb-mini" onClick={addRaiz}><i className="fa-solid fa-plus"></i></button>
            </div>
            {subtarefas.length === 0
                ? <div className="kb-tree-empty">Nenhuma subtarefa.</div>
                : subtarefas.map((sub, i) => (
                    <TreeNode
                        key={i} sub={sub} path={[i]}
                        onToggle={toggle} onDelete={remove} onAddChild={addChild} level={0}
                    />
                ))}
        </div>
    );
}
