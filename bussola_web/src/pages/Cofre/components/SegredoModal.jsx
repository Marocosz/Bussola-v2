import React, { useState, useEffect } from 'react';
import { createSegredo, updateSegredo } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function SegredoModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    
    const [titulo, setTitulo] = useState('');
    const [servico, setServico] = useState('');
    const [valor, setValor] = useState('');
    const [diasExpirar, setDiasExpirar] = useState('');
    const [notas, setNotas] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                setServico(editingData.servico || '');
                setNotas(editingData.notas || '');
                // Não setamos o valor aqui, pois ele é secreto e não vem na listagem
                setValor(''); 
                // Lógica de dias expirar é complexa de reverter da data, deixamos vazio na edição por enquanto
                setDiasExpirar('');
            } else {
                setTitulo('');
                setServico('');
                setValor('');
                setDiasExpirar('');
                setNotas('');
            }
            setShowPassword(false);
        }
    }, [active, editingData]);

    if (!active) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Calculo da data de expiração (se fornecido dias)
        let data_expiracao = null;
        if (diasExpirar && parseInt(diasExpirar) > 0) {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(diasExpirar));
            data_expiracao = date.toISOString().split('T')[0]; // YYYY-MM-DD
        }

        const payload = { titulo, servico, notas, data_expiracao };
        if (!editingData) payload.valor = valor; // Só envia valor na criação

        try {
            if (editingData) {
                await updateSegredo(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Segredo atualizado.'});
            } else {
                await createSegredo(payload);
                addToast({type:'success', title:'Guardado', description:'Novo segredo salvo.'});
            }
            onUpdate();
            closeModal();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    return (
        <div className="modal" style={{display:'flex'}}>
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Segredo' : 'Guardar Novo Segredo'}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Título</label>
                                <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Serviço (Opcional)</label>
                                <input className="form-input" value={servico} onChange={e => setServico(e.target.value)} />
                            </div>
                        </div>

                        {/* Campo de Valor só aparece na criação (Edição de valor requer outra UX) */}
                        {!editingData && (
                            <div className="form-group">
                                <label>Valor da Chave / Senha</label>
                                <div className="secret-input-wrapper" style={{display:'flex', gap:'10px'}}>
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        className="form-input" 
                                        value={valor} 
                                        onChange={e => setValor(e.target.value)} 
                                        required 
                                        placeholder="Cole a chave de API ou senha aqui..."
                                    />
                                    <button type="button" className="btn-action-icon" onClick={() => setShowPassword(!showPassword)}>
                                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group">
                                <label>Expira em (dias) - Opcional</label>
                                <input type="number" className="form-input" placeholder="Ex: 30" value={diasExpirar} onChange={e => setDiasExpirar(e.target.value)} min="0" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notas (Opcional)</label>
                            <textarea className="form-input" rows="2" value={notas} onChange={e => setNotas(e.target.value)}></textarea>
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