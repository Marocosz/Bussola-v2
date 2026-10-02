import { useState } from 'react';
import { TextoInline } from './TextoInline';

// "Revelar resposta" → "Acertei"/"Errei" registra (onResponder com acertou do próprio usuário).
export function QuestaoAberta({ bloco, onResponder }) {
    const [etapa, setEtapa] = useState('pergunta'); // pergunta | revelada | avaliada
    const [tentativa, setTentativa] = useState('');
    const [acertou, setAcertou] = useState(null);

    const [pendente, setPendente] = useState(false);

    // Mostra a avaliação na hora (pendente) e volta à etapa anterior se o registro falhar.
    const avaliar = async (valor) => {
        if (pendente) return;
        setAcertou(valor);
        setEtapa('avaliada');
        setPendente(true);
        const ok = onResponder ? await onResponder(bloco.id, { resposta: tentativa, acertou: valor }) : true;
        setPendente(false);
        if (ok === false) {
            setAcertou(null);
            setEtapa('revelada');
        }
    };

    const refazer = () => {
        setEtapa('pergunta');
        setAcertou(null);
        setTentativa('');
    };

    return (
        <div className="bloco-questao">
            <div className="bloco-rotulo"><i className="fa-solid fa-pen"></i> Questão aberta</div>
            <p className="bloco-questao-pergunta">{bloco.pergunta}</p>
            {etapa === 'pergunta' && (
                <>
                    <textarea
                        className="form-input bloco-questao-tentativa"
                        rows={3}
                        maxLength={5000}
                        value={tentativa}
                        onChange={(e) => setTentativa(e.target.value)}
                        placeholder="Escreva sua resposta (opcional) antes de revelar…"
                    />
                    <div className="bloco-acoes-linha">
                        <button type="button" className="btn-primary btn-pequeno" onClick={() => setEtapa('revelada')}>
                            <i className="fa-solid fa-eye"></i> Revelar resposta
                        </button>
                    </div>
                </>
            )}
            {etapa !== 'pergunta' && (
                <div className="bloco-questao-resposta">
                    <strong>Resposta modelo</strong>
                    <p><TextoInline texto={bloco.resposta_modelo} /></p>
                    {etapa === 'revelada' ? (
                        <div className="bloco-acoes-linha">
                            <button type="button" className="btn-primary btn-pequeno btn-acertei" onClick={() => avaliar(true)}>
                                <i className="fa-solid fa-check"></i> Acertei
                            </button>
                            <button type="button" className="btn-secondary btn-pequeno btn-errei" onClick={() => avaliar(false)}>
                                <i className="fa-solid fa-xmark"></i> Errei
                            </button>
                        </div>
                    ) : (
                        <div className="bloco-acoes-linha">
                            <span className={`bloco-questao-marcado ${acertou ? 'acerto' : 'erro'}`}>
                                {acertou ? 'Você marcou: acertei' : 'Você marcou: errei'}
                            </span>
                            <button type="button" className="btn-secondary btn-pequeno" onClick={refazer} disabled={pendente}>
                                <i className="fa-solid fa-rotate-left"></i> Refazer
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
