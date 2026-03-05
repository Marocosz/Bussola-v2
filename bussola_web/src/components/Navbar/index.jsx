import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; 
import { useSystem } from '../../context/SystemContext';
// O useToast não é mais necessário aqui, pois o UserDrawer gerencia seus próprios avisos
import { AdminUserModal } from '../AdminUserModal'; 
import { UserDrawer } from '../UserDrawer'; // [NOVO] Import do componente modular

import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css'; 

export function Navbar() {
    const { authenticated, logout, user, updateUserData } = useContext(AuthContext);
    const { isSelfHosted } = useSystem();

    const [theme, setTheme] = useState('dark');
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    // Lógica de Tema (Mantida)
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            setTheme('light');
        }
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

    return (
        <>
            <header className="main-header">
                <nav className="navbar">
                    <Link to="/" className="nav-brand" onClick={closeMobileMenu}>
                        <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                    </Link>

                    <div className="nav-right-controls">
                        <button id="theme-toggle" className="btn-action-icon" onClick={toggleTheme}>
                            <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                        </button>
                        <button
                            className={`btn-hamburger ${isMobileMenuOpen ? 'open' : ''}`}
                            onClick={() => setIsMobileMenuOpen(prev => !prev)}
                            aria-label="Menu"
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>

                    {isMobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu} />}

                    <ul className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                        {authenticated ? (
                            <>
                                <li><Link to="/home" onClick={closeMobileMenu}>Início</Link></li>
                                <li><Link to="/panorama" onClick={closeMobileMenu}>Panorama</Link></li>
                                <li><Link to="/financas" onClick={closeMobileMenu}>Provisões</Link></li>
                                <li><Link to="/agenda" onClick={closeMobileMenu}>Roteiro</Link></li>
                                <li><Link to="/registros" onClick={closeMobileMenu}>Registros</Link></li>
                                <li><Link to="/ritmo" onClick={closeMobileMenu}>Ritmo</Link></li>
                                <li><Link to="/cofre" onClick={closeMobileMenu}>Cofre</Link></li>

                                <li>
                                    <button className="btn-nav-account" onClick={() => { setIsAccountOpen(true); closeMobileMenu(); }}>
                                        <div className="nav-user-avatar">
                                            {user?.avatar_url ? <img src={user.avatar_url} alt="Avatar" /> : <i className="fa-solid fa-user"></i>}
                                        </div>
                                        <span>Minha Conta</span>
                                    </button>
                                </li>

                                <li><Link to="/login" onClick={() => { logout(); closeMobileMenu(); }}>Sair</Link></li>

                                {isSelfHosted && user?.is_superuser && (
                                    <li>
                                        <button
                                            className="btn-secondary btn-nav-create"
                                            onClick={() => { setShowAdminModal(true); closeMobileMenu(); }}
                                            title="Criar Novo Usuário"
                                        >
                                            <i className="fa-solid fa-user-plus"></i>
                                            <span>Novo Usuário</span>
                                        </button>
                                    </li>
                                )}
                            </>
                        ) : (
                            <>
                                <li><Link to="/login" onClick={closeMobileMenu}>Entrar</Link></li>
                            </>
                        )}
                    </ul>
                </nav>
            </header>

            {/* [NOVO] Chamada Modular do Drawer */}
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