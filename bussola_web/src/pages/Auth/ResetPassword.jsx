import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './styles.css';

export function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Hooks para pegar o token da URL (?token=...)
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const navigate = useNavigate();
    const { addToast } = useToast();

    // Redireciona se tentar entrar na tela sem token
    useEffect(() => {
        if (!token) {
            addToast({ type: 'error', title: 'Link Inválido', description: 'Token de recuperação não encontrado.' });
            navigate('/login');
        }
    }, [token, navigate, addToast]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            addToast({ type: 'warning', title: 'Senhas não conferem', description: 'Por favor, digite a mesma senha nos dois campos.' });
            return;
        }

        if (password.length < 6) {
            addToast({ type: 'warning', title: 'Senha muito curta', description: 'A senha deve ter no mínimo 6 caracteres.' });
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

    if (!token) return null; // Evita piscar a tela antes do redirect

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
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="******"
                            className="form-input"
                            minLength={6}
                        />
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
                            minLength={6}
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