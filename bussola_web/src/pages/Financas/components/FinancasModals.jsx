import React, { useState, useEffect, useRef } from 'react';
import { createTransacao, createCategoria } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function FinancasModals({ activeModal, closeModal, onUpdate, dashboardData }) {
    const { addToast } = useToast();
    
    const [formData, setFormData] = useState({});
    
    // Pickers e Dropdowns
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    
    // Controla qual Select Customizado está aberto ('categoria', 'frequencia' ou null)
    const [activeDropdown, setActiveDropdown] = useState(null);

    // Refs para detectar cliques fora dos elementos
    const iconWrapperRef = useRef(null);
    const colorWrapperRef = useRef(null);

    // Limpa estados ao abrir/fechar
    useEffect(() => {
        setFormData({});
        setShowIconPicker(false);
        setShowColorPicker(false);
        setActiveDropdown(null);
    }, [activeModal]);

    // --- LÓGICA DE CLIQUE FORA (Global para o Modal) ---
    useEffect(() => {
        function handleClickOutside(event) {
            // 1. Fechar Icon Picker se clicar fora
            if (showIconPicker && iconWrapperRef.current && !iconWrapperRef.current.contains(event.target)) {
                setShowIconPicker(false);
            }

            // 2. Fechar Color Picker se clicar fora
            if (showColorPicker && colorWrapperRef.current && !colorWrapperRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }

            // 3. Fechar Select Customizado se clicar fora
            // Verifica se o clique NÃO foi em um trigger ou nas opções do select
            if (activeDropdown) {
                const clickedInsideSelect = event.target.closest('.custom-select-trigger') || event.target.closest('.custom-select-options');
                if (!clickedInsideSelect) {
                    setActiveDropdown(null);
                }
            }
        }

        // Adiciona listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showIconPicker, showColorPicker, activeDropdown]);

    if (!activeModal) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTypeChange = (tipo) => {
        setFormData(prev => ({ ...prev, tipo: tipo }));
    };

    // Função para simular o evento de mudança nos selects customizados
    const handleCustomSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        setActiveDropdown(null); // Fecha o menu após selecionar
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

    // --- COMPONENTE SELECT CUSTOMIZADO (REUTILIZÁVEL) ---
    const renderCustomSelect = (name, label, options, placeholder = "Selecione...") => {
        const isOpen = activeDropdown === name;
        const selectedValue = formData[name];
        
        // Encontra o rótulo do valor selecionado para exibir no input
        const selectedLabel = options.find(opt => opt.value == selectedValue)?.label || placeholder;

        return (
            <div className="form-group" style={{ position: 'relative', zIndex: isOpen ? 100 : 1 }}>
                <label>{label}</label>
                
                {/* O "Input" Falso (Trigger) */}
                <div 
                    className={`custom-select-trigger ${isOpen ? 'open' : ''}`} 
                    onClick={() => setActiveDropdown(isOpen ? null : name)}
                >
                    <span style={{ color: selectedValue ? 'var(--cor-texto-principal)' : 'var(--cor-texto-secundario)' }}>
                        {selectedLabel}
                    </span>
                    <i className="fa-solid fa-chevron-down arrow-icon"></i>
                </div>

                {/* A Lista de Opções (Dropdown) */}
                {isOpen && (
                    <div className="custom-select-options">
                        {options.map(opt => (
                            <div 
                                key={opt.value} 
                                className={`custom-option ${selectedValue === opt.value ? 'selected' : ''}`}
                                onClick={() => handleCustomSelectChange(name, opt.value)}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Prepara as opções de categoria
    const categoryOptions = [
        ...dashboardData.categorias_despesa.map(c => ({ value: c.id, label: `${c.nome} (Despesa)` })),
        ...dashboardData.categorias_receita.map(c => ({ value: c.id, label: `${c.nome} (Receita)` }))
    ];

    // Prepara as opções de frequência
    const frequencyOptions = [
        { value: 'mensal', label: 'Mensal' },
        { value: 'semanal', label: 'Semanal' },
        { value: 'anual', label: 'Anual' }
    ];

    const titles = {
        category: 'Nova Categoria',
        pontual: 'Nova Transação Única',
        parcelada: 'Nova Transação Parcelada',
        recorrente: 'Nova Transação Recorrente'
    };

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{titles[activeModal]}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        
                        {/* --- NOVA CATEGORIA --- */}
                        {activeModal === 'category' && (
                            <>
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
                                <div className="form-row grid-meta-icon-color">
                                    <div className="form-group">
                                        <label>{formData.tipo === 'receita' ? 'Meta' : 'Limite'}</label>
                                        <input type="number" step="0.01" name="meta_limite" className="form-input" placeholder="0.00" onChange={handleChange} />
                                    </div>
                                    
                                    <div className="form-group form-group-fixed">
                                        <label>Ícone</label>
                                        <div className="picker-wrapper" ref={iconWrapperRef}>
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
                                        <div className="picker-wrapper" ref={colorWrapperRef}>
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

                        {/* --- PONTUAL --- */}
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
                                    {/* Select Customizado de Categoria */}
                                    {renderCustomSelect('categoria_id', 'Categoria', categoryOptions)}
                                </div>
                            </>
                        )}

                        {/* --- PARCELADA --- */}
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
                                    {/* Select Customizado de Categoria */}
                                    {renderCustomSelect('categoria_id', 'Categoria', categoryOptions)}
                                </div>
                            </>
                        )}

                        {/* --- RECORRENTE --- */}
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
                                    
                                    {/* Select Customizado de Frequência */}
                                    {renderCustomSelect('frequencia', 'Frequência', frequencyOptions)}
                                    
                                    {/* Select Customizado de Categoria */}
                                    {renderCustomSelect('categoria_id', 'Categoria', categoryOptions)}
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