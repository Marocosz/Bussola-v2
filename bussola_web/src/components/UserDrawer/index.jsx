import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { CitySelector } from '../CitySelector';
import { getNewsTopics } from '../../services/api'; 
import zxcvbn from 'zxcvbn'; // Importando lib de força de senha
import './styles.css';

export function UserDrawer({ isOpen, onClose, user, updateUserData }) {
    const { addToast } = useToast();

    // Estados locais
    const [editName, setEditName] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newsPrefs, setNewsPrefs] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para força da senha (Nova Senha)
    const [passwordScore, setPasswordScore] = useState(null);
    const [passwordFeedback, setPasswordFeedback] = useState('');

    const [availableTopics, setAvailableTopics] = useState([]);

    useEffect(() => {
        async function loadTopics() {
            try {
                const topics = await getNewsTopics();
                if (topics && topics.length > 0) {
                    setAvailableTopics(topics);
                } else {
                    setAvailableTopics([
                        { id: 'tech', label: 'Tecnologia' },
                        { id: 'finance', label: 'Finanças' }
                    ]);
                }
            } catch (err) {
                console.error("Falha ao carregar tópicos:", err);
            }
        }
        loadTopics();
    }, []);

    useEffect(() => {
        if (user && isOpen) {
            setEditName(user.full_name || '');
            setEditCity(user.city || '');
            setEditEmail(user.email || '');
            setNewsPrefs(user.news_preferences || ['tech']);
            setEditPassword('');
            setCurrentPassword('');
            setPasswordScore(null);
            setPasswordFeedback('');
        }
    }, [user, isOpen]);

    const hasPasswordSet = user?.auth_provider === 'local' || user?.auth_provider === 'hybrid';
    const isGoogleOnly = user?.auth_provider === 'google' && !hasPasswordSet;

    // Handler para mudança de senha com feedback visual
    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setEditPassword(val);
        if (val) {
            const result = zxcvbn(val);
            setPasswordScore(result.score); // 0 a 4
            const messages = [
                "Muito fraca",
                "Fraca",
                "Média",
                "Forte",
                "Muito Forte"
            ];
            setPasswordFeedback(messages[result.score]);
        } else {
            setPasswordScore(null);
            setPasswordFeedback('');
        }
    };

    // Helper para cor da barra
    const getStrengthColor = () => {
        switch (passwordScore) {
            case 0: return '#ef4444'; // Vermelho
            case 1: return '#f97316'; // Laranja
            case 2: return '#eab308'; // Amarelo
            case 3: return '#84cc16'; // Verde claro
            case 4: return '#10b981'; // Verde forte
            default: return '#e5e7eb';
        }
    };

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
        // Validação de senha fraca antes de salvar
        if (editPassword && passwordScore !== null && passwordScore < 2) {
            addToast({ type: 'warning', title: 'Senha Fraca', description: 'Por favor, escolha uma senha mais forte.' });
            return;
        }

        setIsSaving(true);
        
        const updatePayload = {
            full_name: editName,
            city: editCity,
            news_preferences: newsPrefs
        };

        const hasEmailChanged = editEmail !== user.email;
        const hasPasswordChanged = editPassword.length > 0;

        if (hasEmailChanged) updatePayload.email = editEmail;
        if (hasPasswordChanged) updatePayload.new_password = editPassword;

        if ((hasEmailChanged || hasPasswordChanged) && hasPasswordSet) {
            if (!currentPassword) {
                addToast({ type: 'warning', title: 'Segurança', description: 'Informe sua senha atual para confirmar as mudanças.' });
                setIsSaving(false);
                return;
            }
            updatePayload.current_password = currentPassword;
        }

        const result = await updateUserData(updatePayload);

        if (result.success) {
            addToast({ type: 'success', title: 'Sucesso', description: 'Perfil atualizado!' });
            onClose();
        } else {
            const errorDetail = result?.message || 'Erro ao atualizar perfil.';
            addToast({ type: 'error', title: 'Erro', description: errorDetail });
        }
        setIsSaving(false);
    };

    return (
        <div className={`drawer-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            <div className={`drawer-content ${isOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="drawer-header">
                    <h2>Configurações da Conta</h2>
                    <button className="btn-close-drawer" onClick={onClose}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="drawer-body">
                    <div className="profile-summary">
                        <div className="profile-info">
                            <h3>{user?.full_name || 'Usuário'}</h3>
                            <span className={`badge-provider ${user?.auth_provider}`}>
                                {user?.auth_provider === 'google' && <i className="fa-brands fa-google"></i>}
                                {user?.auth_provider === 'local' && <i className="fa-solid fa-envelope"></i>}
                                {user?.auth_provider} account
                            </span>
                        </div>
                    </div>

                    <div className="drawer-form">
                        <div className="form-section-title">Informações Pessoais</div>
                        
                        <div className="form-row">
                            <div className="form-group" style={{flex: 1}}>
                                <label>Nome de Exibição</label>
                                <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Cidade (Para Clima e Notícias Locais)</label>
                            <CitySelector 
                                value={editCity} 
                                onChange={(val) => setEditCity(val)} 
                            />
                        </div>

                        <div className="form-group">
                            <label>Interesses de Notícias</label>
                            <div className="tags-container">
                                {availableTopics.map(topic => (
                                    <span 
                                        key={topic.id}
                                        className={`tag-option ${newsPrefs.includes(topic.id) ? 'selected' : ''}`}
                                        onClick={() => handleTopicToggle(topic.id)}
                                    >
                                        {topic.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="form-section-title">Segurança e Acesso</div>
                        
                        <div className="form-group">
                            <label>E-mail Principal</label>
                            <input 
                                className="form-input" 
                                type="email" 
                                value={editEmail} 
                                onChange={e => setEditEmail(e.target.value)}
                                disabled={isGoogleOnly}
                                title={isGoogleOnly ? "E-mail gerenciado pelo Google" : ""}
                            />
                            {isGoogleOnly && <small className="input-hint">Gerenciado pelo Google.</small>}
                        </div>

                        <div className="security-box">
                            {!hasPasswordSet ? (
                                <div className="no-password-alert">
                                    <i className="fa-solid fa-shield-halved"></i>
                                    <p>Você acessa via Google. Defina uma senha abaixo se quiser habilitar login por e-mail também.</p>
                                </div>
                            ) : (
                                (editEmail !== user?.email || editPassword) && (
                                    <div className="form-group confirm-password-group">
                                        <label>Senha Atual (Para confirmar alterações)</label>
                                        <input 
                                            className="form-input" 
                                            type="password" 
                                            value={currentPassword} 
                                            onChange={e => setCurrentPassword(e.target.value)} 
                                        />
                                    </div>
                                )
                            )}

                            <div className="form-group">
                                <label>{hasPasswordSet ? "Nova Senha" : "Criar Senha Local"}</label>
                                <input 
                                    className="form-input" 
                                    type="password" 
                                    placeholder={hasPasswordSet ? "Deixe vazio para manter a atual" : "Crie uma senha segura"} 
                                    value={editPassword} 
                                    onChange={handlePasswordChange} 
                                />
                                
                                {/* BARRA DE FORÇA DA SENHA */}
                                {editPassword && (
                                    <div className="drawer-password-strength">
                                        <div className="strength-bar-bg">
                                            <div 
                                                className="strength-bar-fill" 
                                                style={{ 
                                                    width: `${(passwordScore + 1) * 20}%`,
                                                    backgroundColor: getStrengthColor() 
                                                }}
                                            ></div>
                                        </div>
                                        <span className="strength-text" style={{ color: getStrengthColor() }}>
                                            {passwordFeedback}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="drawer-footer">
                    <button className="btn-primary full-width large-btn" onClick={handleSaveAccount} disabled={isSaving}>
                        {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
}