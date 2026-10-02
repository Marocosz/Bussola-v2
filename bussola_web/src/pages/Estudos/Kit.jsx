import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { baixarKitEstudos, getKitEstudosInstrucoes, getKitEstudosVersao } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { copiarTexto } from './comandos';
import './styles.css';

const COMANDO_MCP = 'claude mcp add --transport http bussola https://bussola.marocos.dev/mcp --header "Authorization: Bearer <token>"';

// Downloads do kit (skill + agentes) e passo a passo de instalação para cada destino.
export function KitEstudos() {
    const { addToast } = useToast();
    const [info, setInfo] = useState({ versao: null, instrucoes: '' });
    const [baixando, setBaixando] = useState('');

    useEffect(() => {
        let ativo = true;
        Promise.all([getKitEstudosVersao(), getKitEstudosInstrucoes()])
            .then(([versao, instrucoes]) => {
                if (ativo) setInfo({ versao: versao.versao, instrucoes: instrucoes.texto });
            })
            .catch(() => {
                if (!ativo) return;
                setInfo({ versao: '—', instrucoes: '' });
                addToast({ type: 'error', title: 'Erro', description: 'Não foi possível carregar as informações do kit.' });
            });
        return () => { ativo = false; };
    }, [addToast]);

    const baixar = async (alvo) => {
        setBaixando(alvo);
        try {
            const blob = await baixarKitEstudos(alvo);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `bussola-estudos-${alvo}.zip`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível baixar o kit.' });
        } finally {
            setBaixando('');
        }
    };

    const copiar = async (texto, titulo) => {
        const ok = Boolean(texto) && (await copiarTexto(texto));
        addToast(ok ? { type: 'success', title: titulo } : { type: 'error', title: 'Não foi possível copiar' });
    };

    return (
        <div className="container main-container estudos-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-wand-magic-sparkles"></i> Kit do Claude</h1>
                </div>
                <div className="page-header-kpis">
                    <span className="ph-kpi"><i className="fa-solid fa-tag"></i> versão {info.versao ?? '…'}</span>
                    <Link to="/estudos" className="ph-kpi ph-kpi-btn"><i className="fa-solid fa-arrow-left"></i> Biblioteca</Link>
                </div>
            </div>

            <div className="estudos-wrapper">
                <p className="kit-intro">
                    O kit ensina o Claude a pesquisar, escrever e revisar materiais de estudo e a gravá-los aqui pelo
                    conector MCP do Bússola. Instale no lugar onde você usa o Claude; se o Claude avisar que o formato
                    dos blocos mudou, baixe de novo.
                </p>

                <div className="kit-grade">
                    <section className="kit-card">
                        <header>
                            <i className="fa-solid fa-terminal"></i>
                            <div>
                                <h2>Claude Code</h2>
                                <p>Skill + 3 subagentes (pesquisador, escritor, revisor) — o fluxo mais completo.</p>
                            </div>
                        </header>
                        <ol className="kit-passos">
                            <li>
                                Em <strong>Configurações da Conta → Conexões MCP</strong>, crie um token (ler e escrever) e conecte:
                                <div className="kit-comando">
                                    <code>{COMANDO_MCP}</code>
                                    <button type="button" onClick={() => copiar(COMANDO_MCP, 'Comando copiado')} title="Copiar comando">
                                        <i className="fa-regular fa-copy"></i>
                                    </button>
                                </div>
                            </li>
                            <li>Baixe o zip e descompacte em <code>~/.claude/</code> (Windows: <code>%USERPROFILE%\.claude\</code>).</li>
                            <li>Reinicie o Claude Code e peça: <code>/estudos aula &lt;assunto&gt;</code>.</li>
                        </ol>
                        <button type="button" className="btn-primary kit-baixar" onClick={() => baixar('claude-code')} disabled={baixando !== ''}>
                            <i className={`fa-solid ${baixando === 'claude-code' ? 'fa-circle-notch fa-spin' : 'fa-download'}`}></i>
                            {' '}Baixar kit para Claude Code
                        </button>
                    </section>

                    <section className="kit-card">
                        <header>
                            <i className="fa-solid fa-comments"></i>
                            <div>
                                <h2>claude.ai (web e app)</h2>
                                <p>A mesma skill, sem subagentes, usada dentro de um Projeto "Estudos".</p>
                            </div>
                        </header>
                        <ol className="kit-passos">
                            <li>
                                Adicione o conector: <strong>Configurações → Conectores → Adicionar conector personalizado</strong>,
                                URL <code>https://bussola.marocos.dev/mcp</code>.
                            </li>
                            <li>Baixe o zip e envie o <code>estudos.zip</code> que está dentro dele em <strong>Configurações → Capacidades → Skills</strong>.</li>
                            <li>Crie um Projeto "Estudos" e cole as instruções do Projeto (botão abaixo); ative o conector Bússola nas conversas.</li>
                        </ol>
                        <div className="kit-botoes">
                            <button type="button" className="btn-primary kit-baixar" onClick={() => baixar('claude-ai')} disabled={baixando !== ''}>
                                <i className={`fa-solid ${baixando === 'claude-ai' ? 'fa-circle-notch fa-spin' : 'fa-download'}`}></i>
                                {' '}Baixar kit para claude.ai
                            </button>
                            <button
                                type="button"
                                className="btn-secondary kit-baixar"
                                onClick={() => copiar(info.instrucoes, 'Instruções do Projeto copiadas')}
                                disabled={!info.instrucoes}
                            >
                                <i className="fa-regular fa-copy"></i> Copiar instruções do Projeto
                            </button>
                        </div>
                    </section>
                </div>

                <p className="kit-rodape">
                    Depois de instalado, use <strong>Pedir ao Claude</strong> em qualquer material para copiar comandos prontos
                    (aprofundar, simplificar, criar exercícios, tirar dúvida…).
                </p>
            </div>
        </div>
    );
}
