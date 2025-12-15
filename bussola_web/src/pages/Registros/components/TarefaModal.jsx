import React, { useState, useEffect } from 'react';
import { createTarefa, updateTarefa, addSubtarefa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import '../styles.css';

export function TarefaModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    
    // States do Formulário
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState('Média');
    const [prazo, setPrazo] = useState('');
    
    // Subtarefas (Apenas para criação ou adição visual na edição)
    const [subtarefas, setSubtarefas] = useState([]);
    const [novaSub, setNovaSub] = useState('');
    const [loading, setLoading] = useState(false);

    // Carregar dados na edição
    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                setDescricao(editingData.descricao || '');
                setPrioridade(editingData.prioridade || 'Média');
                // Formata data para o input datetime-local ou date
                if (editingData.prazo) {
                    setPrazo(editingData.prazo.split('T')[0]); 
                } else {
                    setPrazo('');
                }
                setSubtarefas([]); // Reset subtarefas locais (edição de subs é feita no card por enquanto)
            } else {
                setTitulo('');
                setDescricao('');
                setPrioridade('Média');
                setPrazo('');
                setSubtarefas([]);
            }
            setNovaSub('');
        }
    }, [active, editingData]);

    if (!active) return null;

    const handleAddSubLocal = () => {
        if(!novaSub.trim()) return;
        setSubtarefas([...subtarefas, { titulo: novaSub, concluido: false }]);
        setNovaSub('');
    };

    const handleRemoveSubLocal = (index) => {
        const newSubs = [...subtarefas];
        newSubs.splice(index, 1);
        setSubtarefas(newSubs);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { 
                titulo, 
                descricao, 
                prioridade, 
                prazo: prazo || null,
                // Se for criação, manda as subtarefas
                subtarefas: !editingData ? subtarefas : undefined 
            };

            let tarefaId;

            if (editingData) {
                // UPDATE
                await updateTarefa(editingData.id, payload);
                tarefaId = editingData.id;
                addToast({type:'success', title:'Atualizado', description:'Tarefa atualizada.'});
            } else {
                // CREATE
                const res = await createTarefa(payload);
                tarefaId = res.id;
                addToast({type:'success', title:'Criado', description:'Tarefa criada.'});
            }

            // Se estiver editando e o usuário adicionou novas subs no modal
            if (editingData && subtarefas.length > 0) {
                for (const sub of subtarefas) {
                    await addSubtarefa(tarefaId, sub.titulo);
                }
            }

            onUpdate();
            closeModal();
        } catch (error) {
            console.error(error);
            addToast({type:'error', title:'Erro', description:'Falha ao salvar tarefa.'});
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay registros-scope">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:'550px'}}>
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Título */}
                        <div className="form-group">
                            <label>O que precisa ser feito?</label>
                            <input 
                                className="form-input" 
                                value={titulo} 
                                onChange={e => setTitulo(e.target.value)} 
                                placeholder="Ex: Pagar fornecedor X..."
                                required 
                                autoFocus 
                            />
                        </div>

                        {/* Linha: Prioridade e Prazo */}
                        <div className="form-row">
                            <div className="form-group" style={{flex:1}}>
                                <label>Prioridade</label>
                                <div className="custom-select-trigger" style={{padding:'0 5px'}}>
                                    <select 
                                        className="form-input" 
                                        value={prioridade} 
                                        onChange={e => setPrioridade(e.target.value)}
                                        style={{border:'none', height:'100%', width:'100%', background:'transparent'}}
                                    >
                                        <option value="Baixa">🟢 Baixa</option>
                                        <option value="Média">🔵 Média</option>
                                        <option value="Alta">🟠 Alta</option>
                                        <option value="Crítica">🔴 Crítica</option>
                                    </select>
                                </div>
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

                        {/* Subtarefas */}
                        <div className="links-manager-section">
                            <label className="section-label">
                                <i className="fa-solid fa-list-check"></i> 
                                {editingData ? ' Adicionar Subtarefas' : ' Subtarefas'}
                            </label>
                            
                            <div className="add-link-row">
                                <input 
                                    className="form-input link-input" 
                                    value={novaSub} 
                                    onChange={e => setNovaSub(e.target.value)} 
                                    placeholder="Adicionar passo..." 
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubLocal())}
                                />
                                <button type="button" className="btn-secondary btn-add-link" onClick={handleAddSubLocal}>
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            </div>

                            {subtarefas.length > 0 && (
                                <ul className="links-list-edit">
                                    {subtarefas.map((s, i) => (
                                        <li key={i}>
                                            <span className="link-url-text">{s.titulo}</span>
                                            <button type="button" className="remove-link-btn" onClick={() => handleRemoveSubLocal(i)}>
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {editingData && (
                                <p style={{fontSize:'0.8rem', color:'var(--cor-texto-secundario)', marginTop:'5px', fontStyle:'italic'}}>
                                    * Subtarefas existentes podem ser gerenciadas diretamente no card.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : (editingData ? 'Salvar Alterações' : 'Criar Tarefa')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}