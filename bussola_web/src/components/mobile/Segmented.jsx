import { useRef } from 'react';
import { proximoIndiceRoving } from './rovingKeys';
import { segmentedTabId as tabId, segmentedPanelId as panelId } from './segmentedIds';

/**
 * Controle segmentado (abas de página ou alternância). Cada opção é um `role="tab"`.
 * Teclado: setas esquerda/direita, Home e End trocam a aba (tabindex móvel: só a ativa entra no Tab).
 * Com `idBase`, a aba ativa aponta (aria-controls) para o painel de `segmentedPanelProps(idBase, value)`
 * (segmentedIds.js).
 */
export function Segmented({ options, value, onChange, label, className = '', idBase }) {
    const refs = useRef([]);
    const atual = Math.max(0, options.findIndex((o) => o.value === value));

    const onKeyDown = (e) => {
        const prox = proximoIndiceRoving(e.key, atual, options.length, 'horizontal');
        if (prox === null) return;
        e.preventDefault();
        refs.current[prox]?.focus();
        if (prox !== atual) onChange(options[prox].value);
    };

    return (
        <div className={`m-segmented ${className}`} role="tablist" aria-label={label}>
            {options.map((o, i) => {
                const ativo = value === o.value;
                return (
                    <button
                        key={o.value}
                        ref={(el) => { refs.current[i] = el; }}
                        type="button"
                        role="tab"
                        id={idBase ? tabId(idBase, o.value) : undefined}
                        aria-controls={idBase && ativo ? panelId(idBase) : undefined}
                        aria-selected={ativo}
                        tabIndex={i === atual ? 0 : -1}
                        className={`m-segmented-item ${ativo ? 'active' : ''}`}
                        onClick={() => onChange(o.value)}
                        onKeyDown={onKeyDown}
                    >
                        {o.icon && <i className={o.icon} aria-hidden="true"></i>}
                        <span>{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
