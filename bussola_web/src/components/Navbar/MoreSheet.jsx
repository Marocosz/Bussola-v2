import { useNavigate } from 'react-router-dom';
import { Sheet } from '../mobile/Sheet';
import { NAV_ITEMS } from './navItems';

/** Sheet "Mais": módulos fora da barra inferior + conta, tema, admin e sair. */
export function MoreSheet({ open, onClose, theme, onToggleTheme, onOpenAccount, showAdmin, onOpenAdmin, onLogout }) {
    const navigate = useNavigate();
    const go = (to) => { onClose(); navigate(to); };

    return (
        <Sheet open={open} onClose={onClose} title="Mais" className="more-sheet">
            <div className="more-grid">
                {NAV_ITEMS.filter((i) => !i.bottom).map((i) => (
                    <button key={i.to} type="button" className="more-tile" onClick={() => go(i.to)}>
                        <i className={`fa-solid ${i.icone}`}></i>
                        <span>{i.rotulo}</span>
                    </button>
                ))}
            </div>
            <div className="more-list">
                <button type="button" className="more-row" onClick={() => { onClose(); onOpenAccount(); }}>
                    <i className="fa-solid fa-user"></i><span>Minha Conta</span>
                    <i className="fa-solid fa-chevron-right more-row-chevron"></i>
                </button>
                <button type="button" className="more-row" onClick={onToggleTheme}>
                    <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                    <span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>
                </button>
                {showAdmin && (
                    <button type="button" className="more-row" onClick={() => { onClose(); onOpenAdmin(); }}>
                        <i className="fa-solid fa-user-plus"></i><span>Novo Usuário</span>
                    </button>
                )}
                <button type="button" className="more-row is-danger" onClick={() => { onClose(); onLogout(); }}>
                    <i className="fa-solid fa-arrow-right-from-bracket"></i><span>Sair</span>
                </button>
            </div>
        </Sheet>
    );
}
