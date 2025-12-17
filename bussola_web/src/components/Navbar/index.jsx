import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; // <--- Importando Contexto
import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css'; 

export function Navbar() {
    // Pegamos o estado real de autenticação e a função de logout
    const { authenticated, logout } = useContext(AuthContext);

    // Estado do tema
    const [theme, setTheme] = useState('dark');

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
        <header className="main-header">
            <nav className="navbar">
                <Link to="/" className="nav-brand">
                    <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                </Link>


                <ul className="nav-links">
                    {/* Renderiza links apenas se estiver autenticado */}
                    {authenticated ? (
                        <>
                            <li><Link to="/home">Início</Link></li>
                            <li><Link to="/panorama">Panorama</Link></li>
                            <li><Link to="/financas">Provisões</Link></li>
                            <li><Link to="/agenda">Roteiro</Link></li>
                            <li><Link to="/registros">Registros</Link></li>
                            {/* --- NOVO LINK: RITMO --- */}
                            <li><Link to="/ritmo">Ritmo</Link></li>
                            
                            <li><Link to="/cofre">Cofre</Link></li>
                            <li>
                                {/* Botão de Sair chama o logout do contexto */}
                                <Link to="/login" onClick={logout}>Sair</Link>
                            </li>
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
                        // Se não estiver logado, mostra apenas Entrar e o Tema
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
    );
}