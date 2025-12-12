import React, { useState, useEffect } from 'react';
import { createTransacao, createCategoria } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function FinancasModals({ activeModal, closeModal, onUpdate, dashboardData }) {
    const { addToast } = useToast();
    const [formData, setFormData] = useState({});
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

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

    const handleTypeChange = (tipo) => {
        setFormData(prev => ({ ...prev, tipo: tipo }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeModal === 'category') {
                const payload = {
                    ...formData,
                    icone: formData.icone || 'fa-solid fa-question',
                    cor: formData.cor || '#FFFFFF',
                    meta_limite: formData.meta_limite || 0,
                    tipo: formData.tipo || 'despesa'
                };
                await createCategoria(payload);
            } else {
                const payload = { ...formData, tipo_recorrencia: activeModal };
                await createTransacao(payload);
            }
            addToast({ type: 'success', title: 'Sucesso', description: 'Salvo com sucesso.' });
            onUpdate();
            closeModal();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao salvar.' });
        }
    };

    // Helper para o Select de Categoria
    const CategorySelect = () => (
        <div className="form-group">
            <label>Categoria</label>
            <select name="categoria_id" className="form-input" required onChange={handleChange}>
                <option value="">Selecione...</option>
                {[...dashboardData.categorias_despesa, ...dashboardData.categorias_receita].map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome} ({cat.tipo})</option>
                ))}
            </select>
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
                        
                        {/* --- NOVA CATEGORIA --- */}
                        {activeModal === 'category' && (
                            <>
                                {/* Linha 1: Nome (Grande) | Tipo (Menor) */}
                                <div className="form-row grid-60-40">
                                    <div className="form-group">
                                        <label>Nome</label>
                                        <input name="nome" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tipo</label>
                                        <div className="custom-type-selector">
                                            <div className={`type-option ${formData.tipo !== 'receita' ? 'active despesa' : ''}`} onClick={() => handleTypeChange('despesa')}>Despesa</div>
                                            <div className={`type-option ${formData.tipo === 'receita' ? 'active receita' : ''}`} onClick={() => handleTypeChange('receita')}>Receita</div>
                                        </div>
                                    </div>
                                </div>
                                {/* Linha 2: Meta (Flex) | Ícone (Fixo) | Cor (Fixo) */}
                                <div className="form-row grid-meta-icon-color">
                                    <div className="form-group">
                                        <label>{formData.tipo === 'receita' ? 'Meta' : 'Limite'}</label>
                                        <input type="number" step="0.01" name="meta_limite" className="form-input" placeholder="0.00" onChange={handleChange} />
                                    </div>
                                    
                                    <div className="form-group form-group-fixed">
                                        <label>Ícone</label>
                                        <div className="picker-wrapper">
                                            <div className="picker-preview" onClick={() => setShowIconPicker(!showIconPicker)}>
                                                <i className={formData.icone || 'fa-solid fa-question'} style={{color: formData.cor}}></i>
                                            </div>
                                            {showIconPicker && (
                                                <div className="picker-popover icon-grid visible">
                                                    {dashboardData.icones_disponiveis.map(icon => (
                                                        <div key={icon} className="icon-option" onClick={() => { setFormData(prev => ({...prev, icone: icon})); setShowIconPicker(false); }}><i className={icon}></i></div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group form-group-fixed">
                                        <label>Cor</label>
                                        <div className="picker-wrapper">
                                            <div className="picker-preview" onClick={() => setShowColorPicker(!showColorPicker)}>
                                                <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: formData.cor || '#fff' }}></div>
                                            </div>
                                            {showColorPicker && (
                                                <div className="picker-popover color-grid visible">
                                                    {dashboardData.cores_disponiveis.map(cor => (
                                                        <div key={cor} className="color-swatch" style={{backgroundColor: cor}} onClick={() => { setFormData(prev => ({...prev, cor: cor})); setShowColorPicker(false); }}></div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* --- PONTUAL (65% | 35%) --- */}
                        {activeModal === 'pontual' && (
                            <>
                                <div className="form-row grid-65-35">
                                    <div className="form-group">
                                        <label>Descrição</label>
                                        <input name="descricao" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Valor (R$)</label>
                                        <input type="number" step="0.01" name="valor" className="form-input" required onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="form-row grid-50-50">
                                    <div className="form-group">
                                        <label>Data</label>
                                        <input type="date" name="data" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <CategorySelect />
                                </div>
                            </>
                        )}

                        {/* --- PARCELADA (65% | 35%) e (33% | 33% | 33%) --- */}
                        {activeModal === 'parcelada' && (
                            <>
                                <div className="form-row grid-65-35">
                                    <div className="form-group">
                                        <label>Descrição</label>
                                        <input name="descricao" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Valor Total</label>
                                        <input type="number" step="0.01" name="valor" className="form-input" required onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="form-row grid-33">
                                    <div className="form-group">
                                        <label>Data 1ª</label>
                                        <input type="date" name="data" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Nº Parcelas</label>
                                        <input type="number" name="total_parcelas" className="form-input" min="2" required onChange={handleChange} />
                                    </div>
                                    <CategorySelect />
                                </div>
                            </>
                        )}

                        {/* --- RECORRENTE (65% | 35%) e (33% | 33% | 33%) --- */}
                        {activeModal === 'recorrente' && (
                            <>
                                <div className="form-row grid-65-35">
                                    <div className="form-group">
                                        <label>Descrição</label>
                                        <input name="descricao" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Valor</label>
                                        <input type="number" step="0.01" name="valor" className="form-input" required onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="form-row grid-33">
                                    <div className="form-group">
                                        <label>Data Início</label>
                                        <input type="date" name="data" className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Frequência</label>
                                        <select name="frequencia" className="form-input" required onChange={handleChange}>
                                            <option value="mensal">Mensal</option>
                                            <option value="semanal">Semanal</option>
                                            <option value="anual">Anual</option>
                                        </select>
                                    </div>
                                    <CategorySelect />
                                </div>
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