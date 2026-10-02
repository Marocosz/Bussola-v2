import { useState } from 'react';
import { TextoInline } from './TextoInline';

// Clicar numa opção revela certo/errado + explicação e registra (onResponder → POST /respostas).
// "Refazer" só limpa localmente; a próxima escolha é registrada de novo.
export function Quiz({ bloco, onResponder }) {
    const [escolha, setEscolha] = useState(null);
    const [pendente, setPendente] = useState(false);
    const respondido = escolha !== null;
    const acertou = escolha === bloco.correta;

    // Mostra a escolha na hora (pendente) e desfaz se o registro falhar.
    const escolher = async (indice) => {
        if (respondido) return;
        setEscolha(indice);
        setPendente(true);
        const ok = onResponder ? await onResponder(bloco.id, { resposta: indice }) : true;
        setPendente(false);
        if (ok === false) setEscolha(null);
    };

    return (
        <div className="bloco-quiz">
            <div className="bloco-rotulo"><i className="fa-solid fa-circle-question"></i> Quiz</div>
            <p className="bloco-quiz-pergunta">{bloco.pergunta}</p>
            <div className="bloco-quiz-opcoes">
                {bloco.opcoes.map((opcao, i) => {
                    let estado = '';
                    if (respondido && i === bloco.correta) estado = 'correta';
                    else if (respondido && i === escolha) estado = 'errada';
                    return (
                        <button
                            key={i}
                            type="button"
                            className={`bloco-quiz-opcao ${estado}`}
                            onClick={() => escolher(i)}
                            disabled={respondido}
                        >
                            <span className="bloco-quiz-letra">{String.fromCharCode(65 + i)}</span>
                            <span>{opcao}</span>
                        </button>
                    );
                })}
            </div>
            {respondido && (
                <div className={`bloco-quiz-feedback ${acertou ? 'acerto' : 'erro'}`} aria-busy={pendente}>
                    <strong>{acertou ? 'Correto!' : 'Não foi dessa vez.'}</strong>
                    <p><TextoInline texto={bloco.explicacao} /></p>
                    <button type="button" className="btn-secondary btn-pequeno" onClick={() => setEscolha(null)} disabled={pendente}>
                        <i className="fa-solid fa-rotate-left"></i> Refazer
                    </button>
                </div>
            )}
        </div>
    );
}
