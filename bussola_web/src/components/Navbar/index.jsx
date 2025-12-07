import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css';

export function Navbar() {
    // Simulando estado de login (True = Mostra menu completo)
    const isLogged = true; 

    // Estado do tema para controlar o ícone (sol/lua se você quiser implementar depois)
    const [theme, setTheme] = useState('dark');

    // Carrega o tema salvo ao iniciar
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            setTheme('light');
        }
    }, []);

    // Função para alternar o tema
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
                {/* Logo Brand */}
                <Link to="/" className="nav-brand">
                    <img src={bussolaLogo} alt="Logo Bússola" className="nav-logo" />
                </Link>

                {/* Barra de Busca */}
                <div className="nav-search">
                    <form onSubmit={(e) => e.preventDefault()}>
                        <input 
                            type="search" 
                            name="q" 
                            placeholder="Buscar em tudo..." 
                            aria-label="Buscar" 
                        />
                        <button type="submit" aria-label="Buscar">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </button>
                    </form>
                </div>

                {/* Links de Navegação */}
                <ul className="nav-links">
                    {isLogged ? (
                        <>
                            <li><Link to="/panorama">Panorama</Link></li>
                            <li><Link to="/financas">Provisões</Link></li>
                            <li><Link to="/agenda">Roteiro</Link></li>
                            <li><Link to="/registros">Registros</Link></li>
                            <li><Link to="/cofre">Cofre</Link></li>
                            <li><Link to="/logout">Sair</Link></li>
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
                        <li><Link to="/login">Entrar</Link></li>
                    )}
                </ul>
            </nav>
        </header>
    );
}