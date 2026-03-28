import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import logoBussola from '../../assets/images/bussola.svg';

export function DiscordLink() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const initialized = useRef(false);

    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Vinculando sua conta...');

    const token = searchParams.get('token');

    useEffect(() => {
        if (initialized.current) return;

        if (!token) {
            setStatus('error');
            setMessage('Link inválido. Gere um novo link pelo Discord usando /link.');
            return;
        }

        initialized.current = true;

        const confirm = async () => {
            try {
                await api.post('/discord/link/confirm', { token });

                setStatus('success');
                setMessage('Conta vinculada com sucesso!');

                addToast({
                    type: 'success',
                    title: 'Discord vinculado!',
                    description: 'Você já pode usar o Bússola Bot no Discord.',
                });

                setTimeout(() => navigate('/home'), 3000);
            } catch (error) {
                setStatus('error');
                const errorMsg =
                    error?.response?.data?.detail ||
                    'Não foi possível vincular a conta.';
                setMessage(errorMsg);

                addToast({ type: 'error', title: 'Falha', description: errorMsg });
            }
        };

        confirm();
    }, [token, navigate, addToast]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: 'var(--cor-fundo-principal)',
            color: 'var(--cor-texto-principal)',
            padding: '20px',
            textAlign: 'center',
        }}>
            <div style={{
                background: 'var(--cor-fundo-card)',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                maxWidth: '450px',
                width: '100%',
                border: '1px solid var(--cor-borda-suave, #e5e7eb)',
            }}>
                <img
                    src={logoBussola}
                    alt="Logo Bússola"
                    style={{ height: '60px', marginBottom: '25px' }}
                />

                <h2 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>
                    Vincular Discord
                </h2>
                <p style={{ color: 'var(--cor-texto-secundario)', marginBottom: '25px', fontSize: '0.95rem' }}>
                    Conectando sua conta Bússola ao Discord Bot
                </p>

                <div style={{ minHeight: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

                    {status === 'loading' && (
                        <div style={{ color: 'var(--cor-texto-secundario)' }}>
                            <i className="fas fa-circle-notch fa-spin"
                               style={{ fontSize: '2.5rem', marginBottom: '15px', color: 'var(--cor-azul-primario)' }} />
                            <p>{message}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div>
                            <i className="fas fa-check-circle"
                               style={{ fontSize: '3rem', color: '#10B981', marginBottom: '15px' }} />
                            <p style={{ color: '#10B981', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {message}
                            </p>
                            <p style={{ fontSize: '0.85rem', marginTop: '10px', color: 'var(--cor-texto-secundario)' }}>
                                Redirecionando para o início...
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div>
                            <i className="fas fa-times-circle"
                               style={{ fontSize: '3rem', color: '#EF4444', marginBottom: '15px' }} />
                            <p style={{ color: '#EF4444', fontWeight: 'bold' }}>{message}</p>
                            <button
                                onClick={() => navigate('/home')}
                                style={{
                                    marginTop: '20px',
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'var(--cor-azul-primario)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '0.95rem',
                                }}
                            >
                                Voltar ao Início
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
