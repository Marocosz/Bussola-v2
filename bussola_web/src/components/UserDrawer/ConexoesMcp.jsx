import { useEffect, useState } from 'react';
import { BaseModal } from '../BaseModal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { criarTokenMcp, listarConexoesMcp, revogarClienteMcp, revogarTokenMcp } from '../../services/api';
import './ConexoesMcp.css';

const MCP_URL = `${window.location.origin}/mcp`;

function formatarData(iso) {
    return iso ? new Date(iso).toLocaleDateString('pt-BR') : 'nunca';
}

export function ConexoesMcp() {
    const { addToast } = useToast();
    const confirm = useConfirm();

    const [conexoes, setConexoes] = useState([]);
    const [erroCarga, setErroCarga] = useState(false);
    const [versao, setVersao] = useState(0);
    const [modalAberto, setModalAberto] = useState(false);
    const [nome, setNome] = useState('Claude Code');
    const [podeEscrever, setPodeEscrever] = useState(true);
    const [tokenGerado, setTokenGerado] = useState('');

    useEffect(() => {
        let ativo = true;
        listarConexoesMcp()
            .then((dados) => { if (ativo) { setConexoes(dados); setErroCarga(false); } })
            .catch(() => { if (ativo) setErroCarga(true); });
        return () => { ativo = false; };
    }, [versao]);

    const recarregar = () => setVersao((v) => v + 1);

    const gerar = async () => {
        try {
            const dados = await criarTokenMcp({
                nome,
                escopos: podeEscrever ? ['bussola:read', 'bussola:write'] : ['bussola:read'],
                validade_dias: 90,
            });
            setTokenGerado(dados.token);
            recarregar();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível gerar o token.' });
        }
    };

    const revogar = async (conexao) => {
        const ok = await confirm({
            title: 'Revogar conexão?',
            description: `${conexao.nome} perderá o acesso ao Bússola imediatamente.`,
            confirmLabel: 'Revogar',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            if (conexao.tipo === 'pat') await revogarTokenMcp(conexao.id);
            else await revogarClienteMcp(conexao.client_id);
            addToast({ type: 'success', title: 'Conexão revogada' });
            recarregar();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível revogar.' });
        }
    };

    const copiar = async (texto) => {
        try {
            await navigator.clipboard.writeText(texto);
            addToast({ type: 'success', title: 'Copiado!' });
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Copie manualmente.' });
        }
    };

    const fecharModal = () => {
        setModalAberto(false);
        setTokenGerado('');
    };

    const comando = `claude mcp add --transport http bussola ${MCP_URL} --header "Authorization: Bearer ${tokenGerado}"`;

    return (
        <>
            <div className="form-section-title">Conexões MCP (Claude)</div>
            <p className="mcp-dica">
                No claude.ai, adicione um conector personalizado com a URL <code>{MCP_URL}</code>.
                Para o Claude Code, gere um token.
            </p>

            {erroCarga && <p className="mcp-dica">Não foi possível carregar as conexões.</p>}
            <ul className="mcp-lista">
                {conexoes.map((c) => (
                    <li key={c.tipo === 'pat' ? `pat-${c.id}` : `oauth-${c.client_id}`} className="mcp-item">
                        <div className="mcp-item-info">
                            <strong>{c.nome}</strong>
                            <span className="mcp-meta">
                                {c.tipo === 'pat' ? 'Token pessoal' : 'OAuth'} ·{' '}
                                {c.escopos.includes('bussola:write') ? 'leitura e escrita' : 'só leitura'} ·{' '}
                                último uso: {formatarData(c.ultimo_uso)}
                            </span>
                        </div>
                        <button type="button" className="btn-action-icon btn-delete" title="Revogar" onClick={() => revogar(c)}>
                            <i className="fa-solid fa-trash" />
                        </button>
                    </li>
                ))}
                {!erroCarga && conexoes.length === 0 && <li className="mcp-meta">Nenhuma conexão ativa.</li>}
            </ul>
            <button type="button" className="mcp-btn" onClick={() => setModalAberto(true)}>
                Novo token
            </button>

            {modalAberto && (
                <BaseModal onClose={fecharModal} className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Novo token MCP</h3>
                        </div>
                        <div className="modal-body">
                            {tokenGerado ? (
                                <>
                                    <p>Copie agora — este token não será exibido de novo.</p>
                                    <code className="mcp-token">{tokenGerado}</code>
                                    <p>Comando para o Claude Code:</p>
                                    <code className="mcp-token">{comando}</code>
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="mcp-nome">Nome</label>
                                        <input id="mcp-nome" className="form-input" value={nome} maxLength={100}
                                            onChange={(e) => setNome(e.target.value)} />
                                    </div>
                                    <label className="mcp-opcao">
                                        <input type="checkbox" checked={podeEscrever}
                                            onChange={(e) => setPodeEscrever(e.target.checked)} />{' '}
                                        Permitir criar, editar e excluir
                                    </label>
                                    <p className="mcp-meta">Válido por 90 dias.</p>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            {tokenGerado ? (
                                <>
                                    <button type="button" className="mcp-btn" onClick={() => copiar(comando)}>Copiar comando</button>
                                    <button type="button" className="mcp-btn" onClick={() => copiar(tokenGerado)}>Copiar token</button>
                                    <button type="button" className="mcp-btn primario" onClick={fecharModal}>Concluir</button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="mcp-btn" onClick={fecharModal}>Cancelar</button>
                                    <button type="button" className="mcp-btn primario" disabled={!nome.trim()} onClick={gerar}>Gerar</button>
                                </>
                            )}
                        </div>
                    </div>
                </BaseModal>
            )}
        </>
    );
}
