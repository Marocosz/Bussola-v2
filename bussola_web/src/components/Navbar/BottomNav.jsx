import { NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS, findNavItem } from './navItems';

/** Barra inferior fixa (estilo clássico: ícone + rótulo, pílula no item ativo). */
export function BottomNav({ onOpenMore, moreOpen }) {
    const { pathname } = useLocation();
    const current = findNavItem(pathname);
    const maisAtivo = moreOpen || Boolean(current && !current.bottom);

    return (
        <nav className="bottom-nav" aria-label="Navegação principal">
            {NAV_ITEMS.filter((i) => i.bottom).map((i) => (
                <NavLink
                    key={i.to}
                    to={i.to}
                    className={({ isActive }) => `bottom-nav-item ${isActive && !moreOpen ? 'active' : ''}`}
                >
                    <span className="bottom-nav-icon"><i className={`fa-solid ${i.icone}`}></i></span>
                    <span className="bottom-nav-label">{i.rotulo}</span>
                </NavLink>
            ))}
            <button
                type="button"
                className={`bottom-nav-item ${maisAtivo ? 'active' : ''}`}
                onClick={onOpenMore}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                aria-label="Mais"
            >
                <span className="bottom-nav-icon"><i className="fa-solid fa-ellipsis"></i></span>
                <span className="bottom-nav-label">Mais</span>
            </button>
        </nav>
    );
}
