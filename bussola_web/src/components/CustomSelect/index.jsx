import React, { useState, useEffect, useRef } from 'react';
import './styles.css'; // Vamos criar esse CSS no Passo 2

export function CustomSelect({ label, options, value, onChange, placeholder = "Selecione...", name }) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Encontra o label da opção selecionada
    const selectedLabel = options.find(opt => String(opt.value) === String(value))?.label || placeholder;

    const handleSelect = (selectedValue) => {
        // Simula o evento padrão do HTML para funcionar com seus handlers existentes
        onChange({
            target: {
                name: name,
                value: selectedValue
            }
        });
        setIsOpen(false);
    };

    return (
        <div className="custom-select-wrapper" ref={wrapperRef} style={{ position: 'relative', zIndex: isOpen ? 100 : 1, width: '100%' }}>
            {label && <label className="custom-select-label">{label}</label>}
            
            <div 
                className={`custom-select-trigger ${isOpen ? 'open' : ''}`} 
                onClick={() => setIsOpen(!isOpen)}
            >
                <span style={{ color: value ? 'var(--cor-texto-principal)' : 'var(--cor-texto-secundario)' }}>
                    {selectedLabel}
                </span>
                <i className="fa-solid fa-chevron-down arrow-icon"></i>
            </div>

            {isOpen && (
                <div className="custom-select-options">
                    {options.map(opt => (
                        <div 
                            key={opt.value} 
                            className={`custom-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
                            onClick={() => handleSelect(opt.value)}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}