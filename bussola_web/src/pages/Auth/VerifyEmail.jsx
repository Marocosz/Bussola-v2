import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyUserEmail } from '../../services/api'; // Importa a função que criamos no api.ts
import { useToast } from '../../context/ToastContext';

// Importe o logo para manter a identidade visual
import logoBussola from '../../assets/images/bussola.svg';

export function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    // Estados da tela
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Validando sua conta...');

    // Pega os parâmetros da URL: ?token=XYZ&email=abc@test.com
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    useEffect(() => {
        // 1. Validação inicial: se não tiver token na URL, é erro na certa.
        if (!token || !email) {
            setStatus('error');
            setMessage('Link de verificação inválido ou incompleto.');
            return;
        }

        // 2. Função assíncrona para chamar o backend
        const verify = async () => {
            try {
                await verifyUserEmail(token, email);
                
                setStatus('success');
                setMessage('E-mail verificado com sucesso!');
                
                // Feedback visual flutuante também
                addToast({
                    type: 'success',
                    title: 'Verificado!',
                    description: 'Sua conta foi ativada. Redirecionando...'
                });

                // 3. Redireciona para o login após 3 segundos
                setTimeout(() => {
                    navigate('/login');
                }, 3000);

            } catch (error) {
                setStatus('error');
                console.error(error);
                
                // Tenta pegar a mensagem de erro específica do backend
                const errorMsg = error?.response?.data?.detail || 'Não foi possível verificar o e-mail.';
                setMessage(errorMsg);

                addToast({
                    type: 'error',
                    title: 'Falha',
                    description: errorMsg
                });
            }
        };

        // Executa a verificação assim que a tela monta
        verify();

    }, [token, email, navigate, addToast]);

    // --- RENDERIZAÇÃO DA TELA ---
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: 'var(--cor-fundo-principal)', // Usa suas variáveis de tema
            color: 'var(--cor-texto-principal)',
            padding: '20px',
            textAlign: 'center'
        }}>
            <div style={{
                background: 'var(--cor-fundo-card)',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                maxWidth: '450px',
                width: '100%',
                border: '1px solid var(--cor-borda-suave, #e5e7eb)'
            }}>
                <img 
                    src={logoBussola} 
                    alt="Logo Bússola" 
                    style={{ height: '60px', marginBottom: '25px' }} 
                />
                
                <h2 style={{ marginBottom: '15px', fontSize: '1.5rem' }}>Verificação de Conta</h2>
                
                <div style={{ margin: '20px 0', fontSize: '1.1rem', minHeight: '80px' }}>
                    
                    {/* ESTADO: CARREGANDO */}
                    {status === 'loading' && (
                        <div style={{ color: 'var(--cor-texto-secundario)' }}>
                            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '15px', color: 'var(--cor-azul-primario)' }}></i>
                            <p>{message}</p>
                        </div>
                    )}
                    
                    {/* ESTADO: SUCESSO */}
                    {status === 'success' && (
                        <div style={{ animation: 'fadeIn 0.5s ease' }}>
                            <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: '#10B981', marginBottom: '15px' }}></i>
                            <p style={{ color: '#10B981', fontWeight: 'bold' }}>{message}</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '10px', color: 'var(--cor-texto-secundario)' }}>
                                Você será redirecionado para o login em instantes...
                            </p>
                        </div>
                    )}
                    
                    {/* ESTADO: ERRO */}
                    {status === 'error' && (
                        <div style={{ animation: 'shake 0.5s ease' }}>
                            <i className="fas fa-times-circle" style={{ fontSize: '3rem', color: '#EF4444', marginBottom: '15px' }}></i>
                            <p style={{ color: '#EF4444', fontWeight: 'bold' }}>{message}</p>
                            
                            <button 
                                onClick={() => navigate('/login')}
                                className="btn-primary" // Classe CSS global do seu projeto
                                style={{ 
                                    marginTop: '25px', 
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'var(--cor-azul-primario)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Voltar para o Login
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}