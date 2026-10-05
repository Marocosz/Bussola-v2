import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    deleteEstudoMaterial, getEstudoMaterial, getEstudoRespostas, getEstudosMateriais, marcarEstudoEstudado, responderEstudo,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { BlocoRenderer } from './blocos/BlocoRenderer';
import { EstudoContexto } from './blocos/contexto';
import { PedirAoClaude } from './PedirAoClaude';
import { IndiceLeitura } from './IndiceLeitura';
import { itensDoIndice, RESPONDIVEIS } from './indice';
import { Sheet } from '../../components/mobile/Sheet';
import { TopbarActions, TopbarTitle } from '../../components/mobile/MobileChrome';
import { DESTINOS, lerDestino, salvarDestino } from './comandos';
import { NIVEIS, tipoDe } from './constantes';
import './styles.css';
import './blocos/blocos.css';

function dominio(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function mensagemDeErro(err, padrao) {
    const detalhe = err?.response?.data?.detail;
    return typeof detalhe === 'string' ? detalhe : padrao;
}

// Minutos de leitura estimados (~200 palavras/min) a partir de todo texto dos blocos.
function minutosDeLeitura(blocos) {
    const textos = [];
    const coletar = (v) => {
        if (typeof v === 'string') textos.push(v);
        else if (Array.isArray(v)) v.forEach(coletar);
        else if (v && typeof v === 'object') Object.values(v).forEach(coletar);
    };
    coletar(blocos);
    const palavras = textos.join(' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(palavras / 200));
}

const movimentoReduzido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function irPara(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: movimentoReduzido() ? 'auto' : 'smooth', block: 'start' });
}

