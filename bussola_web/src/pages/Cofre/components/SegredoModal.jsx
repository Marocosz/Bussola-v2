import React, { useState, useEffect } from 'react';
import { createSegredo, updateSegredo } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext'; // Importar Confirm
import { BaseModal } from '../../../components/BaseModal';

export function SegredoModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    const confirm = useConfirm(); // Hook de segurança
    
    const [titulo, setTitulo] = useState('');
    const [servico, setServico] = useState('');
    const [valor, setValor] = useState('');
    const [diasExpirar, setDiasExpirar] = useState('');
    const [notas, setNotas] = useState('');
    
    const [showPassword, setShowPassword] = useState(false);
    
    // Controle de Edição de Senha
    // Se for criar (editingData null), é editável (true). Se for editar, começa travado (false).
    const [isPasswordEditable, setIsPasswordEditable] = useState(false);

    useEffect(() => {
        if (active) {
            if (editingData) {
                setTitulo(editingData.titulo);
                setServico(editingData.servico || '');
                setNotas(editingData.notas || '');
                setValor(''); 
                setDiasExpirar('');
                setIsPasswordEditable(false); // Trava a senha na edição
            } else {
                setTitulo('');
                setServico('');
                setValor('');
                setDiasExpirar('');
                setNotas('');
                setIsPasswordEditable(true); // Destrava na criação
            }
            setShowPassword(false);
        }
    }, [active, editingData]);

    if (!active) return null;

    // Função de Segurança para Destravar a Senha
    const handleUnlockPassword = async () => {
        const isConfirmed = await confirm({
            title: 'Alterar Senha?',
            description: 'Você está prestes a redefinir a credencial deste segredo. Deseja continuar?',
            confirmLabel: 'Sim, permitir edição',
            variant: 'warning'
        });

        if (isConfirmed) {
            setIsPasswordEditable(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let data_expiracao = null;
        if (diasExpirar && parseInt(diasExpirar) > 0) {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(diasExpirar));
            data_expiracao = date.toISOString().split('T')[0];
        }

        const payload = { titulo, servico, notas, data_expiracao };
        
        // Só envia o valor se estiver editável e preenchido
        if (isPasswordEditable && valor) {
            payload.valor = valor;
        }

        try {
            if (editingData) {
                await updateSegredo(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Segredo atualizado.'});
            } else {
                if (!valor) return addToast({type:'warning', title:'Atenção', description:'A senha é obrigatória.'});
                await createSegredo(payload);
                addToast({type:'success', title:'Guardado', description:'Novo segredo salvo.'});
            }
            onUpdate();
            closeModal();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    return (
        <BaseModal onClose={closeModal} className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Segredo' : 'Guardar Novo Segredo'}</h3>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Título</label>
                                <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} required autoFocus />
                            </div>
                            <div className="form-group">
                                <label>Serviço (Opcional)</label>
                                <input className="form-input" value={servico} onChange={e => setServico(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Valor da Chave / Senha</label>
                            
                            {!isPasswordEditable ? (
                                // Estado Travado (Edição)
                                <div className="locked-input-wrapper" onClick={handleUnlockPassword}>
                                    <div className="fake-input-locked">
                                        <i className="fa-solid fa-lock"></i>
                                        <span>Senha oculta. Clique para redefinir.</span>
                                    </div>
                                    <button type="button" className="btn-secondary small">
                                        Alterar
                                    </button>
                                </div>
                            ) : (
                                // Estado Editável (Criação ou Destravado)
                                <div className="secret-input-wrapper" style={{display:'flex', gap:'10px'}}>
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        className="form-input" 
                                        value={valor} 
                                        onChange={e => setValor(e.target.value)} 
                                        placeholder={editingData ? "Digite a nova senha..." : "Cole a chave aqui..."}
                                        required={!editingData} // Obrigatório apenas na criação
                                    />
                                    <button type="button" className="btn-action-icon" onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Ocultar" : "Mostrar"}>
                                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Expira em (dias) - Opcional</label>
                                <input type="number" className="form-input" placeholder="Ex: 30" value={diasExpirar} onChange={e => setDiasExpirar(e.target.value)} min="0" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notas (Opcional)</label>
                            <textarea className="form-input" rows="2" value={notas} onChange={e => setNotas(e.target.value)}></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}