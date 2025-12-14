import React, { useState, useEffect } from 'react';
import '../styles.css';

export function GrupoModal({ active, closeModal, onUpdate, editingData }) {
    const [nome, setNome] = useState('');
    const [cor, setCor] = useState('#3b82f6');
    const [loading, setLoading] = useState(false);

    // Cores pré-definidas para facilitar
    const coresPredefinidas = [
        '#3b82f6', // Azul
        '#ef4444', // Vermelho
        '#10b981', // Verde
        '#f59e0b', // Laranja
        '#8b5cf6', // Roxo
        '#ec4899', // Rosa
        '#64748b'  // Cinza
    ];

    useEffect(() => {
        if (active) {
            if (editingData) {
                setNome(editingData.nome);
                setCor(editingData.cor || '#3b82f6');
            } else {
                setNome('');
                setCor('#3b82f6');
            }
        }
    }, [active, editingData]);

    const handleSave = async () => {
        if (!nome.trim()) return;

        setLoading(true);
        // Aqui simula a chamada (você deve ter essas funções no seu api.ts)
        // Se não tiver, precisa criar: createGrupo e updateGrupo
        try {
            const { createGrupo, updateGrupo } = await import('../../../services/api');
            
            if (editingData) {
                await updateGrupo(editingData.id, { nome, cor });
            } else {
                await createGrupo({ nome, cor });
            }
            onUpdate();
            closeModal();
        } catch (error) {
            console.error("Erro ao salvar grupo:", error);
            alert("Erro ao salvar grupo.");
        } finally {
            setLoading(false);
        }
    };

    if (!active) return null;

    return (
        <div className="modal-overlay registros-scope">
            <div className="modal-content small-modal">
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Grupo' : 'Novo Grupo'}</h2>
                    <button className="close-btn" onClick={closeModal}><i className="fa-solid fa-times"></i></button>
                </div>
                
                <div className="modal-body">
                    <div className="form-group">
                        <label>Nome do Grupo</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={nome} 
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Pessoal, Trabalho..."
                            maxLength={30}
                        />
                    </div>

                    <div className="form-group">
                        <label>Cor da Etiqueta</label>
                        <div className="color-picker-container">
                            {coresPredefinidas.map(c => (
                                <div 
                                    key={c}
                                    className={`color-circle ${cor === c ? 'selected' : ''}`}
                                    style={{backgroundColor: c}}
                                    onClick={() => setCor(c)}
                                >
                                    {cor === c && <i className="fa-solid fa-check"></i>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
                    <button className="btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : (editingData ? 'Salvar' : 'Criar')}
                    </button>
                </div>
            </div>
        </div>
    );
}