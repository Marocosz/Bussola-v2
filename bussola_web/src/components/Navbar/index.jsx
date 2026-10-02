import React, { useEffect, useState, useContext } from 'react';
import { loadSavedColorTheme } from '../../utils/colorTheme';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useSystem } from '../../context/SystemContext';
import { AdminUserModal } from '../AdminUserModal';
import { UserDrawer } from '../UserDrawer';

import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css';

// Navegação principal (sidebar à esquerda). O estado "recolhida" fica salvo no navegador.
const LINKS = [
    { to: '/home', icone: 'fa-house', rotulo: 'Início' },
    { to: '/panorama', icone: 'fa-chart-pie', rotulo: 'Panorama' },
    { to: '/financas', icone: 'fa-wallet', rotulo: 'Provisões' },
    { to: '/agenda', icone: 'fa-calendar-days', rotulo: 'Roteiro' },
    { to: '/registros', icone: 'fa-book', rotulo: 'Registros' },
    { to: '/estudos', icone: 'fa-graduation-cap', rotulo: 'Estudos' },
    { to: '/ritmo', icone: 'fa-dumbbell', rotulo: 'Ritmo' },
    { to: '/cofre', icone: 'fa-vault', rotulo: 'Cofre' },
];

const CHAVE_RECOLHIDA = 'sidebar-recolhida';

function lerRecolhida() {
    try {
        return localStorage.getItem(CHAVE_RECOLHIDA) === '1';
    } catch {
        return false;
    }
}

export function Navbar() {
    const { authenticated, logout, user, updateUserData } = useContext(AuthContext);
    const { isSelfHosted } = useSystem();
    const { pathname } = useLocation();

    const [theme, setTheme] = useState('dark');
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [recolhida, setRecolhida] = useState(lerRecolhida);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    // Lógica de Tema (Mantida)
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            setTheme('light');
        }
        loadSavedColorTheme();
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        if (newTheme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        localStorage.setItem('theme', newTheme);
        setTheme(newTheme);
    };

    const alternarRecolhida = () => {
        const nova = !recolhida;
        setRecolhida(nova);
        try {
            localStorage.setItem(CHAVE_RECOLHIDA, nova ? '1' : '0');
        } catch {
            // sem storage: a preferência só não persiste
        }
    };

    return (
        <>
            {/* Barra fina no topo — só aparece no celular */}
            <header className="mobile-topbar">
                <Link to="/home" className="nav-brand" onClick={closeMobileMenu}>
                    <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                </Link>
                <button
                    className={`btn-hamburger ${isMobileMenuOpen ? 'open' : ''}`}
                    onClick={() => setIsMobileMenuOpen(prev => !prev)}
                    aria-label="Menu"
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </header>

            {isMobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu} />}

            <aside className={`sidebar ${recolhida ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                <Link to="/home" className="sidebar-brand" onClick={closeMobileMenu}>
                    <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                    <span className="sidebar-label sidebar-brand-name">Bússola</span>
                </Link>

                <nav className="sidebar-nav">
                    {authenticated ? LINKS.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive || (link.to === '/home' && pathname === '/') ? 'active' : ''}`
                            }
                            onClick={closeMobileMenu}
                            title={recolhida ? link.rotulo : undefined}
                        >
                            <i className={`fa-solid ${link.icone}`}></i>
                            <span className="sidebar-label">{link.rotulo}</span>
                        </NavLink>
                    )) : (
                        <Link to="/login" className="sidebar-link" onClick={closeMobileMenu}>
                            <i className="fa-solid fa-right-to-bracket"></i>
                            <span className="sidebar-label">Entrar</span>
                        </Link>
                    )}
                </nav>

                <div className="sidebar-footer">
                    {authenticated && (
                        <button
                            className="btn-nav-account"
                            onClick={() => { setIsAccountOpen(true); closeMobileMenu(); }}
                            title={recolhida ? 'Minha Conta' : undefined}
                        >
                            <div className="nav-user-avatar">
                                {user?.avatar_url ? <img src={user.avatar_url} alt="Avatar" /> : <i className="fa-solid fa-user"></i>}
                            </div>
                            <span className="sidebar-label">Minha Conta</span>
                        </button>
                    )}

                    {authenticated && isSelfHosted && user?.is_superuser && (
                        <button
                            className="sidebar-link sidebar-action"
                            onClick={() => { setShowAdminModal(true); closeMobileMenu(); }}
                            title="Criar Novo Usuário"
                        >
                            <i className="fa-solid fa-user-plus"></i>
                            <span className="sidebar-label">Novo Usuário</span>
                        </button>
                    )}

                    <div className="sidebar-tools">
                        <button
                            id="theme-toggle"
                            className="btn-action-icon"
                            onClick={toggleTheme}
                            title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}
                        >
                            <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                        </button>
                        <button
                            className="btn-action-icon sidebar-collapse"
                            onClick={alternarRecolhida}
                            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
                        >
                            <i className={`fa-solid ${recolhida ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
                        </button>
                    </div>

                    {authenticated && (
                        <Link
                            to="/login"
                            className="sidebar-link sidebar-logout"
                            onClick={() => { logout(); closeMobileMenu(); }}
                            title={recolhida ? 'Sair' : undefined}
                        >
                            <i className="fa-solid fa-arrow-right-from-bracket"></i>
                            <span className="sidebar-label">Sair</span>
                        </Link>
                    )}
                </div>
            </aside>

            <UserDrawer
                isOpen={isAccountOpen}
                onClose={() => setIsAccountOpen(false)}
                user={user}
                updateUserData={updateUserData}
            />

            <AdminUserModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
        </>
    );
}
