import React, { useState, useEffect } from 'react';
import { createCompromisso, updateCompromisso } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function AgendaModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    
    const [titulo, setTitulo] = useState('');
    const [dataHora, setDataHora] = useState('');
    const [local, setLocal] = useState('');
    const [descricao, setDescricao] = useState('');
    const [lembrete, setLembrete] = useState(false);

    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                // Formatar data para input datetime-local (YYYY-MM-DDTHH:MM)
                const isoDate = new Date(editingData.data_hora).toISOString().slice(0, 16);
                setDataHora(isoDate);
                setLocal(editingData.local || '');
                setDescricao(editingData.descricao || '');
                setLembrete(editingData.lembrete);
            } else {
                setTitulo('');
                setDataHora('');
                setLocal('');
                setDescricao('');
                setLembrete(false);
            }
        }
    }, [active, editingData]);

    if (!active) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { titulo, data_hora: dataHora, local, descricao, lembrete };
        
        try {
            if (editingData) {
                await updateCompromisso(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Compromisso salvo.'});
            } else {
                await createCompromisso(payload);
                addToast({type:'success', title:'Criado', description:'Novo compromisso.'});
            }
            onUpdate();
            closeModal();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{flexGrow:2}}>
                                <label>Título</label>
                                <input 
                                    className="form-input" 
                                    value={titulo} 
                                    onChange={e => setTitulo(e.target.value)} 
                                    required 
                                    placeholder="Ex: Reunião de Equipe"
                                />
                            </div>
                            <div className="form-group" style={{flexGrow:1}}>
                                <label>Data e Hora</label>
                                <input 
                                    type="datetime-local" 
                                    className="form-input" 
                                    value={dataHora} 
                                    onChange={e => setDataHora(e.target.value)} 
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Local (Opcional)</label>
                            <input 
                                className="form-input" 
                                value={local} 
                                onChange={e => setLocal(e.target.value)} 
                                placeholder="Ex: Sala de Reunião 1 ou Google Meet"
                            />
                        </div>
                        <div className="form-group">
                            <label>Descrição (Opcional)</label>
                            <textarea 
                                className="form-input" 
                                rows="3" 
                                value={descricao} 
                                onChange={e => setDescricao(e.target.value)}
                                placeholder="Detalhes adicionais..."
                            ></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <div className="form-group-checkbox" style={{marginRight:'auto'}}>
                            <input 
                                type="checkbox" 
                                checked={lembrete} 
                                onChange={e => setLembrete(e.target.checked)} 
                                id="lembrete-check" 
                                style={{width:'18px', height:'18px', cursor:'pointer'}}
                            />
                            <label htmlFor="lembrete-check" style={{cursor:'pointer'}}>Ativar Lembrete</label>
                        </div>
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}