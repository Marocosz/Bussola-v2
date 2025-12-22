import React, { useState, useEffect, useRef } from 'react';
import { createTransacao, createCategoria, updateTransacao, updateCategoria } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { CustomSelect } from '../../../components/CustomSelect';
import { BaseModal } from '../../../components/BaseModal';

export function FinancasModals({ activeModal, closeModal, onUpdate, dashboardData, editingData }) {
    const { addToast } = useToast();
    const [formData, setFormData] = useState({});
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const iconWrapperRef = useRef(null);
    const colorWrapperRef = useRef(null);

    useEffect(() => {
        if (!activeModal) return;

        if (editingData) {
            const dataToLoad = { ...editingData };
            if (dataToLoad.data) {
                const dataString = String(dataToLoad.data);
                if (dataString.includes('T')) {
                    dataToLoad.data = dataString.split('T')[0];
                }
            }
            if (dataToLoad.categoria_id) {
                dataToLoad.categoria_id = Number(dataToLoad.categoria_id);
            }
            setFormData(dataToLoad);
        } else {
            setFormData({});
        }

        setShowIconPicker(false);
        setShowColorPicker(false);

    }, [activeModal, editingData]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (showIconPicker && iconWrapperRef.current && !iconWrapperRef.current.contains(event.target)) {
                setShowIconPicker(false);
            }
            if (showColorPicker && colorWrapperRef.current && !colorWrapperRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showIconPicker, showColorPicker]);

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
                
                if (editingData) {
                    await updateCategoria(editingData.id, payload);
                } else {
                    await createCategoria(payload);
                }
            } else {
                let payload = { ...formData, tipo_recorrencia: activeModal };
                if (editingData) {
                    await updateTransacao(editingData.id, payload);
                } else {
                    await createTransacao(payload);
                }
            }
            
            addToast({ type: 'success', title: 'Sucesso', description: 'Salvo com sucesso.' });
            onUpdate(); 
            closeModal(); 
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', description: 'Erro ao salvar.' });
        }
    };

    const safeData = dashboardData || {};
    const safeDespesas = safeData.categorias_despesa || [];
    const safeReceitas = safeData.categorias_receita || [];
    const safeIcones = safeData.icones_disponiveis || [];
    const safeCores = safeData.cores_disponiveis || [];

    const categoryOptions = [
        ...safeDespesas.map(c => ({ 
            value: c.id, 
            label: c.nome.includes('(') ? c.nome : `${c.nome} (Despesa)` 
        })),
        ...safeReceitas.map(c => ({ 
            value: c.id, 
            label: c.nome.includes('(') ? c.nome : `${c.nome} (Receita)` 
        }))
    ];

    const frequencyOptions = [
        { value: 'mensal', label: 'Mensal' },
        { value: 'semanal', label: 'Semanal' },
        { value: 'anual', label: 'Anual' }
    ];

    const titles = {
        category: editingData ? 'Editar Categoria' : 'Nova Categoria',
        pontual: editingData ? 'Editar Transação' : 'Nova Transação Única',
        parcelada: editingData ? 'Editar Parcela' : 'Nova Transação Parcelada',
        recorrente: editingData ? 'Editar Recorrência' : 'Nova Transação Recorrente'
    };

    return (
        <BaseModal onClose={closeModal} className="modal">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{titles[activeModal]}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        
                        {activeModal === 'category' && (
                            <>
                                <div className="form-row grid-60-40">
                                    <div className="form-group">
                                        <label>Nome</label>
                                        <input name="nome" value={formData.nome || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Tipo</label>
                                        <div className="custom-type-selector">
                                            <div className={`type-option ${formData.tipo !== 'receita' ? 'active despesa' : ''}`} onClick={() => handleTypeChange('despesa')}>Despesa</div>
                                            <div className={`type-option ${formData.tipo === 'receita' ? 'active receita' : ''}`} onClick={() => handleTypeChange('receita')}>Receita</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-row grid-meta-icon-color">
                                    <div className="form-group">
                                        <label>{formData.tipo === 'receita' ? 'Meta' : 'Limite'}</label>
                                        <input type="number" step="0.01" name="meta_limite" value={formData.meta_limite || ''} className="form-input" placeholder="0.00" onChange={handleChange} />
                                    </div>
                                    
                                    <div className="form-group form-group-fixed">
                                        <label>Ícone</label>
                                        <div className="picker-wrapper" ref={iconWrapperRef}>
                                            <div className="picker-preview" onClick={() => setShowIconPicker(!showIconPicker)}>
                                                <i className={formData.icone || 'fa-solid fa-question'} style={{color: formData.cor}}></i>
                                            </div>
                                            {showIconPicker && (
                                                <div className="picker-popover icon-grid visible">
                                                    {safeIcones.map(icon => (
                                                        <div key={icon} className="icon-option" onClick={() => { setFormData(prev => ({...prev, icone: icon})); setShowIconPicker(false); }}><i className={icon}></i></div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group form-group-fixed">
                                        <label>Cor</label>
                                        <div className="picker-wrapper" ref={colorWrapperRef}>
                                            <div className="picker-preview" onClick={() => setShowColorPicker(!showColorPicker)}>
                                                <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: formData.cor || '#fff' }}></div>
                                            </div>
                                            {showColorPicker && (
                                                <div className="picker-popover color-grid visible">
                                                    {safeCores.map(cor => (
                                                        <div key={cor} className="color-swatch" style={{backgroundColor: cor}} onClick={() => { setFormData(prev => ({...prev, cor: cor})); setShowColorPicker(false); }}></div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeModal === 'pontual' && (
                            <>
                                <div className="form-row grid-65-35">
                                    <div className="form-group">
                                        <label>Descrição</label>
                                        <input name="descricao" value={formData.descricao || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Valor (R$)</label>
                                        <input type="number" step="0.01" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="form-row grid-50-50">
                                    <div className="form-group">
                                        <label>Data</label>
                                        <input type="date" name="data" value={formData.data || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <CustomSelect 
                                            label="Categoria"
                                            name="categoria_id"
                                            value={formData.categoria_id}
                                            options={categoryOptions}
                                            onChange={handleChange}
                                            placeholder="Selecione..."
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeModal === 'parcelada' && (
                            <>
                                <div className="form-row grid-65-35">
                                    <div className="form-group">
                                        <label>Descrição</label>
                                        <input name="descricao" value={formData.descricao || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>{editingData ? 'Valor da Parcela' : 'Valor Total'}</label>
                                        <input type="number" step="0.01" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} placeholder="Ex: 1000.00" />
                                    </div>
                                </div>
                                <div className="form-row grid-33">
                                    <div className="form-group">
                                        <label>{editingData ? 'Data' : 'Data 1ª parcela'}</label>
                                        <input type="date" name="data" value={formData.data || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Nº Parcelas</label>
                                        <input 
                                            type="number" 
                                            name="total_parcelas" 
                                            value={formData.total_parcelas || ''} 
                                            className="form-input" 
                                            min="2" 
                                            required 
                                            onChange={handleChange}
                                            disabled={!!editingData} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <CustomSelect 
                                            label="Categoria"
                                            name="categoria_id"
                                            value={formData.categoria_id}
                                            options={categoryOptions}
                                            onChange={handleChange}
                                            placeholder="Selecione..."
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeModal === 'recorrente' && (
                            <>
                                <div className="form-row grid-65-35">
                                    <div className="form-group">
                                        <label>Descrição</label>
                                        <input name="descricao" value={formData.descricao || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Valor Mensal</label>
                                        <input type="number" step="0.01" name="valor" value={formData.valor || ''} className="form-input" required onChange={handleChange} placeholder="Ex: 39.90" />
                                    </div>
                                </div>
                                <div className="form-row grid-33">
                                    <div className="form-group">
                                        <label>{editingData ? 'Data' : 'Data Início'}</label>
                                        <input type="date" name="data" value={formData.data || ''} className="form-input" required onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <CustomSelect 
                                            label="Frequência"
                                            name="frequencia"
                                            value={formData.frequencia}
                                            options={frequencyOptions}
                                            onChange={handleChange}
                                            placeholder="Selecione..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <CustomSelect 
                                            label="Categoria"
                                            name="categoria_id"
                                            value={formData.categoria_id}
                                            options={categoryOptions}
                                            onChange={handleChange}
                                            placeholder="Selecione..."
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">{editingData ? 'Atualizar' : 'Salvar'}</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}