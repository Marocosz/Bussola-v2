import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { createAnotacao, updateAnotacao } from '../../../services/api';
import '../styles.css';

export function AnotacaoModal({ active, closeModal, onUpdate, editingData, gruposDisponiveis }) {
    const [titulo, setTitulo] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [grupoId, setGrupoId] = useState('');
    const [fixado, setFixado] = useState(false);
    
    // Gerenciamento de Links
    const [links, setLinks] = useState([]); 
    const [newLink, setNewLink] = useState('');

    const [loading, setLoading] = useState(false);

    // Configuração da Toolbar
    const modules = {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'], 
            [{ 'list': 'ordered'}, { 'list': 'bullet' }], 
            ['clean'] 
        ],
    };

    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                setConteudo(editingData.conteudo || '');
                setGrupoId(editingData.grupo?.id || '');
                setFixado(editingData.fixado);
                setLinks(editingData.links ? editingData.links.map(l => l.url) : []);
            } else {
                setTitulo('');
                setConteudo('');
                setGrupoId(gruposDisponiveis.length > 0 ? gruposDisponiveis[0].id : '');
                setFixado(false);
                setLinks([]);
            }
            setNewLink('');
        }
    }, [active, editingData, gruposDisponiveis]);

    // Handlers
    const handleAddLink = (e) => {
        e.preventDefault();
        if (newLink.trim()) {
            setLinks([...links, newLink.trim()]);
            setNewLink('');
        }
    };

    const handleRemoveLink = (indexToRemove) => {
        setLinks(links.filter((_, index) => index !== indexToRemove));
    };

    const handleSave = async () => {
        if (!titulo.trim()) return alert("O título é obrigatório");
        
        setLoading(true);
        const payload = {
            titulo,
            conteudo, 
            grupo_id: grupoId ? Number(grupoId) : null,
            fixado,
            links 
        };

        try {
            if (editingData) {
                await updateAnotacao(editingData.id, payload);
            } else {
                await createAnotacao(payload);
            }
            onUpdate();
            closeModal();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar anotação.");
        } finally {
            setLoading(false);
        }
    };

    if (!active) return null;

    return (
        <div className="modal-overlay registros-scope">
            <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
                
                {/* Header com X Padrão */}
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                    <button className="close-btn" onClick={closeModal}>
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>
                
                <div className="modal-body">
                    {/* Linha 1: Título e Grupo */}
                    <div className="form-row">
                        <div className="form-group" style={{flex: 2}}>
                            <label>Título</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Sobre o que é esta nota?"
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="form-group" style={{flex: 1}}>
                            <label>Grupo</label>
                            <select 
                                className="form-input" 
                                value={grupoId} 
                                onChange={e => setGrupoId(e.target.value)}
                            >
                                <option value="">Sem Grupo</option>
                                {gruposDisponiveis.map(g => (
                                    <option key={g.id} value={g.id}>{g.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Editor Rico com Scroll Interno */}
                    <div className="form-group editor-container">
                        <label>Conteúdo</label>
                        <ReactQuill 
                            theme="snow"
                            value={conteudo}
                            onChange={setConteudo}
                            modules={modules}
                            placeholder="Digite suas anotações aqui..."
                            className="custom-quill-editor"
                        />
                    </div>

                    {/* Seção de Links */}
                    <div className="links-manager-section">
                        <label className="section-label"><i className="fa-solid fa-link"></i> Links e Referências</label>
                        
                        <div className="add-link-row">
                            <input 
                                type="text" 
                                className="form-input link-input" 
                                placeholder="Cole uma URL aqui (ex: https://...)"
                                value={newLink}
                                onChange={e => setNewLink(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddLink(e)}
                            />
                            <button className="btn-secondary btn-add-link" onClick={handleAddLink}>
                                <i className="fa-solid fa-plus"></i> Adicionar
                            </button>
                        </div>

                        {links.length > 0 && (
                            <ul className="links-list-edit">
                                {links.map((link, idx) => (
                                    <li key={idx}>
                                        <span className="link-url-text">{link}</span>
                                        <button className="remove-link-btn" onClick={() => handleRemoveLink(idx)}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer Customizado (Fixar na esquerda, Botões na direita) */}
                <div className="modal-footer-custom">
                    
                    {/* Lado Esquerdo: Checkbox Fixar */}
                    <label className="checkbox-footer">
                        <input 
                            type="checkbox" 
                            checked={fixado} 
                            onChange={e => setFixado(e.target.checked)} 
                        />
                        <span className="checkmark-footer"></span>
                        Fixar no topo
                    </label>

                    {/* Lado Direito: Botões de Ação */}
                    <div className="footer-buttons">
                        <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button className="btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Anotação'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}