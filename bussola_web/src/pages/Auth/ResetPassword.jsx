import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import zxcvbn from 'zxcvbn';
import '../Login/styles.css'; // Usando o mesmo CSS global de auth

export function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Estado força senha
    const [passwordScore, setPasswordScore] = useState(null);
    const [passwordFeedback, setPasswordFeedback] = useState('');

    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const navigate = useNavigate();
    const { addToast } = useToast();

    useEffect(() => {
        if (!token) {
            addToast({ type: 'error', title: 'Link Inválido', description: 'Token de recuperação não encontrado.' });
            navigate('/login');
        }
    }, [token, navigate, addToast]);

    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setPassword(val);
        if (val) {
            const result = zxcvbn(val);
            setPasswordScore(result.score);
            const messages = ["Muito fraca", "Fraca", "Média", "Forte", "Muito Forte"];
            setPasswordFeedback(messages[result.score]);
        } else {
            setPasswordScore(null);
            setPasswordFeedback('');
        }
    };

    const getStrengthColor = () => {
        switch (passwordScore) {
            case 0: return '#ef4444';
            case 1: return '#f97316';
            case 2: return '#eab308';
            case 3: return '#84cc16';
            case 4: return '#10b981';
            default: return '#e5e7eb';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            addToast({ type: 'warning', title: 'Senhas não conferem', description: 'Por favor, digite a mesma senha nos dois campos.' });
            return;
        }

        if (passwordScore !== null && passwordScore < 2) {
            addToast({ type: 'warning', title: 'Senha Fraca', description: 'A senha é muito fácil de adivinhar.' });
            return;
        }

        setLoading(true);

        try {
            await resetPassword(token, password);
            
            addToast({
                type: 'success',
                title: 'Sucesso!',
                description: 'Sua senha foi alterada. Faça login agora.'
            });
            
            navigate('/login');

        } catch (error) {
            console.error(error);
            addToast({
                type: 'error',
                title: 'Erro ao alterar',
                description: error.response?.data?.detail || 'Link expirado ou inválido. Solicite novamente.'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!token) return null;

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h2>Nova Senha</h2>
                    <p>Crie uma nova senha segura para sua conta.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Nova Senha</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={handlePasswordChange}
                            required
                            placeholder="******"
                            className="form-input"
                        />
                        {/* BARRA DE FORÇA */}
                        {password && (
                            <div className="password-strength-container">
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

                    <div className="form-group">
                        <label>Confirmar Senha</label>
                        <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="******"
                            className="form-input"
                        />
                    </div>

                    <button type="submit" className="btn-primary full-width" disabled={loading}>
                        {loading ? 'Salvando...' : 'Redefinir Senha'}
                    </button>
                </form>
            </div>
        </div>
    );
}