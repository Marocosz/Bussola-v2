import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { createRegistro, updateRegistro } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

// --- CORREÇÃO: Definir modules FORA do componente para evitar loop de renderização ---
const modules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
    ],
};

export function RegistroModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    
    // States do Form
    const [titulo, setTitulo] = useState('');
    const [tipo, setTipo] = useState('Geral');
    const [isTarefa, setIsTarefa] = useState(false);
    const [conteudo, setConteudo] = useState('');
    const [links, setLinks] = useState([]); 

    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                setTipo(editingData.tipo);
                setIsTarefa(editingData.is_tarefa);
                setConteudo(editingData.conteudo || '');
                // Garante que links seja um array antes de mapear
                setLinks(editingData.links && Array.isArray(editingData.links) ? editingData.links.map(l => l.url) : []);
            } else {
                setTitulo('');
                setTipo('Geral');
                setIsTarefa(false);
                setConteudo('');
                setLinks([]);
            }
        }
    }, [active, editingData]);

    if (!active) return null;

    const handleAddLink = () => setLinks([...links, '']);
    const handleLinkChange = (idx, val) => {
        const newLinks = [...links];
        newLinks[idx] = val;
        setLinks(newLinks);
    };
    const handleRemoveLink = (idx) => {
        setLinks(links.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { titulo, tipo, is_tarefa: isTarefa, conteudo, links };
        
        try {
            if (editingData) {
                await updateRegistro(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Registro salvo.'});
            } else {
                await createRegistro(payload);
                addToast({type:'success', title:'Criado', description:'Novo registro salvo.'});
            }
            onUpdate();
            closeModal();
        } catch (error) {
            console.error(error);
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    return (
        <div className="modal" style={{display:'flex'}}>
            <div className="modal-content large" style={{maxWidth: '700px'}}>
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Registro' : 'Novo Registro'}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{flexGrow:3}}>
                                <label>Título</label>
                                <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} required />
                            </div>
                            <div className="form-group" style={{flexGrow:2}}>
                                <label>Tipo</label>
                                <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
                                    <option value="Geral">Geral</option>
                                    <option value="Estudo">Estudo</option>
                                    <option value="Trabalho">Trabalho</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div className="form-group" style={{flexBasis:'120px', flexGrow:0}}>
                                <label>Modo Tarefa</label>
                                <div className="radio-group">
                                    <input type="checkbox" checked={isTarefa} onChange={e => setIsTarefa(e.target.checked)} style={{width: '20px', height: '20px'}} />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Conteúdo</label>
                            {/* Componente ReactQuill */}
                            <ReactQuill theme="snow" value={conteudo} onChange={setConteudo} modules={modules} />
                        </div>

                        <div className="form-group">
                            <label>Links</label>
                            {links.map((link, idx) => (
                                <div key={idx} style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                                    <input type="url" className="form-input" placeholder="https://..." value={link} onChange={e => handleLinkChange(idx, e.target.value)} />
                                    <button type="button" className="btn-secondary" onClick={() => handleRemoveLink(idx)}><i className="fa-solid fa-trash-can"></i></button>
                                </div>
                            ))}
                            <button type="button" className="btn-secondary" style={{width: 'fit-content'}} onClick={handleAddLink}>
                                <i className="fa-solid fa-plus"></i> Adicionar Link
                            </button>
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