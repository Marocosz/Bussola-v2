import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordRecovery } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import './styles.css';

export function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false); // Controla se já enviou para mostrar mensagem de sucesso
    const [isLocalMode, setIsLocalMode] = useState(false); // [NOVO] Estado para identificar modo local
    
    const { addToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await requestPasswordRecovery(email);
            
            // [NOVO] Verifica se o retorno indica modo local sem e-mail
            if (response.msg === "SISTEMA_LOCAL_SEM_EMAIL") {
                setIsLocalMode(true);
                setSent(true);
                addToast({
                    type: 'info',
                    title: 'Modo Local',
                    description: 'O link de recuperação foi gerado no console do administrador.',
                    duration: 8000
                });
            } else {
                setSent(true);
                setIsLocalMode(false);
                addToast({
                    type: 'success',
                    title: 'E-mail enviado',
                    description: 'Verifique sua caixa de entrada (e spam) para redefinir a senha.'
                });
            }
        } catch (error) {
            console.error(error);
            addToast({
                type: 'error',
                title: 'Erro ao solicitar',
                description: 'Não foi possível processar a solicitação. Tente novamente.'
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
                        {isLocalMode ? (
                            <>
                                <i className="fas fa-terminal" style={{ fontSize: '3rem', color: 'var(--cor-azul-primario)', marginBottom: '1rem' }}></i>
                                <h3>Link Gerado no Console!</h3>
                                <p>Este sistema está rodando em <strong>modo local</strong> sem e-mail configurado.</p>
                                <p>O administrador deve fornecer o link de reset impresso no console do servidor.</p>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-envelope-open-text" style={{ fontSize: '3rem', color: '#4F46E5', marginBottom: '1rem' }}></i>
                                <h3>Verifique seu E-mail!</h3>
                                <p>Enviamos um link de recuperação para <strong>{email}</strong>.</p>
                                <p className="text-muted">O link expira em 15 minutos.</p>
                            </>
                        )}
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