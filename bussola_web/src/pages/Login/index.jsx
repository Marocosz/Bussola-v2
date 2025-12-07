import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext'; // <--- Importação do Hook de Toast
import { useNavigate } from 'react-router-dom';
import './styles.css'; 

// Importando imagens (no Vite, importamos imagens como módulos)
import loginImageLight from '../../assets/images/loginimage1.svg';
import loginImageDark from '../../assets/images/loginimage1-dark.svg';
import logoBussola from '../../assets/images/bussola.svg';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const { login } = useContext(AuthContext);
    const { addToast } = useToast(); // <--- Uso do Hook
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const result = await login(email, password);
            
            if (result.success) {
                // Toast de Sucesso
                addToast({
                    type: 'success',
                    title: 'Bem-vindo(a)!',
                    description: 'Login realizado com sucesso.'
                });
                navigate('/home');
            } else {
                // Toast de Erro (substituindo o alert)
                addToast({
                    type: 'error',
                    title: 'Falha no Login',
                    description: result.message || 'Verifique suas credenciais.'
                });
            }
        } catch (error) {
            // Proteção extra caso ocorra erro de rede inesperado
            addToast({
                type: 'error',
                title: 'Erro inesperado',
                description: 'Não foi possível conectar ao servidor.'
            });
        }
    };

    return (
        <div className="auth-container">
            {/* Coluna da Esquerda: Introdução */}
            <div className="auth-intro">
                <div className="auth-intro-header">
                    <h1>Encontre o seu Norte</h1>
                </div>
                <p>
                    Em um mundo de informações e distrações, o Bússola é o seu ponto de referência. 
                    Centralize sua vida financeira, seus planos e seus pensamentos em um só lugar.
                </p>
                
                {/* Imagens de Tema (Lógica de troca via CSS classes) */}
                <img src={loginImageLight} alt="Ilustração Light" className="auth-intro-image theme-image image-light-mode" />
                <img src={loginImageDark} alt="Ilustração Dark" className="auth-intro-image theme-image image-dark-mode" />
            </div>

            {/* Coluna da Direita: Card de Login */}
            <div className="auth-card">
                <div className="auth-card-header">
                    <img src={logoBussola} alt="Logo Bússola" className="auth-logo-card" />
                    <h2>Entrar no Bússola</h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Nome de Usuário</label>
                        <input 
                            type="text" 
                            id="username" 
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                            autoComplete="off"
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
                            autoComplete="off"
                        />
                    </div>
                    <button type="submit" className="btn-primary">Entrar</button>
                </form>
            </div>
        </div>
    );
}