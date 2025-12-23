import React, { useState } from 'react';
import { adminCreateUser } from '../services/api';
import { useToast } from '../context/ToastContext';
import { BaseModal } from './BaseModal'; 
import './AdminUserModal.css';

export function AdminUserModal({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { addToast } = useToast();

    // 1. OBRIGATÓRIO: Se fechado, retorna null (para sumir da tela)
    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await adminCreateUser({ email, password, full_name: fullName });
            
            addToast({
                type: 'success',
                title: 'Usuário Criado!',
                description: `A conta para ${fullName} foi criada com sucesso.`
            });
            
            setEmail('');
            setPassword('');
            setFullName('');
            onClose();

        } catch (error) {
            console.error(error);
            addToast({
                type: 'error',
                title: 'Erro ao criar',
                description: error.response?.data?.detail || 'Verifique os dados e tente novamente.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseModal 
            isOpen={isOpen} 
            onClose={onClose}
        >
            {/* [CORREÇÃO] Adicionamos o Wrapper que tem 'position: fixed'
                Isso garante que ele sobreponha a página, independente de onde o BaseModal esteja.
            */}
            <div className="admin-modal-wrapper" onClick={onClose}>
                
                {/* O conteúdo (Cartão) */}
                <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                    
                    <div className="admin-modal-header">
                        <h2>Novo Usuário (Admin)</h2>
                        <button className="admin-modal-close-btn" type="button" onClick={onClose}>&times;</button>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-modal-form">
                        
                        <div className="admin-modal-body">
                            <div className="admin-form-group">
                                <label>Nome Completo</label>
                                <input 
                                    type="text" 
                                    className="admin-form-input"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    required
                                    placeholder="Ex: João Silva"
                                />
                            </div>

                            <div className="admin-form-group">
                                <label>E-mail de Acesso</label>
                                <input 
                                    type="email" 
                                    className="admin-form-input"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="usuario@email.com"
                                />
                            </div>

                            <div className="admin-form-group">
                                <label>Senha Inicial</label>
                                <input 
                                    type="password" 
                                    className="admin-form-input"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder="******"
                                />
                            </div>
                        </div>
                        
                        <div className="admin-modal-footer">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="btn-primary"
                            >
                                {loading ? 'Criando...' : 'Criar Usuário'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </BaseModal>
    );
}