import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteEstudoMaterial, getEstudoMaterial, marcarEstudoEstudado, responderEstudo } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { BlocoRenderer } from './blocos/BlocoRenderer';
import { EstudoContexto } from './blocos/contexto';
import { PedirAoClaude } from './PedirAoClaude';
import { TopbarTitle } from '../../components/mobile/MobileChrome';
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

export function LeituraEstudo() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const confirmar = useConfirm();
    // `chave` = id carregado; trocar de material na URL mostra "carregando" sem setState no efeito.
    const [estado, setEstado] = useState({ chave: null, material: null, erro: null });
    const [destino, setDestino] = useState(lerDestino);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        let ativo = true;
        getEstudoMaterial(id)
            .then((material) => {
                if (ativo) setEstado({ chave: id, material, erro: null });
            })
            .catch((err) => {
                if (ativo) setEstado({ chave: id, material: null, erro: [404, 422].includes(err?.response?.status) ? 'nao-encontrado' : 'falha' });
            });
        return () => { ativo = false; };
    }, [id]);

    const carregando = estado.chave !== id;
    const material = carregando ? null : estado.material;
    const contexto = useMemo(() => ({ totalFontes: material?.fontes?.length || 0 }), [material]);

    const responder = useCallback(async (blocoId, dados) => {
        try {
            await responderEstudo(id, { bloco_id: blocoId, ...dados });
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

    return (
        <div className="container main-container estudos-scope" style={{ '--estudo-cor': material.tema_cor || 'var(--cor-azul-primario)' }}>
            <TopbarTitle
                title={material.tema_nome || 'Estudos'}
                backTo={material.tema_id ? `/estudos?tema=${material.tema_id}` : '/estudos'}
            />
            <div className="estudo-leitura">
                <nav className="estudo-breadcrumb" aria-label="Caminho">
                    <Link to="/estudos"><i className="fa-solid fa-graduation-cap"></i> Estudos</Link>
                    {material.tema_id && (
                        <>
                            <i className="fa-solid fa-chevron-right"></i>
                            <Link to={`/estudos?tema=${material.tema_id}`}>{material.tema_nome}</Link>
                        </>
                    )}
                    <i className="fa-solid fa-chevron-right"></i>
                    <span>{material.titulo}</span>
                </nav>

                <header className="estudo-cabecalho">
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

                    <div className="estudo-acoes">
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
                        <button type="button" className="estudo-btn-excluir" onClick={excluir} title="Excluir material" aria-label="Excluir material">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
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
                    </div>
                </header>

                <EstudoContexto.Provider value={contexto}>
                    <article className="estudo-coluna">
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

                {material.fontes.length > 0 && (
                    <footer className="estudo-fontes">
                        <h2>Fontes</h2>
                        <ol>
                            {material.fontes.map((fonte, i) => (
                                <li key={i} id={`estudo-fonte-${i + 1}`}>
                                    {/^https?:\/\//i.test(fonte.url) ? (
                                        <a href={fonte.url} target="_blank" rel="noopener noreferrer">{fonte.titulo}</a>
                                    ) : (
                                        fonte.titulo
                                    )}
                                    <span className="estudo-fonte-dominio">{dominio(fonte.url)}</span>
                                </li>
                            ))}
                        </ol>
                    </footer>
                )}
            </div>
        </div>
    );
}
