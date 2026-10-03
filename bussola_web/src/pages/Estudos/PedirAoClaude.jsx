import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sheet } from '../../components/mobile/Sheet';
import { ACOES, copiarTexto, montarComando } from './comandos';

// Menu "Pedir ao Claude": copia para a área de transferência um comando que o kit entende
// (Claude Code) ou uma frase equivalente (claude.ai). blocoId = ação sobre um bloco específico.
// No celular o menu abre num sheet (o popover vazaria da tela) e "Copiar comando" fica no rodapé.
export function PedirAoClaude({ materialId, blocoId = null, destino, compacto = false }) {
    const { addToast } = useToast();
    const isMobile = useIsMobile();
    const [aberto, setAberto] = useState(false);
    const [perguntando, setPerguntando] = useState(false);
    const [pergunta, setPergunta] = useState('');
    const alvo = blocoId ? `Bloco ${blocoId}` : 'Material inteiro';
    const formId = `pedir-claude-${materialId}-${blocoId || 'material'}`;

    const fechar = () => {
        setAberto(false);
        setPerguntando(false);
        setPergunta('');
    };

    const copiar = async (acao, textoPergunta = '') => {
        const comando = montarComando({ destino, acao, materialId, blocoId, pergunta: textoPergunta });
        const ok = await copiarTexto(comando);
        addToast(ok
            ? {
                type: 'success',
                title: 'Comando copiado',
                description: destino === 'claude-ai' ? 'Cole numa conversa do Projeto Estudos no claude.ai.' : 'Cole no Claude Code.',
            }
            : { type: 'error', title: 'Não foi possível copiar', description: comando });
        fechar();
    };

    const escolher = (acao) => {
        if (acao.pergunta) {
            setPerguntando(true);
            return;
        }
        copiar(acao.id);
    };

    const enviarPergunta = (e) => {
        e.preventDefault();
        if (pergunta.trim()) copiar('duvida', pergunta.trim());
    };

    return (
        <div className={`pedir-claude ${compacto ? 'compacto' : ''}`}>
            {compacto ? (
                <button
                    type="button"
                    className="pedir-claude-gatilho-bloco"
                    onClick={() => (aberto ? fechar() : setAberto(true))}
                    title={`Pedir ao Claude sobre o bloco ${blocoId}`}
                    aria-label={`Pedir ao Claude sobre o bloco ${blocoId}`}
                    aria-expanded={aberto}
                >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                </button>
            ) : (
                <button
                    type="button"
                    className="btn-secondary pedir-claude-gatilho"
                    onClick={() => (aberto ? fechar() : setAberto(true))}
                    aria-expanded={aberto}
                >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Pedir ao Claude <i className="fa-solid fa-chevron-down"></i>
                </button>
            )}

            {aberto && !isMobile && (
                <>
                    <div className="pedir-claude-fundo" onClick={fechar} />
                    <div className="pedir-claude-menu" role="menu">
                        <div className="pedir-claude-alvo">{alvo}</div>
                        {!perguntando && ACOES.map((acao) => (
                            <button key={acao.id} type="button" role="menuitem" onClick={() => escolher(acao)}>
                                <i className={`fa-solid ${acao.icone}`}></i> {acao.rotulo}
                            </button>
                        ))}
                        {perguntando && (
                            <form className="pedir-claude-pergunta" onSubmit={enviarPergunta}>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    maxLength={500}
                                    autoFocus
                                    value={pergunta}
                                    onChange={(e) => setPergunta(e.target.value)}
                                    placeholder="Qual é a sua dúvida?"
                                />
                                <div>
                                    <button type="button" className="btn-secondary btn-pequeno" onClick={() => setPerguntando(false)}>
                                        Voltar
                                    </button>
                                    <button type="submit" className="btn-primary btn-pequeno" disabled={!pergunta.trim()}>
                                        <i className="fa-regular fa-copy"></i> Copiar comando
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}

            {isMobile && (
                <Sheet
                    open={aberto}
                    onClose={fechar}
                    title="Pedir ao Claude"
                    className="pedir-claude-sheet"
                    footer={perguntando ? (
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setPerguntando(false)}>
                                Voltar
                            </button>
                            <button type="submit" form={formId} className="btn-primary" disabled={!pergunta.trim()}>
                                <i className="fa-regular fa-copy"></i> Copiar comando
                            </button>
                        </>
                    ) : null}
                >
                    <div className="estudos-scope">
                        <p className="pedir-claude-alvo">{alvo}</p>
                        {!perguntando ? (
                            <div className="action-sheet-list">
                                {ACOES.map((acao) => (
                                    <button key={acao.id} type="button" className="action-sheet-item" onClick={() => escolher(acao)}>
                                        <i className={`fa-solid ${acao.icone}`}></i>
                                        <span>{acao.rotulo}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <form id={formId} className="pedir-claude-pergunta" onSubmit={enviarPergunta}>
                                <textarea
                                    className="form-input"
                                    rows={4}
                                    maxLength={500}
                                    value={pergunta}
                                    onChange={(e) => setPergunta(e.target.value)}
                                    placeholder="Qual é a sua dúvida?"
                                    aria-label="Sua dúvida"
                                />
                            </form>
                        )}
                    </div>
                </Sheet>
            )}
        </div>
    );
}
