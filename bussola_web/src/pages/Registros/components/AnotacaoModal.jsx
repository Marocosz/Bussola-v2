import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { createAnotacao, updateAnotacao } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const modules = {
    toolbar: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
    ],
};

export function AnotacaoModal({ active, closeModal, onUpdate, editingData, gruposDisponiveis = [] }) {
    const { addToast } = useToast();
    
    const [titulo, setTitulo] = useState('');
    const [grupoId, setGrupoId] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [links, setLinks] = useState([]); 

    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo || '');
                setGrupoId(editingData.grupo_id || '');
                setConteudo(editingData.conteudo || '');
                setLinks(editingData.links?.map(l => l.url) || []);
            } else {
                setTitulo('');
                setGrupoId(gruposDisponiveis.length > 0 ? gruposDisponiveis[0].id : '');
                setConteudo('');
                setLinks([]);
            }
        }
    }, [active, editingData, gruposDisponiveis]);

    if (!active) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { titulo, grupo_id: Number(grupoId), conteudo, links };
        try {
            if (editingData) await updateAnotacao(editingData.id, payload);
            else await createAnotacao(payload);
            
            addToast({type:'success', title:'Sucesso', description:'Anotação salva.'});
            onUpdate();
            closeModal();
        } catch (error) {
            console.error(error);
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    return (
        <div className="modal" style={{display:'flex'}}>
            <div className="modal-content large">
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Nota' : 'Nova Nota'}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{flex:2}}>
                                <label>Título</label>
                                <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} />
                            </div>
                            <div className="form-group" style={{flex:1}}>
                                <label>Grupo</label>
                                <select className="form-input" value={grupoId} onChange={e => setGrupoId(e.target.value)} required>
                                    {gruposDisponiveis.map(g => (
                                        <option key={g.id} value={g.id}>{g.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Conteúdo</label>
                            <ReactQuill theme="snow" value={conteudo} onChange={setConteudo} modules={modules} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}