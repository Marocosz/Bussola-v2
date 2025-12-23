import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; 
// Import do Modal de Usuário
import { AdminUserModal } from '../AdminUserModal'; 

import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css'; 

export function Navbar() {
    const { authenticated, logout, user } = useContext(AuthContext);
    const [theme, setTheme] = useState('dark');
    const [showAdminModal, setShowAdminModal] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            setTheme('light');
        }
    }, []);

    const toggleTheme = () => {
        if (document.body.classList.contains('light-theme')) {
            document.body.classList.remove('light-theme');
            localStorage.setItem('theme', 'dark');
            setTheme('dark');
        } else {
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
            setTheme('light');
        }
    };

    return (
        <>
            <header className="main-header">
                <nav className="navbar">
                    <Link to="/" className="nav-brand">
                        <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                    </Link>

                    <ul className="nav-links">
                        {authenticated ? (
                            <>
                                <li><Link to="/home">Início</Link></li>
                                <li><Link to="/panorama">Panorama</Link></li>
                                <li><Link to="/financas">Provisões</Link></li>
                                <li><Link to="/agenda">Roteiro</Link></li>
                                <li><Link to="/registros">Registros</Link></li>
                                <li><Link to="/ritmo">Ritmo</Link></li>
                                <li><Link to="/cofre">Cofre</Link></li>
                                
                                <li>
                                    <Link to="/login" onClick={logout}>Sair</Link>
                                </li>

                                {/* [ALTERAÇÃO AQUI] 
                                   Mudei de 'btn-primary' para 'btn-secondary' 
                                */}
                                {user?.is_superuser && (
                                    <li>
                                        <button 
                                            className="btn-secondary btn-nav-create"
                                            onClick={() => setShowAdminModal(true)}
                                            title="Criar Novo Usuário"
                                        >
                                            <i className="fa-solid fa-user-plus"></i>
                                            <span>Novo Usuário</span>
                                        </button>
                                    </li>
                                )}

                                <li id="theme-toggle-li">
                                    <button 
                                        id="theme-toggle" 
                                        className="btn-action-icon" 
                                        title="Mudar tema"
                                        onClick={toggleTheme}
                                    >
                                        <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                                    </button>
                                </li>
                            </>
                        ) : (
                            <>
                                <li><Link to="/login">Entrar</Link></li>
                                <li id="theme-toggle-li">
                                    <button 
                                        id="theme-toggle" 
                                        className="btn-action-icon" 
                                        title="Mudar tema"
                                        onClick={toggleTheme}
                                    >
                                        <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                                    </button>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>
            </header>

            <AdminUserModal 
                isOpen={showAdminModal} 
                onClose={() => setShowAdminModal(false)} 
            />
        </>
    );
}