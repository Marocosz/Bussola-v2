import React, { useState, useEffect, useRef } from 'react';
import { createTarefa, updateTarefa, addSubtarefa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import '../styles.css';

// --- COMPONENTE RECURSIVO PARA O MODAL (VISUAL ÁRVORE) ---
const ModalSubtaskEdit = ({ sub, index, path, onUpdate, onDelete, onAddChild }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newChildTitle, setNewChildTitle] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (newChildTitle.trim()) {
            onAddChild(path, newChildTitle);
            setNewChildTitle('');
            setIsAdding(false);
        }
    };

    return (
        <div className="tree-node">
            {/* Conteúdo do Item */}
            <div className="tree-item-content">
                <div className="tree-text">
                    <i className={`fa-regular ${sub.concluido ? 'fa-square-check' : 'fa-square'}`}></i>
                    <span style={{ textDecoration: sub.concluido ? 'line-through' : 'none', opacity: sub.concluido ? 0.6 : 1 }}>
                        {sub.titulo}
                    </span>
                </div>
                
                <div className="tree-actions">
                    <button type="button" className="btn-icon-sm" onClick={() => setIsAdding(!isAdding)} title="Adicionar sub-tarefa">
                        <i className="fa-solid fa-plus"></i>
                    </button>
                    <button type="button" className="btn-icon-sm delete" onClick={() => onDelete(path)} title="Remover">
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            {/* Input para adicionar filho (Aparece ao clicar no +) */}
            {isAdding && (
                <div className="tree-children">
                    <div className="add-child-input-row">
                        <input 
                            className="form-input" 
                            style={{ height: '32px', fontSize: '0.85rem' }} 
                            value={newChildTitle}
                            onChange={e => setNewChildTitle(e.target.value)}
                            placeholder="Nome da sub-tarefa..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleAdd(e)}
                        />
                        <button type="button" className="btn-primary" style={{width:'32px', height:'32px', padding:0, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={handleAdd}>
                            <i className="fa-solid fa-check"></i>
                        </button>
                        <button type="button" className="btn-secondary" style={{width:'32px', height:'32px', padding:0, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setIsAdding(false)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Renderiza Filhos Recursivamente (Se houver) */}
            {sub.subtarefas && sub.subtarefas.length > 0 && (
                <div className="tree-children">
                    {sub.subtarefas.map((child, i) => (
                        <ModalSubtaskEdit 
                            key={i} 
                            sub={child} 
                            index={i} 
                            path={[...path, i]} // Mantém o rastro da árvore
                            onUpdate={onUpdate} 
                            onDelete={onDelete} 
                            onAddChild={onAddChild} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function TarefaModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    
    // States
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState('Média');
    const [prazo, setPrazo] = useState('');
    
    // Árvore de Subtarefas
    const [subtarefas, setSubtarefas] = useState([]);
    const [novaSubRaiz, setNovaSubRaiz] = useState('');
    
    const [prioDropdownOpen, setPrioDropdownOpen] = useState(false);
    const prioWrapperRef = useRef(null);
    const [loading, setLoading] = useState(false);

    const prioOptions = [
        { value: 'Baixa', label: 'Baixa', color: '#10b981' },
        { value: 'Média', label: 'Média', color: '#3b82f6' },
        { value: 'Alta', label: 'Alta', color: '#f59e0b' },
        { value: 'Crítica', label: 'Crítica', color: '#ef4444' }
    ];

    // Carregar dados
    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                setDescricao(editingData.descricao || '');
                setPrioridade(editingData.prioridade || 'Média');
                setPrazo(editingData.prazo ? editingData.prazo.split('T')[0] : '');
                // Importante: Deep copy para não mutar o original diretamente antes de salvar
                setSubtarefas(editingData.subtarefas ? JSON.parse(JSON.stringify(editingData.subtarefas)) : []); 
            } else {
                setTitulo('');
                setDescricao('');
                setPrioridade('Média');
                setPrazo('');
                setSubtarefas([]);
            }
            setNovaSubRaiz('');
            setPrioDropdownOpen(false);
        }
    }, [active, editingData]);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        function handleClickOutside(event) {
            if (prioWrapperRef.current && !prioWrapperRef.current.contains(event.target)) {
                setPrioDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, []);

    // --- LÓGICA DE MANIPULAÇÃO DA ÁRVORE ---

    const addSubRaiz = (e) => {
        if(e) e.preventDefault();
        if (!novaSubRaiz.trim()) return;
        setSubtarefas([...subtarefas, { titulo: novaSubRaiz, concluido: false, subtarefas: [] }]);
        setNovaSubRaiz('');
    };

    const addChildToNode = (path, title) => {
        const newSubs = JSON.parse(JSON.stringify(subtarefas));
        let currentLevel = newSubs;
        
        // Navega até o pai
        for (let i = 0; i < path.length; i++) {
            currentLevel = currentLevel[path[i]];
            if (i < path.length - 1) {
                if(!currentLevel.subtarefas) currentLevel.subtarefas = [];
                currentLevel = currentLevel.subtarefas;
            }
        }
        
        if (!currentLevel.subtarefas) currentLevel.subtarefas = [];
        currentLevel.subtarefas.push({ titulo: title, concluido: false, subtarefas: [] });
        
        setSubtarefas(newSubs);
    };

    const deleteNode = (path) => {
        const newSubs = JSON.parse(JSON.stringify(subtarefas));
        
        if (path.length === 1) {
            newSubs.splice(path[0], 1);
        } else {
            let currentLevel = newSubs;
            // Vai até o pai do item a ser deletado
            for (let i = 0; i < path.length - 1; i++) {
                currentLevel = currentLevel[path[i]];
                if (i < path.length - 2) currentLevel = currentLevel.subtarefas;
            }
            // Acessa o array de filhos do pai e remove o item
            // O pai é o objeto, precisamos acessar .subtarefas dele, a menos que o loop acima já tenha entrado
            // Correção da lógica de navegação:
            let parent = newSubs;
            for(let k=0; k < path.length -1; k++) {
                parent = parent[path[k]].subtarefas;
            }
            parent.splice(path[path.length - 1], 1);
        }
        setSubtarefas(newSubs);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { 
                titulo, descricao, prioridade, 
                prazo: prazo || null,
                subtarefas: subtarefas // Envia a árvore completa atualizada
            };

            if (editingData) {
                await updateTarefa(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Tarefa salva.'});
            } else {
                await createTarefa(payload);
                addToast({type:'success', title:'Criado', description:'Tarefa criada.'});
            }

            onUpdate();
            closeModal();
        } catch (error) {
            console.error(error);
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        } finally {
            setLoading(false);
        }
    };

    const selectedPrioObj = prioOptions.find(p => p.value === prioridade);

    if (!active) return null;

    return (
        <div className="modal-overlay registros-scope">
            {/* Modal com altura automática, max-height grande para permitir scroll interno geral */}
            <div className="modal-content large-modal" onClick={e => e.stopPropagation()} style={{maxWidth:'650px', height:'auto', maxHeight:'90vh', overflow:'hidden'}}>
                
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', flex:1, overflowY:'auto'}}>
                    <div className="modal-body">
                        
                        {/* Título */}
                        <div className="form-group">
                            <label>O que precisa ser feito?</label>
                            <input 
                                className="form-input" 
                                value={titulo} 
                                onChange={e => setTitulo(e.target.value)} 
                                placeholder="Ex: Projeto X..."
                                required 
                                autoFocus 
                            />
                        </div>

                        {/* Prioridade e Prazo */}
                        <div className="form-row">
                            <div className="form-group" style={{flex:1}} ref={prioWrapperRef}>
                                <label>Prioridade</label>
                                <div 
                                    className={`custom-select-trigger ${prioDropdownOpen ? 'open' : ''}`} 
                                    onClick={() => setPrioDropdownOpen(!prioDropdownOpen)}
                                >
                                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                        {selectedPrioObj && <span className="option-dot" style={{backgroundColor: selectedPrioObj.color}}></span>}
                                        <span>{selectedPrioObj ? selectedPrioObj.label : 'Selecione'}</span>
                                    </div>
                                    <i className="fa-solid fa-chevron-down arrow-icon"></i>
                                </div>

                                {prioDropdownOpen && (
                                    <div className="custom-select-options">
                                        {prioOptions.map(opt => (
                                            <div 
                                                key={opt.value} 
                                                className={`custom-option ${prioridade === opt.value ? 'selected' : ''}`}
                                                onClick={() => { setPrioridade(opt.value); setPrioDropdownOpen(false); }}
                                            >
                                                <span className="option-dot" style={{backgroundColor: opt.color}}></span>
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{flex:1}}>
                                <label>Prazo (Opcional)</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={prazo} 
                                    onChange={e => setPrazo(e.target.value)} 
                                />
                            </div>
                        </div>

                        {/* Descrição */}
                        <div className="form-group">
                            <label>Detalhes</label>
                            <textarea 
                                className="form-input" 
                                style={{height:'80px', padding:'10px'}} 
                                value={descricao} 
                                onChange={e => setDescricao(e.target.value)} 
                                placeholder="Informações adicionais..."
                            />
                        </div>

                        <hr style={{margin:'10px 0', border:'0', borderTop:'1px solid var(--cor-borda)'}}/>

                        {/* GERENCIADOR DE SUBTAREFAS */}
                        <div className="links-manager-section" style={{background:'transparent', border:'none', padding:'0'}}>
                            <label className="section-label" style={{fontSize:'1rem', marginBottom:'10px'}}>
                                <i className="fa-solid fa-list-check"></i> Subtarefas e Etapas
                            </label>
                            
                            {/* Input Principal (Raiz) */}
                            <div className="add-link-row">
                                <input 
                                    className="form-input link-input" 
                                    value={novaSubRaiz} 
                                    onChange={e => setNovaSubRaiz(e.target.value)} 
                                    placeholder="Adicionar etapa principal..." 
                                    onKeyDown={e => e.key === 'Enter' && addSubRaiz(e)}
                                />
                                <button type="button" className="btn-secondary btn-add-link" onClick={addSubRaiz}>
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            </div>

                            {/* Container da Árvore (Sem scroll interno, usa o do modal) */}
                            <div className="subtasks-tree-container">
                                {subtarefas.length === 0 ? (
                                    <div className="empty-tree-msg">
                                        Nenhuma subtarefa adicionada ainda.
                                    </div>
                                ) : (
                                    subtarefas.map((sub, i) => (
                                        <ModalSubtaskEdit 
                                            key={i} 
                                            sub={sub} 
                                            index={i} 
                                            path={[i]} 
                                            onDelete={deleteNode} 
                                            onAddChild={addChildToNode} 
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom" style={{borderRadius: '0 0 16px 16px', flexShrink:0}}>
                        <div style={{flex:1}}></div>
                        <div className="footer-buttons">
                            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Salvando...' : (editingData ? 'Salvar Alterações' : 'Criar Tarefa')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}