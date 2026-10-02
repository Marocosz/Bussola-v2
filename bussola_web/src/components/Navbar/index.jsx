import React, { useEffect, useState, useContext } from 'react';
import { loadSavedColorTheme } from '../../utils/colorTheme';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useSystem } from '../../context/SystemContext';
import { useIsMobile, useIsTablet } from '../../hooks/useIsMobile';
import { useMobileChrome } from '../mobile/MobileChrome';
import { AdminUserModal } from '../AdminUserModal';
import { UserDrawer } from '../UserDrawer';
import { NAV_ITEMS, findNavItem } from './navItems';
import { MobileTopbar } from './MobileTopbar';
import { BottomNav } from './BottomNav';
import { MoreSheet } from './MoreSheet';

import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css';

// Navegação principal: sidebar à esquerda (desktop/tablet) ou topbar + barra inferior (celular).
// O estado "recolhida" da sidebar fica salvo no navegador.
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
    const [recolhida, setRecolhida] = useState(lerRecolhida);

    const isMobile = useIsMobile();
    const isTablet = useIsTablet();
    const navigate = useNavigate();
    const { setSlotEl } = useMobileChrome();
    const [moreOpen, setMoreOpen] = useState(false);
    const [, setAiOpen] = useState(false);
    const current = findNavItem(pathname);
    const sairMobile = () => { logout(); navigate('/login'); };

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

    const colapsada = recolhida || isTablet;

    return (
        <>
            {isMobile ? (
                <>
                    <MobileTopbar
                        title={current?.rotulo ?? 'Bússola'}
                        aiContext={current?.aiContext}
                        user={user}
                        onOpenAccount={() => setIsAccountOpen(true)}
                        onOpenAi={() => setAiOpen(true)}
                        slotRef={setSlotEl}
                    />
                    <BottomNav moreOpen={moreOpen} onOpenMore={() => setMoreOpen(true)} />
                    <MoreSheet
                        open={moreOpen}
                        onClose={() => setMoreOpen(false)}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                        onOpenAccount={() => setIsAccountOpen(true)}
                        showAdmin={Boolean(authenticated && isSelfHosted && user?.is_superuser)}
                        onOpenAdmin={() => setShowAdminModal(true)}
                        onLogout={sairMobile}
                    />
                </>
            ) : (
                <aside className={`sidebar ${colapsada ? 'collapsed' : ''}`}>
                    <Link to="/home" className="sidebar-brand">
                        <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                        <span className="sidebar-label sidebar-brand-name">Bússola</span>
                    </Link>

                    <nav className="sidebar-nav">
                        {authenticated ? NAV_ITEMS.map(link => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive || (link.to === '/home' && pathname === '/') ? 'active' : ''}`
                                }
                                title={colapsada ? link.rotulo : undefined}
                            >
                                <i className={`fa-solid ${link.icone}`}></i>
                                <span className="sidebar-label">{link.rotulo}</span>
                            </NavLink>
                        )) : (
                            <Link to="/login" className="sidebar-link">
                                <i className="fa-solid fa-right-to-bracket"></i>
                                <span className="sidebar-label">Entrar</span>
                            </Link>
                        )}
                    </nav>

                    <div className="sidebar-footer">
                        {authenticated && (
                            <button
                                className="btn-nav-account"
                                onClick={() => setIsAccountOpen(true)}
                                title={colapsada ? 'Minha Conta' : undefined}
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
                                onClick={() => setShowAdminModal(true)}
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
                            {!isTablet && (
                                <button
                                    className="btn-action-icon sidebar-collapse"
                                    onClick={alternarRecolhida}
                                    title={recolhida ? 'Expandir menu' : 'Recolher menu'}
                                >
                                    <i className={`fa-solid ${recolhida ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
                                </button>
                            )}
                        </div>

                        {authenticated && (
                            <Link
                                to="/login"
                                className="sidebar-link sidebar-logout"
                                onClick={() => logout()}
                                title={colapsada ? 'Sair' : undefined}
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                                <span className="sidebar-label">Sair</span>
                            </Link>
                        )}
                    </div>
                </aside>
            )}

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