export function LeituraEstudo() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const confirmar = useConfirm();
    // `chave` = id carregado; trocar de material na URL mostra "carregando" sem setState no efeito.
    const [estado, setEstado] = useState({ chave: null, material: null, erro: null });
    const [respostas, setRespostas] = useState({ chave: null, mapa: {} });
    const [vizinhos, setVizinhos] = useState([]);
    const [destino, setDestino] = useState(lerDestino);
    const [salvando, setSalvando] = useState(false);
    const [indiceAberto, setIndiceAberto] = useState(false);
    const [leitura, setLeitura] = useState({ progresso: 0, ativo: null, compacto: false });
    const barraRef = useRef(null);
    const cabecalhoRef = useRef(null);
    const artigoRef = useRef(null);

    useEffect(() => {
        let ativo = true;
        getEstudoMaterial(id)
            .then((material) => {
                if (ativo) setEstado({ chave: id, material, erro: null });
            })
            .catch((err) => {
                if (ativo) setEstado({ chave: id, material: null, erro: [404, 422].includes(err?.response?.status) ? 'nao-encontrado' : 'falha' });
            });
        // Progresso dos quizzes: opcional — se falhar, o índice só conta o que for respondido agora.
        getEstudoRespostas(id)
            .then((lista) => {
                if (!ativo) return;
                const mapa = {};
                lista.forEach((r) => { mapa[r.bloco_id] = r.acertou; });
                setRespostas({ chave: id, mapa });
            })
            .catch(() => {});
        return () => { ativo = false; };
    }, [id]);

    // Lista da biblioteca para "Anterior/Próximo" do mesmo tema (opcional, falha em silêncio).
    useEffect(() => {
        let ativo = true;
        getEstudosMateriais()
            .then((lista) => { if (ativo) setVizinhos(lista); })
            .catch(() => {});
        return () => { ativo = false; };
    }, []);

    const carregando = estado.chave !== id;
    const material = carregando ? null : estado.material;
    const respondidos = respostas.chave === id ? respostas.mapa : {};
    const contexto = useMemo(() => ({ totalFontes: material?.fontes?.length || 0 }), [material]);
    const itens = useMemo(() => (material ? itensDoIndice(material) : []), [material]);

    // Progresso de leitura, item ativo do índice e barra compacta: medidos a cada quadro de rolagem.
    useEffect(() => {
        if (!material) return undefined;
        let quadro = 0;
        const medir = () => {
            quadro = 0;
            const artigo = artigoRef.current;
            if (!artigo) return;
            const vh = window.innerHeight;
            const r = artigo.getBoundingClientRect();
            const fracao = Math.min(1, Math.max(0, (vh * 0.5 - r.top) / Math.max(1, r.height)));
            barraRef.current?.style.setProperty('--progresso', String(fracao));
            // Altura da barra (não a posição): no celular ela fica abaixo do título e não é fixa.
            const limite = 12 + (barraRef.current?.offsetHeight || 0) + 24;
            let ativo = null;
            for (const item of itens) {
                const el = document.getElementById(item.id);
                if (el && el.getBoundingClientRect().top <= limite) ativo = item.id;
            }
            const compacto = (cabecalhoRef.current?.getBoundingClientRect().bottom ?? 1) < limite;
            const progresso = Math.round(fracao * 100);
            setLeitura((atual) => (atual.progresso === progresso && atual.ativo === ativo && atual.compacto === compacto
                ? atual
                : { progresso, ativo, compacto }));
        };
        const agendar = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
        agendar();
        window.addEventListener('scroll', agendar, { passive: true });
        window.addEventListener('resize', agendar);
        return () => {
            cancelAnimationFrame(quadro);
            window.removeEventListener('scroll', agendar);
            window.removeEventListener('resize', agendar);
        };
    }, [material, itens]);

    const responder = useCallback(async (blocoId, dados) => {
        try {
            const registro = await responderEstudo(id, { bloco_id: blocoId, ...dados });
            setRespostas((atual) => ({
                chave: id,
                mapa: { ...(atual.chave === id ? atual.mapa : {}), [blocoId]: registro.acertou },
            }));
            return true;
        } catch (err) {
            addToast({ type: 'warning', title: 'Resposta não registrada', description: mensagemDeErro(err, 'Tente de novo em instantes.') });
            return false;
        }
    }, [id, addToast]);

    const trocarDestino = (novo) => {
        setDestino(novo);
        salvarDestino(novo);
    };

    // No Sheet, rola só depois que ele fecha (o scrollLock devolve a posição ao fechar).
    const irDoIndice = (alvo) => {
        if (!indiceAberto) {
            irPara(alvo);
            return;
        }
        setIndiceAberto(false);
        setTimeout(() => requestAnimationFrame(() => irPara(alvo)), 80);
    };

    const voltarAoTopo = () => window.scrollTo({ top: 0, behavior: movimentoReduzido() ? 'auto' : 'smooth' });

    const alternarEstudado = async () => {
        setSalvando(true);
        try {
            const atualizado = await marcarEstudoEstudado(material.id, !material.estudado);
            // preserva a referência de blocos/fontes (BlocoRenderer é memoizado)
            setEstado((atual) => ({
                ...atual,
                material: { ...atual.material, estudado: atualizado.estudado, estudado_em: atualizado.estudado_em },
            }));
        } catch (err) {
            addToast({ type: 'error', title: 'Erro', description: mensagemDeErro(err, 'Não foi possível atualizar o material.') });
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async () => {
        const ok = await confirmar({
            title: 'Excluir material?',
            description: `"${material.titulo}" e o histórico de respostas dele serão apagados. Esta ação não pode ser desfeita.`,
            confirmLabel: 'Sim, excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteEstudoMaterial(material.id);
            addToast({ type: 'success', title: 'Excluído', description: 'Material removido da biblioteca.' });
            navigate('/estudos');
        } catch (err) {
            addToast({ type: 'error', title: 'Erro', description: mensagemDeErro(err, 'Não foi possível excluir o material.') });
        }
    };

    if (carregando) {
        return (
            <div className="container main-container estudos-scope">
                <TopbarTitle title="Estudos" backTo="/estudos" />
                <div className="estudos-carregando">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <p>Abrindo material...</p>
                </div>
            </div>
        );
    }

    if (!material) {
        return (
            <div className="container main-container estudos-scope">
                <TopbarTitle title="Estudos" backTo="/estudos" />
                <div className="estudos-vazio">
                    <i className="fa-solid fa-book-open"></i>
                    <h2>{estado.erro === 'nao-encontrado' ? 'Material não encontrado' : 'Não foi possível abrir o material'}</h2>
                    <p>{estado.erro === 'nao-encontrado' ? 'Ele pode ter sido excluído.' : 'Tente recarregar a página.'}</p>
                    <Link to="/estudos" className="btn-primary"><i className="fa-solid fa-arrow-left"></i> Voltar à biblioteca</Link>
                </div>
            </div>
        );
    }

    const tipo = tipoDe(material.tipo);
    const totalPerguntas = material.blocos.filter((b) => RESPONDIVEIS[b.tipo]).length;
    const doTema = vizinhos.filter((m) => m.tema_id === material.tema_id);
    const posicao = doTema.findIndex((m) => m.id === material.id);
    const anterior = posicao > 0 ? doTema[posicao - 1] : null;
    const proximo = posicao >= 0 && posicao < doTema.length - 1 ? doTema[posicao + 1] : null;
    const estudadoEm = material.estudado_em
        ? new Date(material.estudado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;
    const indice = (
        <IndiceLeitura
            itens={itens}
            ativo={leitura.ativo}
            respondidos={respondidos}
            progresso={leitura.progresso}
            onIr={irDoIndice}
        />
    );

    return (
        <div className="container main-container estudos-scope estudo-pagina" style={{ '--estudo-cor': material.tema_cor || 'var(--cor-azul-primario)' }}>
            <TopbarTitle
                title={material.tema_nome || 'Estudos'}
                backTo={material.tema_id ? `/estudos?tema=${material.tema_id}` : '/estudos'}
            />
            {itens.length > 0 && (
                <TopbarActions>
                    <button type="button" aria-label="Índice do material" onClick={() => setIndiceAberto(true)}>
                        <i className="fa-solid fa-list-ol"></i>
                    </button>
                </TopbarActions>
            )}

            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className={`fa-solid ${tipo.icone}`}></i> {material.tema_nome || 'Estudos'}</h1>
                </div>
                <div className="page-header-kpis">
                    <span className="ph-kpi"><i className="fa-regular fa-clock"></i> ~{minutosDeLeitura(material.blocos)} min</span>
                    <span className="ph-kpi"><i className="fa-solid fa-cubes"></i> {material.blocos.length} blocos</span>
                    {totalPerguntas > 0 && (
                        <span className="ph-kpi"><i className="fa-solid fa-circle-question"></i> {totalPerguntas} {totalPerguntas === 1 ? 'pergunta' : 'perguntas'}</span>
                    )}
                    {material.fontes.length > 0 && (
                        <span className="ph-kpi"><i className="fa-solid fa-book-bookmark"></i> {material.fontes.length} {material.fontes.length === 1 ? 'fonte' : 'fontes'}</span>
                    )}
                </div>
            </div>

            <div className={`estudo-leitura ${itens.length > 0 ? 'com-indice' : ''}`}>
                <div ref={barraRef} className={`estudo-barra ${leitura.compacto ? 'compacto' : ''}`}>
                    <span className="estudo-progresso" aria-hidden="true"></span>
                    <div className="estudo-barra-esq">
                        <nav className="estudo-breadcrumb" aria-label="Caminho">
                            <Link to="/estudos"><i className="fa-solid fa-graduation-cap"></i> Estudos</Link>
                            {material.tema_id && (
                                <>
                                    <i className="fa-solid fa-chevron-right"></i>
                                    <Link to={`/estudos?tema=${material.tema_id}`}>{material.tema_nome}</Link>
                                </>
                            )}
                        </nav>
                        <span className="estudo-barra-titulo" aria-hidden={!leitura.compacto}>
                            <i className={`fa-solid ${tipo.icone}`}></i> {material.titulo}
                        </span>
                    </div>

                    <div className="estudo-acoes">
                        {itens.length > 0 && (
                            <button type="button" className="btn-secondary estudo-btn-indice" onClick={() => setIndiceAberto(true)}>
                                <i className="fa-solid fa-list-ol"></i> Índice
                            </button>
                        )}
                        <button
                            type="button"
                            className={`btn-secondary estudo-btn-estudado ${material.estudado ? 'ativo' : ''}`}
                            onClick={alternarEstudado}
                            disabled={salvando}
                        >
                            <i className={`fa-solid ${material.estudado ? 'fa-circle-check' : 'fa-check'}`}></i>
                            {material.estudado ? ' Estudado' : ' Marcar como estudado'}
                        </button>
                        <PedirAoClaude materialId={material.id} destino={destino} />
                        <div className="estudo-destino" role="group" aria-label="Destino dos comandos do Claude">
                            {DESTINOS.map((d) => (
                                <button
                                    key={d.id}
                                    type="button"
                                    className={destino === d.id ? 'ativo' : ''}
                                    onClick={() => trocarDestino(d.id)}
                                >
                                    {d.rotulo}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="estudo-btn-excluir" onClick={excluir} title="Excluir material" aria-label="Excluir material">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                        <button
                            type="button"
                            className="estudo-btn-topo"
                            onClick={voltarAoTopo}
                            title="Voltar ao topo"
                            aria-label="Voltar ao topo"
                            tabIndex={leitura.compacto ? 0 : -1}
                        >
                            <i className="fa-solid fa-arrow-up"></i>
                        </button>
                    </div>
                </div>

                <header ref={cabecalhoRef} className="estudo-cabecalho">
                    <div className="estudo-etiquetas">
                        <span className={`estudo-etiqueta ${tipo.classe}`}><i className={`fa-solid ${tipo.icone}`}></i> {tipo.rotulo}</span>
                        <span className="estudo-chip-info">{NIVEIS[material.nivel] || material.nivel}</span>
                        {material.estudado && (
                            <span className="estudo-chip-info estudado"><i className="fa-solid fa-circle-check"></i> Estudado</span>
                        )}
                        {material.tags.map((tag) => <span key={tag} className="estudo-chip-info">#{tag}</span>)}
                    </div>
                    <h1>{material.titulo}</h1>
                    {material.subtitulo && <p className="estudo-subtitulo">{material.subtitulo}</p>}
                </header>

                {itens.length > 0 && <aside className="estudo-lateral">{indice}</aside>}

                <EstudoContexto.Provider value={contexto}>
                    <article ref={artigoRef} className="estudo-coluna">
                        {material.blocos.map((bloco) => (
                            <section key={bloco.id} id={`bloco-${bloco.id}`} className="estudo-bloco">
                                <div className="estudo-bloco-acoes">
                                    <PedirAoClaude materialId={material.id} blocoId={bloco.id} destino={destino} compacto />
                                </div>
                                <BlocoRenderer bloco={bloco} onResponder={responder} />
                            </section>
                        ))}
                    </article>
                </EstudoContexto.Provider>

                <section className="estudo-fim" aria-label="Fim do material">
                    {material.estudado ? (
                        <div className="estudo-fim-status">
                            <i className="fa-solid fa-circle-check"></i>
                            <div>
                                <strong>Material estudado</strong>
                                {estudadoEm && <span>Marcado em {estudadoEm}</span>}
                            </div>
                            <button type="button" className="btn-secondary estudo-fim-desmarcar" onClick={alternarEstudado} disabled={salvando}>
                                Desmarcar
                            </button>
                        </div>
                    ) : (
                        <div className="estudo-fim-status pendente">
                            <i className="fa-solid fa-flag-checkered"></i>
                            <div>
                                <strong>Chegou ao fim</strong>
                                <span>Terminou a leitura? Marque para acompanhar na biblioteca.</span>
                            </div>
                            <button type="button" className="btn-primary estudo-fim-marcar" onClick={alternarEstudado} disabled={salvando}>
                                <i className="fa-solid fa-check"></i> Marcar como estudado
                            </button>
                        </div>
                    )}

                    {(anterior || proximo) && (
                        <nav className="estudo-navegacao" aria-label="Outros materiais do tema">
                            {anterior ? (
                                <Link to={`/estudos/${anterior.id}`} className="estudo-vizinho anterior">
                                    <span><i className="fa-solid fa-arrow-left"></i> Anterior</span>
                                    <strong>{anterior.titulo}</strong>
                                </Link>
                            ) : <span />}
                            {proximo && (
                                <Link to={`/estudos/${proximo.id}`} className="estudo-vizinho proximo">
                                    <span>Próximo <i className="fa-solid fa-arrow-right"></i></span>
                                    <strong>{proximo.titulo}</strong>
                                </Link>
                            )}
                        </nav>
                    )}
                </section>

                {material.fontes.length > 0 && (
                    <footer className="estudo-fontes" id="estudo-fontes">
                        <h2>Fontes</h2>
                        <ol>
                            {material.fontes.map((fonte, i) => (
                                <li key={i} id={`estudo-fonte-${i + 1}`}>
                                    <span className="estudo-fonte-numero">{i + 1}</span>
                                    <div className="estudo-fonte-corpo">
                                        {/^https?:\/\//i.test(fonte.url) ? (
                                            <a href={fonte.url} target="_blank" rel="noopener noreferrer">{fonte.titulo}</a>
                                        ) : (
                                            <span>{fonte.titulo}</span>
                                        )}
                                        <span className="estudo-fonte-dominio">
                                            {dominio(fonte.url) && <i className="fa-solid fa-link"></i>} {dominio(fonte.url)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </footer>
                )}
            </div>

            <Sheet open={indiceAberto} onClose={() => setIndiceAberto(false)} title="Índice" className="estudo-indice-sheet">
                {indice}
                <button type="button" className="btn-secondary estudo-indice-topo-btn" onClick={() => { setIndiceAberto(false); setTimeout(voltarAoTopo, 80); }}>
                    <i className="fa-solid fa-arrow-up"></i> Voltar ao topo
                </button>
            </Sheet>
        </div>
    );
}
