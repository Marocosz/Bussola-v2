import React, { useState } from 'react';
import { createSegredo, updateSegredo } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext'; // Importar Confirm
import { BaseModal } from '../../../components/BaseModal';
import { useMediaQuery } from '../../../hooks/useIsMobile';

// Campos que o teclado do celular não deve corrigir nem capitalizar.
const SEM_CORRECAO = { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false };

export function SegredoModal({ active, closeModal, onUpdate, editingData }) {
    const { addToast } = useToast();
    const confirm = useConfirm(); // Hook de segurança
    // No toque o autofocus abriria o teclado sozinho e cobriria metade do sheet.
    const isTouch = useMediaQuery('(pointer: coarse)');

    const [titulo, setTitulo] = useState('');
    const [servico, setServico] = useState('');
    const [valor, setValor] = useState('');
    const [diasExpirar, setDiasExpirar] = useState('');
    const [notas, setNotas] = useState('');
    
    const [showPassword, setShowPassword] = useState(false);
    
    // Controle de Edição de Senha
    // Se for criar (editingData null), é editável (true). Se for editar, começa travado (false).
    const [isPasswordEditable, setIsPasswordEditable] = useState(false);

    // Reinicia o formulário ao abrir (ou ao trocar o item em edição): ajuste no render, sem efeito.
    const chave = active ? (editingData ? `editar-${editingData.id}` : 'novo') : null;
    const [chaveAnterior, setChaveAnterior] = useState(null);
    if (chave !== chaveAnterior) {
        setChaveAnterior(chave);
        if (chave) {
            setTitulo(editingData ? editingData.titulo : '');
            setServico(editingData?.servico || '');
            setNotas(editingData?.notas || '');
            setValor('');
            setDiasExpirar('');
            setIsPasswordEditable(!editingData); // Trava a senha na edição, destrava na criação
            setShowPassword(false);
        }
    }

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

        // Só envia o valor se estiver editável e preenchido. O schema de update exige a chave
        // `valor` (Optional sem default = obrigatório), então sem troca vai explicitamente null
        // (o serviço ignora null) — antes, editar sem mexer na senha dava 422.
        const payload = { titulo, servico, notas, data_expiracao, valor: isPasswordEditable && valor ? valor : null };

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
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Segredo' : 'Guardar Novo Segredo'}</h3>
                    <button type="button" className="close-btn" onClick={closeModal} aria-label="Fechar">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="segredo-titulo">Título</label>
                                <input id="segredo-titulo" className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} required autoFocus={!isTouch} autoComplete="off" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="segredo-servico">Serviço (Opcional)</label>
                                <input id="segredo-servico" className="form-input" value={servico} onChange={e => setServico(e.target.value)} autoComplete="off" {...SEM_CORRECAO} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="segredo-valor">Valor da Chave / Senha</label>
                            
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
                                        id="segredo-valor"
                                        type={showPassword ? "text" : "password"}
                                        className="form-input" 
                                        value={valor} 
                                        onChange={e => setValor(e.target.value)} 
                                        placeholder={editingData ? "Digite a nova senha..." : "Cole a chave aqui..."}
                                        required={!editingData} // Obrigatório apenas na criação
                                        autoComplete="new-password"
                                        {...SEM_CORRECAO}
                                    />
                                    <button type="button" className="btn-action-icon" onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Ocultar" : "Mostrar"} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="segredo-dias">Expira em (dias) - Opcional</label>
                                <input id="segredo-dias" type="number" inputMode="numeric" pattern="[0-9]*" className="form-input" placeholder="Ex: 30" value={diasExpirar} onChange={e => setDiasExpirar(e.target.value)} min="0" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="segredo-notas">Notas (Opcional)</label>
                            <textarea id="segredo-notas" className="form-input" rows="2" value={notas} onChange={e => setNotas(e.target.value)}></textarea>
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