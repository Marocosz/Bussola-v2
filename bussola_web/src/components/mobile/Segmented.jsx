/** Controle segmentado (abas de página ou alternância). Cada opção é um `role="tab"`. */
export function Segmented({ options, value, onChange, label, className = '' }) {
    return (
        <div className={`m-segmented ${className}`} role="tablist" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={value === o.value}
                    className={`m-segmented-item ${value === o.value ? 'active' : ''}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.icon && <i className={o.icon} aria-hidden="true"></i>}
                    <span>{o.label}</span>
                </button>
            ))}
        </div>
    );
}
