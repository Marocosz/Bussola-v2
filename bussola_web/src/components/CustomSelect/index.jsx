import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './styles.css';

export const CustomSelect = React.memo(function CustomSelect({ label, options, value, onChange, placeholder = "Selecione...", name }) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOpt = useMemo(
        () => options.find(opt => String(opt.value) === String(value)),
        [options, value]
    );
    const selectedLabel = selectedOpt?.label || placeholder;

    const handleSelect = useCallback((selectedValue) => {
        onChange({ target: { name, value: selectedValue } });
        setIsOpen(false);
    }, [onChange, name]);

    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

    return (
        <div className="custom-select-wrapper" ref={wrapperRef} style={{ position: 'relative', zIndex: isOpen ? 100 : 1, width: '100%' }}>
            {label && <label className="custom-select-label">{label}</label>}

            <div
                className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={toggleOpen}
            >
                <span className="cs-selected-content" style={{ color: value ? 'var(--cor-texto-principal)' : 'var(--cor-texto-secundario)' }}>
                    {selectedOpt?.color && (
                        <span className="cs-opt-icon-wrap" style={{ backgroundColor: selectedOpt.color }}>
                            {selectedOpt.icon && <i className={selectedOpt.icon}></i>}
                        </span>
                    )}
                    <span className="cs-opt-label">{selectedLabel}</span>
                    {selectedOpt?.type && <span className="cs-opt-type">{selectedOpt.type}</span>}
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
                            {opt.color && (
                                <span className="cs-opt-icon-wrap" style={{ backgroundColor: opt.color }}>
                                    {opt.icon && <i className={opt.icon}></i>}
                                </span>
                            )}
                            <span className="cs-opt-label">{opt.label}</span>
                            {opt.type && <span className="cs-opt-type">{opt.type}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
