import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { createAnotacao, updateAnotacao } from '../../../services/api';
import '../styles.css';

export function AnotacaoModal({ active, closeModal, onUpdate, editingData, gruposDisponiveis }) {
    const [titulo, setTitulo] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [grupoId, setGrupoId] = useState('');
    const [fixado, setFixado] = useState(false);
    
    const [links, setLinks] = useState([]); 
    const [newLink, setNewLink] = useState('');

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const [loading, setLoading] = useState(false);

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
            setDropdownOpen(false);
        }
    }, [active, editingData, gruposDisponiveis]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

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

    const selectedGroupObj = gruposDisponiveis.find(g => g.id == grupoId);
    const selectedLabel = selectedGroupObj ? selectedGroupObj.nome : "Sem Grupo";
    const selectedColor = selectedGroupObj ? selectedGroupObj.cor : null;

    if (!active) return null;

    return (
        <div className="modal-overlay registros-scope">
            <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
                
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                    {/* Alterado para SPAN e &times; para ficar IDÊNTICO ao Finanças */}
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                
                <div className="modal-body">
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
                        
                        <div className="form-group" style={{flex: 1}} ref={dropdownRef}>
                            <label>Grupo</label>
                            <div 
                                className={`custom-select-trigger ${dropdownOpen ? 'open' : ''}`} 
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                            >
                                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                    {selectedColor && <span className="option-dot" style={{backgroundColor: selectedColor}}></span>}
                                    <span>{selectedLabel}</span>
                                </div>
                                <i className="fa-solid fa-chevron-down arrow-icon"></i>
                            </div>
                            
                            {dropdownOpen && (
                                <div className="custom-select-options">
                                    <div 
                                        className={`custom-option ${!grupoId ? 'selected' : ''}`}
                                        onClick={() => { setGrupoId(''); setDropdownOpen(false); }}
                                    >
                                        Sem Grupo
                                    </div>
                                    {gruposDisponiveis.map(g => (
                                        <div 
                                            key={g.id} 
                                            className={`custom-option ${grupoId == g.id ? 'selected' : ''}`}
                                            onClick={() => { setGrupoId(g.id); setDropdownOpen(false); }}
                                        >
                                            <span className="option-dot" style={{backgroundColor: g.cor}}></span>
                                            {g.nome}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

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

                <div className="modal-footer-custom">
                    <label className="checkbox-footer">
                        <input 
                            type="checkbox" 
                            checked={fixado} 
                            onChange={e => setFixado(e.target.checked)} 
                        />
                        <span className="checkmark-footer"></span>
                        Fixar no topo
                    </label>

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