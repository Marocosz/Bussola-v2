import React, { useState, useEffect } from 'react';
import { getSegredoValor } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';

export function ViewSecretModal({ segredoId, onClose, titulo }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [decryptedValue, setDecryptedValue] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);

    // Busca a senha ao abrir o modal
    useEffect(() => {
        if (segredoId) {
            fetchSecret();
        }
    }, [segredoId]);

    // Timer para limpar clipboard
    useEffect(() => {
        let interval = null;
        if (timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            navigator.clipboard.writeText('');
            addToast({ type: 'info', title: 'Segurança', description: 'Área de transferência limpa.' });
            setTimeLeft(null);
        }
        return () => clearInterval(interval);
    }, [timeLeft]);

    const fetchSecret = async () => {
        try {
            setLoading(true);
            const res = await getSegredoValor(segredoId);
            if (res.valor) {
                setDecryptedValue(res.valor);
            }
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível decifrar o segredo.' });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!decryptedValue) return;
        await navigator.clipboard.writeText(decryptedValue);
        setTimeLeft(60); // 60 segundos
        addToast({ type: 'success', title: 'Copiado', description: 'Limpeza automática em 60s.' });
    };

    return (
        <BaseModal onClose={onClose} className="modal view-secret-modal">
            <div className="modal-content" style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h3>Visualizar: {titulo}</h3>
                    <span className="close-btn" onClick={onClose}>&times;</span>
                </div>
                
                <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
                    {loading ? (
                        <div style={{ color: 'var(--cor-texto-secundario)' }}>
                            <i className="fa-solid fa-circle-notch fa-spin"></i> Descriptografando...
                        </div>
                    ) : (
                        <div className="secret-display-box">
                            <div className="secret-field">
                                <span className={isVisible ? 'text-visible' : 'text-masked'}>
                                    {isVisible ? decryptedValue : '•'.repeat(24)}
                                </span>
                            </div>
                            
                            <div className="secret-actions">
                                <button className="btn-secondary" onClick={() => setIsVisible(!isVisible)}>
                                    <i className={`fa-solid ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    {isVisible ? 'Ocultar' : 'Revelar'}
                                </button>
                                
                                <button className="btn-primary" onClick={handleCopy}>
                                    <i className="fa-regular fa-copy"></i>
                                    {timeLeft ? `Copiado (${timeLeft}s)` : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--cor-texto-secundario)' }}>
                        <i className="fa-solid fa-shield-halved"></i> Esta janela deve ser fechada após o uso.
                    </p>
                </div>
            </div>
        </BaseModal>
    );
}