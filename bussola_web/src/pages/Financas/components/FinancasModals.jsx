import React, { useState, useEffect } from 'react';
import { createTransacao, createCategoria } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function FinancasModals({ activeModal, closeModal, onUpdate, dashboardData }) {
    const { addToast } = useToast();
    
    // Estados dos formulários
    const [formData, setFormData] = useState({});
    
    // Pickers (Categoria)
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    // Limpa form ao abrir/fechar
    useEffect(() => {
        setFormData({});
        setShowIconPicker(false);
        setShowColorPicker(false);
    }, [activeModal]);

    if (!activeModal) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeModal === 'category') {
                // Defaults para Categoria
                const payload = {
                    ...formData,
                    icone: formData.icone || 'fa-solid fa-question',
                    cor: formData.cor || '#FFFFFF',
                    meta_limite: formData.meta_limite || 0
                };
                await createCategoria(payload);
            } else {
                // Transações (Pontual, Parcelada, Recorrente)
                const payload = {
                    ...formData,
                    tipo_recorrencia: activeModal
                };
                await createTransacao(payload);
            }
            
            addToast({ type: 'success', title: 'Sucesso', description: 'Item adicionado.' });
            onUpdate();
            closeModal();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao salvar os dados.' });
        }
    };

    // --- Renderização dos Conteúdos Específicos ---

    const renderCategoryForm = () => (
        <>
            <div className="form-row">
                <div className="form-group" style={{ flexGrow: 2 }}>
                    <label>Nome</label>
                    <input name="nome" className="form-input" required onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label>Tipo</label>
                    <div className="radio-group">
                        <label><input type="radio" name="tipo" value="despesa" defaultChecked onChange={handleChange} /> Despesa</label>
                        <label><input type="radio" name="tipo" value="receita" onChange={handleChange} /> Receita</label>
                    </div>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group" style={{ flexGrow: 1 }}>
                    <label>{formData.tipo === 'receita' ? 'Meta de Ganho' : 'Limite de Gasto'}</label>
                    <input type="number" step="0.01" name="meta_limite" className="form-input" placeholder="0.00" onChange={handleChange} />
                </div>
                
                {/* Picker de Ícone */}
                <div className="form-group form-group-fixed">
                    <label>Ícone</label>
                    <div className="picker-wrapper">
                        <div className="picker-preview" onClick={() => setShowIconPicker(!showIconPicker)}>
                            <i className={formData.icone || 'fa-solid fa-question'} style={{color: formData.cor}}></i>
                        </div>
                        {showIconPicker && (
                            <div className="picker-popover icon-grid visible">
                                {dashboardData.icones_disponiveis.map(icon => (
                                    <div key={icon} className="icon-option" onClick={() => {
                                        setFormData(prev => ({ ...prev, icone: icon }));
                                        setShowIconPicker(false);
                                    }}>
                                        <i className={icon}></i>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Picker de Cor */}
                <div className="form-group form-group-fixed">
                    <label>Cor</label>
                    <div className="picker-wrapper">
                        <div className="picker-preview" onClick={() => setShowColorPicker(!showColorPicker)}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: formData.cor || '#fff' }}></div>
                        </div>
                        {showColorPicker && (
                            <div className="picker-popover color-grid visible">
                                {dashboardData.cores_disponiveis.map(cor => (
                                    <div key={cor} className="color-swatch" style={{backgroundColor: cor}} onClick={() => {
                                        setFormData(prev => ({ ...prev, cor: cor }));
                                        setShowColorPicker(false);
                                    }}></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );

    const renderTransactionCommon = () => (
        <div className="form-row">
            <div className="form-group">
                <label>Categoria</label>
                <select name="categoria_id" className="form-input" required onChange={handleChange}>
                    <option value="">Selecione...</option>
                    {[...dashboardData.categorias_despesa, ...dashboardData.categorias_receita].map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nome} ({cat.tipo})</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const titles = {
        category: 'Nova Categoria',
        pontual: 'Nova Transação Única',
        parcelada: 'Nova Transação Parcelada',
        recorrente: 'Nova Transação Recorrente'
    };

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{titles[activeModal]}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {activeModal === 'category' ? renderCategoryForm() : (
                            <>
                                <div className="form-group">
                                    <label>Descrição</label>
                                    <input name="descricao" className="form-input" required onChange={handleChange} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Valor (R$)</label>
                                        <input type="number" step="0.01" name="valor" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Data {activeModal === 'parcelada' ? 'da 1ª Parcela' : ''}</label>
                                        <input type="date" name="data" className="form-input" required onChange={handleChange} />
                                    </div>
                                </div>
                                {activeModal === 'parcelada' && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Nº Parcelas</label>
                                            <input type="number" name="total_parcelas" className="form-input" min="2" required onChange={handleChange} />
                                        </div>
                                    </div>
                                )}
                                {activeModal === 'recorrente' && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Frequência</label>
                                            <select name="frequencia" className="form-input" required onChange={handleChange}>
                                                <option value="mensal">Mensal</option>
                                                <option value="semanal">Semanal</option>
                                                <option value="anual">Anual</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {renderTransactionCommon()}
                            </>
                        )}
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