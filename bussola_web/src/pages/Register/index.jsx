import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { registerUser } from '../../services/api'; 
import { useNavigate, Link, Navigate } from 'react-router-dom';
import zxcvbn from 'zxcvbn'; // Biblioteca de força de senha

import '../Login/styles.css'; 
import loginImageLight from '../../assets/images/loginimage1.svg';
import loginImageDark from '../../assets/images/loginimage1-dark.svg';
import logoBussola from '../../assets/images/bussola.svg';

export function Register() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Estado para força da senha
    const [passwordScore, setPasswordScore] = useState(null);
    const [passwordFeedback, setPasswordFeedback] = useState('');

    const { addToast } = useToast();
    const { canRegister, loading: systemLoading, isSelfHosted } = useSystem();
    const navigate = useNavigate();

    if (systemLoading) return <div className="loading-screen">Carregando...</div>;

    if (!canRegister) return <Navigate to="/login" />;

    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setPassword(val);
        if (val) {
            const result = zxcvbn(val);
            setPasswordScore(result.score); // 0 a 4
            // Tradução simples do feedback
            const messages = [
                "Muito fraca (Use frases ou palavras aleatórias)",
                "Fraca (Adicione números e símbolos)",
                "Média (Pode melhorar)",
                "Forte",
                "Muito Forte"
            ];
            setPasswordFeedback(messages[result.score]);
        } else {
            setPasswordScore(null);
            setPasswordFeedback('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            addToast({ type: 'warning', title: 'Atenção', description: 'As senhas não coincidem.' });
            return;
        }

        if (passwordScore !== null && passwordScore < 2) {
            addToast({ type: 'warning', title: 'Senha Fraca', description: 'Por favor, crie uma senha mais forte para sua segurança.' });
            return;
        }

        setLoading(true);

        try {
            await registerUser({
                email,
                password,
                full_name: fullName
            });

            if (isSelfHosted) {
                addToast({
                    type: 'success',
                    title: 'Sucesso!',
                    description: 'Sua conta foi criada. Você já pode fazer login.'
                });
                navigate('/login');
            } else {
                navigate('/register-success');
            }

        } catch (error) {
            console.error(error);
            const msg = error?.response?.data?.detail || 'Não foi possível criar a conta. Tente outro e-mail.';
            addToast({ type: 'error', title: 'Erro no Registro', description: msg });
        } finally {
            setLoading(false);
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
                                onChange={handlePasswordChange}
                                required
                                placeholder="Crie uma senha forte"
                            />
                            
                            {/* BARRA DE FORÇA DA SENHA */}
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
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repita a senha"
                            />
                        </div>

                        {/* DICA DE SEGURANÇA */}
                        <div className="security-tip-box">
                            <i className="fas fa-lock"></i>
                            <p>
                                <strong>Dica de Segurança:</strong> Use frases longas (ex: "Cavalo-Azul-Corre-Rapido") ou misture letras, números e símbolos. Evite datas de nascimento.
                            </p>
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