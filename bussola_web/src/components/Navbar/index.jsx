import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; 
import { useSystem } from '../../context/SystemContext';
import { useToast } from '../../context/ToastContext'; 
import { AdminUserModal } from '../AdminUserModal'; 

import bussolaLogo from '../../assets/images/bussola.svg';
import '../../assets/styles/layout.css'; 

export function Navbar() {
    const { authenticated, logout, user, updateUserData } = useContext(AuthContext);
    const { isSelfHosted } = useSystem();
    const { addToast } = useToast();

    const [theme, setTheme] = useState('dark');
    const [showAdminModal, setShowAdminModal] = useState(false);
    
    // Estados do Drawer
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newsPrefs, setNewsPrefs] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Tópicos disponíveis
    const availableTopics = [
        { id: 'tech', label: 'Tecnologia' },
        { id: 'finance', label: 'Economia' },
        { id: 'crypto', label: 'Cripto' },
        { id: 'sports', label: 'Esportes' },
        { id: 'world', label: 'Mundo' }
    ];

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            setTheme('light');
        }
    }, []);

    useEffect(() => {
        if (user && isAccountOpen) {
            setEditName(user.full_name || '');
            setEditCity(user.city || '');
            setEditEmail(user.email || '');
            setNewsPrefs(user.news_preferences || ['tech']);
            setEditPassword('');
            setCurrentPassword('');
        }
    }, [user, isAccountOpen]);

    const handleTopicToggle = (topicId) => {
        if (newsPrefs.includes(topicId)) {
            if (newsPrefs.length > 1) {
                setNewsPrefs(newsPrefs.filter(t => t !== topicId));
            } else {
                addToast({ type: 'warning', title: 'Atenção', description: 'Selecione ao menos um tópico.' });
            }
        } else {
            setNewsPrefs([...newsPrefs, topicId]);
        }
    };

    const handleSaveAccount = async () => {
        setIsSaving(true);
        
        const updatePayload = {
            full_name: editName,
            city: editCity,
            news_preferences: newsPrefs
        };

        // Lógica de segurança para troca de email/senha
        if (user?.auth_provider !== 'google') {
            const hasEmailChanged = editEmail !== user.email;
            const hasPasswordChanged = editPassword.length > 0;

            if (hasEmailChanged) updatePayload.email = editEmail;
            if (hasPasswordChanged) updatePayload.new_password = editPassword;

            if (hasEmailChanged || hasPasswordChanged) {
                if (!currentPassword) {
                    addToast({ type: 'warning', title: 'Segurança', description: 'Informe sua senha atual para confirmar as mudanças.' });
                    setIsSaving(false);
                    return;
                }
                updatePayload.current_password = currentPassword;
            }
        }

        const result = await updateUserData(updatePayload);

        if (result.success) {
            addToast({ type: 'success', title: 'Sucesso', description: 'Perfil atualizado!' });
            setIsAccountOpen(false);
        } else {
            const errorDetail = result?.message || 'Verifique se a senha atual está correta.';
            addToast({ type: 'error', title: 'Erro', description: errorDetail });
        }
        setIsSaving(false);
    };

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
                                    <button className="btn-nav-account" onClick={() => setIsAccountOpen(true)}>
                                        <div className="nav-user-avatar">
                                            {user?.avatar_url ? <img src={user.avatar_url} alt="Avatar" /> : <i className="fa-solid fa-user"></i>}
                                        </div>
                                        <span>Minha Conta</span>
                                    </button>
                                </li>

                                <li><Link to="/login" onClick={logout}>Sair</Link></li>

                                {isSelfHosted && user?.is_superuser && (
                                    <li>
                                        <button className="btn-secondary btn-nav-create" onClick={() => setShowAdminModal(true)}>
                                            <i className="fa-solid fa-user-plus"></i>
                                            <span>Novo Usuário</span>
                                        </button>
                                    </li>
                                )}

                                <li id="theme-toggle-li">
                                    <button id="theme-toggle" className="btn-action-icon" onClick={toggleTheme}>
                                        <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                                    </button>
                                </li>
                            </>
                        ) : (
                            <>
                                <li><Link to="/login">Entrar</Link></li>
                                <li id="theme-toggle-li">
                                    <button id="theme-toggle" className="btn-action-icon" onClick={toggleTheme}>
                                        <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                                    </button>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>
            </header>

            {/* Account Drawer */}
            <div className={`account-drawer-overlay ${isAccountOpen ? 'active' : ''}`} onClick={() => setIsAccountOpen(false)}>
                <div className={`account-drawer ${isAccountOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                    <div className="drawer-header">
                        <h2>Configurações de Conta</h2>
                        <button className="btn-close-drawer" onClick={() => setIsAccountOpen(false)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div className="drawer-body">
                        <div className="drawer-avatar-section">
                            <div className="drawer-avatar-large">
                                {user?.avatar_url ? <img src={user.avatar_url} alt="Avatar" /> : <i className="fa-solid fa-user"></i>}
                            </div>
                            <span className="auth-provider-tag">
                                {user?.auth_provider === 'google' ? <i className="fa-brands fa-google"></i> : <i className="fa-solid fa-envelope"></i>}
                                {user?.auth_provider} account
                            </span>
                        </div>

                        <div className="drawer-form">
                            <div className="form-group">
                                <label>Nome Completo</label>
                                <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>Cidade para o Clima</label>
                                <input className="form-input" placeholder="Ex: São Paulo" value={editCity} onChange={e => setEditCity(e.target.value)} />
                            </div>

                            <div className="form-group">
                                <label>Interesses de Notícias</label>
                                <div className="custom-select-area">
                                    {availableTopics.map(topic => (
                                        <div 
                                            key={topic.id}
                                            className={`custom-option ${newsPrefs.includes(topic.id) ? 'selected' : ''}`}
                                            onClick={() => handleTopicToggle(topic.id)}
                                            style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            {topic.label}
                                            {newsPrefs.includes(topic.id) && <i className="fa-solid fa-check"></i>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {user?.auth_provider !== 'google' ? (
                                <>
                                    <div className="form-divider">Segurança</div>
                                    <div className="form-group">
                                        <label>Alterar E-mail</label>
                                        <input className="form-input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                                    </div>

                                    {(editEmail !== user?.email || editPassword) && (
                                        <div className="form-group" style={{ backgroundColor: 'rgba(231, 76, 60, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
                                            <label style={{ color: 'var(--cor-vermelho-delete)', fontWeight: 'bold' }}>Senha Atual (Confirmação)</label>
                                            <input 
                                                className="form-input" 
                                                type="password" 
                                                placeholder="Digite para confirmar" 
                                                value={currentPassword} 
                                                onChange={e => setCurrentPassword(e.target.value)} 
                                            />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label>Nova Senha (deixe vazio para não alterar)</label>
                                        <input className="form-input" type="password" placeholder="••••••••" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                                    </div>
                                </>
                            ) : (
                                <div className="google-info-box">
                                    <i className="fa-solid fa-shield-halved"></i>
                                    E-mail e senha são gerenciados pelo Google.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="drawer-footer">
                        <button className="btn-primary" style={{width: '100%'}} onClick={handleSaveAccount} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>

            <AdminUserModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
        </>
    );
}