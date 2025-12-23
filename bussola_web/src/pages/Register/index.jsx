import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { registerUser } from '../../services/api'; 
import { useNavigate, Link, Navigate } from 'react-router-dom';

import '../Login/styles.css'; // Reutiliza estilo do Login
import loginImageLight from '../../assets/images/loginimage1.svg';
import loginImageDark from '../../assets/images/loginimage1-dark.svg';
import logoBussola from '../../assets/images/bussola.svg';

export function Register() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { addToast } = useToast();
    const { canRegister, loading: systemLoading } = useSystem();
    const navigate = useNavigate();

    if (systemLoading) return <div className="loading-screen">Carregando...</div>;

    // Se registro fechado, volta pro login
    if (!canRegister) return <Navigate to="/login" />;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            addToast({ type: 'warning', title: 'Atenção', description: 'As senhas não coincidem.' });
            return;
        }

        if (password.length < 6) {
            addToast({ type: 'warning', title: 'Senha Curta', description: 'A senha deve ter pelo menos 6 caracteres.' });
            return;
        }

        setLoading(true);

        try {
            await registerUser({
                email,
                password,
                full_name: fullName
            });

            // [ALTERADO] Redireciona para a página de sucesso completa em vez de voltar ao login
            navigate('/register-success');

        } catch (error) {
            console.error(error);
            const msg = (error).response?.data?.detail || 'Não foi possível criar a conta. Tente outro e-mail.';
            addToast({ type: 'error', title: 'Erro no Registro', description: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-intro">
                    <div className="auth-intro-header">
                        <h1>Comece sua Jornada</h1>
                    </div>
                    <p>
                        Junte-se ao Bússola e transforme a maneira como você organiza sua vida financeira e pessoal.
                    </p>
                    <img src={loginImageLight} alt="Ilustração Light" className="auth-intro-image theme-image image-light-mode" />
                    <img src={loginImageDark} alt="Ilustração Dark" className="auth-intro-image theme-image image-dark-mode" />
                </div>

                <div className="auth-card">
                    <div className="auth-card-header">
                        <img src={logoBussola} alt="Logo Bússola" className="auth-logo-card" />
                        <h2>Crie sua Conta</h2>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Nome Completo</label>
                            <input
                                type="text"
                                className="form-input"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                placeholder="Seu Nome"
                            />
                        </div>

                        <div className="form-group">
                            <label>E-mail</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div className="form-group">
                            <label>Senha</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirmar Senha</label>
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repita a senha"
                            />
                        </div>

                        <button type="submit" className="submit-button" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
                            {loading ? 'Criando...' : 'Cadastrar'}
                        </button>

                        <div className="auth-actions" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--cor-texto-secundario)' }}>
                                Já tem uma conta?{' '}
                                <Link to="/login" style={{ color: 'var(--cor-azul-primario)', fontWeight: 'bold', textDecoration: 'none' }}>
                                    Fazer Login
                                </Link>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}