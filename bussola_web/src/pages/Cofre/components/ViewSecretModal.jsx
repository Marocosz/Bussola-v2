import { useEffect, useRef, useState } from 'react';
import { getSegredoValor } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';
import { escreverClipboard } from '../../../utils/clipboard';

const SEGUNDOS_LIMPEZA = 60;

const TOAST_LIMPO = { type: 'info', title: 'Segurança', description: 'Área de transferência limpa.' };
const TOAST_NAO_LIMPOU = {
    type: 'warning',
    title: 'Não foi possível limpar',
    description: 'Copie qualquer outro texto para tirar a senha da área de transferência.',
};

export function ViewSecretModal({ segredoId, onClose, titulo }) {
    const { addToast } = useToast();
    // `id` = segredo carregado; trocar o segredo mostra "carregando" sem setState no efeito.
    const [estado, setEstado] = useState({ id: null, valor: '' });
    const [isVisible, setIsVisible] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    // Cópia pendente de limpeza e o intervalo do contador (lidos também ao desmontar).
    const sessao = useRef({ pendente: false, intervalo: null });
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });
    const loading = estado.id !== segredoId;

    // Busca a senha ao abrir o modal
    useEffect(() => {
        let ativo = true;
        getSegredoValor(segredoId)
            .then((res) => { if (ativo) setEstado({ id: segredoId, valor: res.valor || '' }); })
            .catch(() => {
                if (!ativo) return;
                addToast({ type: 'error', title: 'Erro', description: 'Não foi possível decifrar o segredo.' });
                onCloseRef.current();
            });
        return () => { ativo = false; };
    }, [segredoId, addToast]);

    // Aba/app em segundo plano: o valor revelado volta a ficar oculto.
    useEffect(() => {
        const aoMudarVisibilidade = () => {
            if (document.visibilityState === 'hidden') setIsVisible(false);
        };
        document.addEventListener('visibilitychange', aoMudarVisibilidade);
        return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    }, []);

    // Desmontou com cópia pendente (troca de rota, Voltar): limpa mesmo assim.
    useEffect(() => {
        const s = sessao.current;
        return () => {
            clearInterval(s.intervalo);
            if (!s.pendente) return;
            s.pendente = false;
            escreverClipboard('').then((ok) => addToast(ok ? TOAST_LIMPO : TOAST_NAO_LIMPOU));
        };
    }, [addToast]);

    // Chamada dentro do gesto (fechar) ou pelo timer. A escrita é feita antes do primeiro await,
    // então no gesto o Safari a aceita; só avisa "limpa" se ela realmente deu certo.
    const limparAgora = async () => {
        const s = sessao.current;
        clearInterval(s.intervalo);
        s.intervalo = null;
        if (!s.pendente) return;
        s.pendente = false;
        setTimeLeft(null);
        const ok = await escreverClipboard('');
        addToast(ok ? TOAST_LIMPO : TOAST_NAO_LIMPOU);
    };

    const handleCopy = async () => {
        if (!estado.valor) return;
        const ok = await escreverClipboard(estado.valor);
        if (!ok) {
            addToast({ type: 'error', title: 'Não foi possível copiar', description: 'Toque em Revelar e copie manualmente.' });
            return;
        }
        const s = sessao.current;
        s.pendente = true;
        clearInterval(s.intervalo);
        let restante = SEGUNDOS_LIMPEZA;
        setTimeLeft(restante);
        s.intervalo = setInterval(() => {
            restante -= 1;
            if (restante > 0) setTimeLeft(restante);
            else limparAgora();
        }, 1000);
        addToast({ type: 'success', title: 'Copiado', description: `Limpeza automática em ${SEGUNDOS_LIMPEZA}s ou ao fechar.` });
    };

    const fechar = () => {
        limparAgora();
        onClose();
    };

    return (
        <BaseModal onClose={fechar} className="modal view-secret-modal">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h3>Visualizar: {titulo}</h3>
                    <button type="button" className="close-btn" onClick={fechar} aria-label="Fechar">&times;</button>
                </div>

                <div className="modal-body view-secret-body">
                    {loading ? (
                        <div className="view-secret-loading">
                            <i className="fa-solid fa-circle-notch fa-spin"></i> Descriptografando...
                        </div>
                    ) : (
                        <div className="secret-display-box">
                            <div className="secret-field">
                                <span className={isVisible ? 'text-visible' : 'text-masked'}>
                                    {isVisible ? estado.valor : '•'.repeat(24)}
                                </span>
                            </div>

                            <div className="secret-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsVisible(!isVisible)}>
                                    <i className={`fa-solid ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    {isVisible ? 'Ocultar' : 'Revelar'}
                                </button>

                                <button type="button" className="btn-primary" onClick={handleCopy}>
                                    <i className="fa-regular fa-copy"></i>
                                    {timeLeft ? `Copiado (${timeLeft}s)` : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    )}

                    <p className="view-secret-aviso">
                        <i className="fa-solid fa-shield-halved"></i> Esta janela deve ser fechada após o uso.
                    </p>
                </div>
            </div>
        </BaseModal>
    );
}
