import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google'; // Importando Hook Google

import './styles.css';

import loginImageLight from '../../assets/images/loginimage1.svg';
import loginImageDark from '../../assets/images/loginimage1-dark.svg';
import logoBussola from '../../assets/images/bussola.svg';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Contexto de Autenticação
    const { login, loginGoogle } = useContext(AuthContext); 
    const { addToast } = useToast();

    // Contexto de Sistema (Flags de configuração)
    const { canRegister, isSaaS, loading: systemLoading } = useSystem();

    const navigate = useNavigate();

    // --- LÓGICA DO LOGIN GOOGLE ---
    const handleGoogleClick = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true);
            try {
                // Chama a função do Contexto que chama a API
                const result = await loginGoogle(tokenResponse.access_token);

                if (result.success) {
                    addToast({ type: 'success', title: 'Login com Google', description: 'Bem-vindo de volta!' });
                    navigate('/home');
                } else {
                    addToast({ type: 'error', title: 'Falha', description: 'Não foi possível autenticar com o Google.' });
                }
            } catch (error) {
                console.error(error);
                addToast({ type: 'error', title: 'Erro', description: 'Erro na comunicação com o Google.' });
            } finally {
                setLoading(false);
            }
        },
        onError: () => {
            addToast({ type: 'error', title: 'Erro', description: 'O login com Google foi cancelado.' });
        }
    });

    // --- LÓGICA DO LOGIN LOCAL ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await login(email, password);

            if (result.success) {
                addToast({ type: 'success', title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
                navigate('/home');
            } else {
                // Tratamento específico para conta não verificada (Backend retorna 401 com mensagem)
                const errorMsg = result.message || 'Credenciais inválidas.';
                
                if (errorMsg.includes("verificado") || errorMsg.includes("e-mail")) {
                    addToast({ type: 'warning', title: 'E-mail não verificado', description: errorMsg });
                } else {
                    addToast({ type: 'error', title: 'Falha no Login', description: errorMsg });
                }
            }
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Servidor indisponível no momento.' });
        } finally {
            setLoading(false);
        }
    };

    if (systemLoading) {
        return <div className="loading-screen">Iniciando Bússola...</div>;
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-intro">
                    <div className="auth-intro-header">
                        <h1>Encontre o seu Norte</h1>
                    </div>
                    <p>
                        Em um mundo de informações e distrações, o Bússola é o seu ponto de referência.
                        Centralize sua vida financeira, seus planos e seus pensamentos em um só lugar.
                    </p>
                    <img src={loginImageLight} alt="Ilustração Light" className="auth-intro-image theme-image image-light-mode" />
                    <img src={loginImageDark} alt="Ilustração Dark" className="auth-intro-image theme-image image-dark-mode" />
                </div>

                <div className="auth-card">
                    <div className="auth-card-header">
                        <img src={logoBussola} alt="Logo Bússola" className="auth-logo-card" />
                        <h2>Entrar no Bússola</h2>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="username">E-mail</label>
                            <input
                                type="text"
                                id="username"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="seu@email.com"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Senha</label>
                            <input
                                type="password"
                                id="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="forgot-password-link" style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                            <Link to="/forgot-password" style={{ fontSize: '0.9rem', color: '#aaa', textDecoration: 'none' }}>
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>

                        <div className="auth-actions" style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            
                            {/* BOTÃO GOOGLE (Habilitado se for SaaS ou Configurado) */}
                            {isSaaS && (
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    onClick={() => handleGoogleClick()}
                                    disabled={loading}
                                >
                                    <i className="fa-brands fa-google"></i>
                                    Entrar com Google
                                </button>
                            )}

                            {/* LINK CADASTRO */}
                            {(isSaaS || canRegister) ? (
                                <div style={{ fontSize: '0.9rem', color: 'var(--cor-texto-secundario)' }}>
                                    Não tem uma conta?{' '}
                                    <Link to="/register" style={{ color: 'var(--cor-azul-primario)', fontWeight: 'bold', textDecoration: 'none' }}>
                                        Crie agora
                                    </Link>
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-terciario)', fontStyle: 'italic' }}>
                                    Cadastro fechado para novos usuários.
                                </div>
                            )}

                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}