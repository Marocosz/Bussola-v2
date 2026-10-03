import { useNavigate } from 'react-router-dom';
import logoBussola from '../../assets/images/bussola.svg';
import './styles.css';

export function RegisterSuccess() {
    const navigate = useNavigate();

    return (
        <div className="auth-status-page">
            <div className="auth-status-card is-largo">
                <img src={logoBussola} alt="Logo" style={{ height: '70px', marginBottom: '30px' }} />

                <div style={{ marginBottom: '20px' }}>
                    <i className="fas fa-paper-plane" style={{ fontSize: '4rem', color: 'var(--cor-azul-primario)' }}></i>
                </div>

                <h1 style={{ fontSize: '1.8rem', marginBottom: '15px', color: 'var(--cor-texto-principal)' }}>
                    Falta pouco!
                </h1>

                <p style={{ fontSize: '1.1rem', color: 'var(--cor-texto-secundario)', lineHeight: '1.6' }}>
                    Enviamos um link de ativação para o seu e-mail.
                    Por favor, verifique sua <strong>caixa de entrada</strong> (e a pasta de spam) para confirmar seu cadastro.
                </p>

                <div style={{
                    marginTop: '35px',
                    padding: '20px',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: 'var(--cor-texto-secundario)'
                }}>
                    <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                    Você só conseguirá fazer login após clicar no link enviado.
                </div>

                <button
                    onClick={() => navigate('/login')}
                    className="btn-primary"
                    style={{
                        marginTop: '30px',
                        width: '100%',
                        padding: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Voltar para o Login
                </button>
            </div>
        </div>
    );
}
