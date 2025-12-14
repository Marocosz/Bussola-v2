import React, { useState } from 'react';
import { createTarefa } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function TarefaModal({ active, closeModal, onUpdate }) {
    const { addToast } = useToast();
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [subtarefas, setSubtarefas] = useState([]);
    const [novaSub, setNovaSub] = useState('');

    if (!active) return null;

    const handleAddSub = () => {
        if(!novaSub.trim()) return;
        setSubtarefas([...subtarefas, { titulo: novaSub, concluido: false }]);
        setNovaSub('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createTarefa({ titulo, descricao, subtarefas });
            addToast({type:'success', title:'Criado', description:'Tarefa criada.'});
            onUpdate();
            closeModal();
            setTitulo(''); setDescricao(''); setSubtarefas([]);
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao criar tarefa.'});
        }
    };

    return (
        <div className="modal" style={{display:'flex'}}>
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Nova Tarefa</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>O que precisa ser feito?</label>
                            <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} required autoFocus />
                        </div>
                        <div className="form-group">
                            <label>Detalhes (Opcional)</label>
                            <textarea className="form-input" rows="2" value={descricao} onChange={e => setDescricao(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Subtarefas</label>
                            <div style={{display:'flex', gap:'5px', marginBottom:'10px'}}>
                                <input className="form-input" value={novaSub} onChange={e => setNovaSub(e.target.value)} placeholder="Adicionar passo..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSub())}/>
                                <button type="button" className="btn-secondary" onClick={handleAddSub}><i className="fa-solid fa-plus"></i></button>
                            </div>
                            <ul style={{listStyle:'none', padding:0}}>
                                {subtarefas.map((s, i) => (
                                    <li key={i} style={{padding:'5px', borderBottom:'1px solid #eee'}}>{s.titulo}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="submit" className="btn-primary">Criar Tarefa</button>
                    </div>
                </form>
            </div>
        </div>
    );
}