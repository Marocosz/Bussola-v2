import React, { useState, useEffect, useRef } from 'react';
import { createGrupo, updateGrupo } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import '../styles.css';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', 
    '#84cc16', '#10b981', '#06b6d4', '#0ea5e9', 
    '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
    '#f43f5e', '#64748b', '#78716c'
];

export function GrupoModal({ active, closeModal, onUpdate, editingData, existingGroups = [] }) {
    const { addToast } = useToast();
    
    const [nome, setNome] = useState('');
    const [cor, setCor] = useState(PRESET_COLORS[0]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const colorWrapperRef = useRef(null);

    useEffect(() => {
        if (active) {
            if (editingData) {
                setNome(editingData.nome);
                setCor(editingData.cor);
            } else {
                setNome('');
                const used = existingGroups.map(g => g.cor);
                const firstAvailable = PRESET_COLORS.find(c => !used.includes(c)) || PRESET_COLORS[0];
                setCor(firstAvailable);
            }
            setShowColorPicker(false);
        }
    }, [active, editingData, existingGroups]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (showColorPicker && colorWrapperRef.current && !colorWrapperRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, [showColorPicker]);

    if (!active) return null;

    const availableColors = PRESET_COLORS.filter(c => {
        if (editingData && editingData.cor === c) return true; 
        return !existingGroups.some(g => g.cor === c);
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nome.trim()) return;
        setLoading(true);
        try {
            if (editingData) {
                await updateGrupo(editingData.id, { nome, cor });
                addToast({type:'success', title:'Atualizado', description:'Grupo alterado.'});
            } else {
                await createGrupo({ nome, cor });
                addToast({type:'success', title:'Criado', description:'Novo grupo adicionado.'});
            }
            onUpdate();
            closeModal();
        } catch (error) {
            console.error(error);
            addToast({type:'error', title:'Erro', description:'Falha ao salvar grupo.'});
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay registros-scope">
            {/* Força o modal a ter overflow visível */}
            <div className="modal-content compact-modal" onClick={e => e.stopPropagation()} style={{maxWidth:'450px', overflow: 'visible', maxHeight: 'none'}}>
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Grupo' : 'Novo Grupo'}</h2>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                
                <form onSubmit={handleSubmit}>
                    {/* Força o body a ter overflow visível e um z-index maior que o footer */}
                    <div className="modal-body" style={{overflow: 'visible', paddingBottom: '1rem', position: 'relative', zIndex: 10}}> 
                        
                        {/* Grid layout */}
                        <div className="form-row" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'end', gap:'15px'}}>
                            
                            <div className="form-group">
                                <label>Nome do Grupo</label>
                                <input 
                                    className="form-input" 
                                    value={nome} 
                                    onChange={e => setNome(e.target.value)} 
                                    placeholder="Ex: Estudos..."
                                    required 
                                    autoFocus 
                                />
                            </div>

                            {/* Picker Wrapper */}
                            <div className="form-group" style={{width: 'auto', position: 'relative'}}>
                                <label>Cor</label>
                                <div className="picker-wrapper" ref={colorWrapperRef}>
                                    <div 
                                        className="picker-preview" 
                                        style={{ backgroundColor: 'var(--cor-fundo)' }}
                                        onClick={() => setShowColorPicker(!showColorPicker)}
                                        title="Escolher cor"
                                    >
                                        <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: cor }}></div>
                                    </div>
                                    
                                    {showColorPicker && (
                                        <div 
                                            className="picker-popover color-grid visible" 
                                            style={{
                                                right: 0, 
                                                top: '115%', 
                                                display: 'grid', 
                                                zIndex: 9999, /* Garante topo absoluto */
                                                position: 'absolute' 
                                            }}
                                        >
                                            {availableColors.map(c => (
                                                <div 
                                                    key={c} 
                                                    className="color-swatch" 
                                                    style={{backgroundColor: c}} 
                                                    onClick={() => { setCor(c); setShowColorPicker(false); }}
                                                ></div>
                                            ))}
                                            {availableColors.length === 0 && (
                                                <p style={{gridColumn:'span 5', fontSize:'0.7rem', color:'#999', textAlign:'center', padding:'5px', whiteSpace:'nowrap'}}>
                                                    Uso total.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Footer com z-index menor */}
                    <div className="modal-footer" style={{position: 'relative', zIndex: 1}}>
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}