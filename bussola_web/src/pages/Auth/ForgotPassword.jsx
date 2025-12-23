import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordRecovery } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './styles.css';

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false); // Controla se já enviou para mostrar mensagem de sucesso
    
    const { addToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await requestPasswordRecovery(email);
            setSent(true);
            addToast({
                type: 'success',
                title: 'E-mail enviado',
                description: 'Verifique sua caixa de entrada (e spam) para redefinir a senha.'
            });
        } catch (error) {
            console.error(error);
            addToast({
                type: 'error',
                title: 'Erro ao solicitar',
                description: 'Não foi possível enviar o e-mail. Tente novamente.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h2>Recuperar Senha</h2>
                    <p>Digite seu e-mail para receber as instruções.</p>
                </div>

                {!sent ? (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="email">E-mail Cadastrado</label>
                            <input 
                                type="email" 
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="exemplo@email.com"
                                className="form-input"
                            />
                        </div>

                        <button type="submit" className="btn-primary full-width" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                        </button>
                    </form>
                ) : (
                    <div className="auth-success-message">
                        <i className="fas fa-envelope-open-text" style={{ fontSize: '3rem', color: '#4F46E5', marginBottom: '1rem' }}></i>
                        <h3>Verifique seu E-mail!</h3>
                        <p>Enviamos um link de recuperação para <strong>{email}</strong>.</p>
                        <p className="text-muted">O link expira em 15 minutos.</p>
                    </div>
                )}

                <div className="auth-footer">
                    <Link to="/login" className="link-secondary">
                        <i className="fas fa-arrow-left"></i> Voltar para Login
                    </Link>
                </div>
            </div>
        </div>
    );
}