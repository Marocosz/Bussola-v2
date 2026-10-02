import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { enviarConsentimentoOAuth, getOAuthCliente } from '../../services/api';
import './AutorizarConexao.css';

const HOSTS_EXATOS = ['localhost', '127.0.0.1'];
const DOMINIOS_CONFIAVEIS = ['claude.ai', 'anthropic.com'];

function lerHost(uri) {
    try {
        return new URL(uri).hostname;
    } catch {
        return null;
    }
}

function hostConfiavel(host) {
    return HOSTS_EXATOS.includes(host)
        || DOMINIOS_CONFIAVEIS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function AutorizarConexao() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const clientId = searchParams.get('client_id') || '';

    const [cliente, setCliente] = useState(null);
    const [erro, setErro] = useState('');
    const redirectUri = searchParams.get('redirect_uri') || '';
    const destinoHost = lerHost(redirectUri);
    const destinoSuspeito = !!destinoHost && !hostConfiavel(destinoHost);
    // null = ainda não escolhido: o padrão é marcado, exceto para destino não confiável
    const [escritaEscolhida, setEscritaEscolhida] = useState(null);
    const podeEscrever = escritaEscolhida ?? !destinoSuspeito;
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        let ativo = true;
        getOAuthCliente(clientId)
            .then((dados) => { if (ativo) setCliente(dados); })
            .catch(() => { if (ativo) setErro('Aplicativo desconhecido. Recomece a conexão pelo Claude.'); });
        return () => { ativo = false; };
    }, [clientId]);

    const responder = async (aprovado) => {
        setEnviando(true);
        try {
            const { redirect_url } = await enviarConsentimentoOAuth({
                client_id: clientId,
                redirect_uri: redirectUri,
                code_challenge: searchParams.get('code_challenge'),
                code_challenge_method: searchParams.get('code_challenge_method'),
                state: searchParams.get('state'),
                escopos: podeEscrever ? ['bussola:read', 'bussola:write'] : ['bussola:read'],
                aprovado,
            });
            const protocolo = new URL(redirect_url).protocol;
            if (protocolo !== 'https:' && protocolo !== 'http:') {
                throw new Error('redirect inválido');
            }
            window.location.href = redirect_url;
        } catch (e) {
            setErro(e.response?.data?.detail || 'Não foi possível concluir a autorização.');
            setEnviando(false);
        }
    };

    return (
        <div className="autorizar-page">
            <div className="autorizar-card">
                <h2>Autorizar acesso</h2>
                {erro && <p className="autorizar-erro">{erro}</p>}
                {!erro && !destinoHost && <p className="autorizar-erro">Pedido de autorização inválido. Recomece a conexão pelo Claude.</p>}
                {!erro && !cliente && <p>Carregando...</p>}
                {!erro && destinoHost && cliente && (
                    <>
                        <p>
                            <strong>{cliente.client_name}</strong> quer acessar o seu Bússola
                            {user?.email ? ` (${user.email})` : ''}.
                        </p>
                        <p>Você será redirecionado para <strong>{destinoHost}</strong>.</p>
                        {destinoSuspeito && (
                            <p className="autorizar-alerta">
                                Atenção: este endereço não é do Claude. Só autorize se você mesmo iniciou esta conexão.
                            </p>
                        )}
                        <label className="autorizar-opcao">
                            <input type="checkbox" checked readOnly disabled /> Ler seus dados
                        </label>
                        <label className="autorizar-opcao">
                            <input
                                type="checkbox"
                                checked={podeEscrever}
                                onChange={(e) => setEscritaEscolhida(e.target.checked)}
                            />{' '}
                            Criar, editar e excluir registros
                        </label>
                        <p className="autorizar-dica">Senhas do Cofre nunca são compartilhadas.</p>
                        <div className="autorizar-acoes">
                            <button type="button" className="autorizar-btn" disabled={enviando} onClick={() => responder(false)}>
                                Negar
                            </button>
                            <button type="button" className="autorizar-btn primario" disabled={enviando} onClick={() => responder(true)}>
                                Autorizar
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
