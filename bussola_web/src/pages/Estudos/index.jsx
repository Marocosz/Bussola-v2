import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getEstudosMateriais, getEstudosTemas } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { NIVEIS, TIPOS, tipoDe } from './constantes';
import './styles.css';

// Biblioteca de materiais de estudo. Quem cria os materiais é o Claude (kit + MCP);
// aqui só se navega, filtra e abre. Filtro de tema fica na URL (?tema=<id>|sem).
export function Estudos() {
    const { addToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [dados, setDados] = useState({ carregado: false, erro: false, temas: [], materiais: [] });
    const [tentativa, setTentativa] = useState(0);
    const [tipo, setTipo] = useState('');
    const [soNaoEstudados, setSoNaoEstudados] = useState(false);
    const temaSelecionado = searchParams.get('tema') || '';

    useEffect(() => {
        let ativo = true;
        Promise.all([getEstudosTemas(), getEstudosMateriais()])
            .then(([temas, materiais]) => {
                if (ativo) setDados({ carregado: true, erro: false, temas, materiais });
            })
            .catch(() => {
                if (!ativo) return;
                setDados({ carregado: true, erro: true, temas: [], materiais: [] });
                addToast({ type: 'error', title: 'Erro', description: 'Falha ao carregar seus estudos.' });
            });
        return () => { ativo = false; };
    }, [addToast, tentativa]);

    const tentarDeNovo = () => {
        setDados({ carregado: false, erro: false, temas: [], materiais: [] });
        setTentativa((n) => n + 1);
    };

    const { temas, materiais } = dados;
    const totalEstudados = materiais.filter((m) => m.estudado).length;
    const totalSemTema = materiais.filter((m) => m.tema_id === null).length;

    const filtrados = useMemo(() => materiais.filter((m) => {
        if (temaSelecionado === 'sem' && m.tema_id !== null) return false;
        if (temaSelecionado && temaSelecionado !== 'sem' && String(m.tema_id) !== temaSelecionado) return false;
        if (tipo && m.tipo !== tipo) return false;
        if (soNaoEstudados && m.estudado) return false;
        return true;
    }), [materiais, temaSelecionado, tipo, soNaoEstudados]);

    const escolherTema = (valor) => {
        const proximo = new URLSearchParams(searchParams);
        if (valor) proximo.set('tema', valor);
        else proximo.delete('tema');
        setSearchParams(proximo);
    };

    const botaoTema = (valor, nome, cor, total) => (
        <button
            key={valor || 'todos'}
            type="button"
            className={`estudos-tema ${temaSelecionado === valor ? 'ativo' : ''}`}
            onClick={() => escolherTema(valor)}
        >
            <span className="estudos-tema-cor" style={{ background: cor }}></span>
            <span className="estudos-tema-nome">{nome}</span>
            <span className="estudos-tema-total">{total}</span>
        </button>
    );

    return (
        <div className="container main-container estudos-scope">
            <div className="page-header">
                <div className="page-header-main">
                    <h1><i className="fa-solid fa-graduation-cap"></i> Estudos</h1>
                </div>
                <div className="page-header-kpis">
                    <span className="ph-kpi"><i className="fa-solid fa-book-open"></i> {materiais.length} materiais</span>
                    <span className="ph-kpi positivo"><i className="fa-solid fa-check"></i> {totalEstudados} estudados</span>
                    <span className="ph-kpi"><i className="fa-solid fa-folder"></i> {temas.length} temas</span>
                    <Link to="/estudos/kit" className="ph-kpi ph-kpi-btn">
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Kit do Claude
                    </Link>
                </div>
            </div>

            <div className="estudos-wrapper">
                {!dados.carregado && (
                    <div className="estudos-carregando">
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <p>Abrindo a biblioteca...</p>
                    </div>
                )}

                {dados.carregado && dados.erro && (
                    <div className="estudos-vazio">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <h2>Não foi possível carregar seus estudos</h2>
                        <p>Verifique sua conexão e tente de novo.</p>
                        <button type="button" className="btn-primary" onClick={tentarDeNovo}>
                            <i className="fa-solid fa-rotate-right"></i> Tentar de novo
                        </button>
                    </div>
                )}

                {dados.carregado && !dados.erro && materiais.length === 0 && (
                    <div className="estudos-vazio">
                        <i className="fa-solid fa-graduation-cap"></i>
                        <h2>Sua biblioteca está vazia</h2>
                        <p>
                            Os materiais são criados pelo Claude. Instale o kit, peça
                            {' '}<code>/estudos aula &lt;assunto&gt;</code>{' '}
                            no Claude Code (ou use o Projeto Estudos no claude.ai) e o material aparece aqui,
                            com fontes citadas e quizzes.
                        </p>
                        <Link to="/estudos/kit" className="btn-primary">
                            <i className="fa-solid fa-download"></i> Baixar o kit do Claude
                        </Link>
                    </div>
                )}

                {dados.carregado && !dados.erro && materiais.length > 0 && (
                    <div className="estudos-layout">
                        <aside className="estudos-temas" aria-label="Temas" data-offscreen-ok>
                            <h2>Temas</h2>
                            {botaoTema('', 'Todos', 'var(--cor-texto-secundario)', materiais.length)}
                            {temas.map((t) => botaoTema(String(t.id), t.nome, t.cor || 'var(--cor-azul-primario)', t.total_materiais))}
                            {totalSemTema > 0 && botaoTema('sem', 'Sem tema', 'var(--cor-borda)', totalSemTema)}
                        </aside>

                        <section className="estudos-principal">
                            <div className="estudos-filtros">
                                <div className="estudos-chips">
                                    <button
                                        type="button"
                                        className={`estudos-chip ${tipo === '' ? 'ativo' : ''}`}
                                        onClick={() => setTipo('')}
                                    >
                                        Todos
                                    </button>
                                    {Object.entries(TIPOS).map(([chave, t]) => (
                                        <button
                                            key={chave}
                                            type="button"
                                            className={`estudos-chip ${t.classe} ${tipo === chave ? 'ativo' : ''}`}
                                            onClick={() => setTipo(tipo === chave ? '' : chave)}
                                        >
                                            <i className={`fa-solid ${t.icone}`}></i> {t.rotulo}
                                        </button>
                                    ))}
                                </div>
                                <label className="estudos-check">
                                    <input
                                        type="checkbox"
                                        checked={soNaoEstudados}
                                        onChange={(e) => setSoNaoEstudados(e.target.checked)}
                                    />
                                    Só não estudados
                                </label>
                            </div>

                            {filtrados.length === 0 ? (
                                <p className="estudos-nada">Nenhum material com esses filtros.</p>
                            ) : (
                                <div className="estudos-grade">
                                    {filtrados.map((m) => {
                                        const t = tipoDe(m.tipo);
                                        return (
                                            <Link
                                                key={m.id}
                                                to={`/estudos/${m.id}`}
                                                className="estudo-card"
                                                style={{ '--estudo-cor': m.tema_cor || 'var(--cor-azul-primario)' }}
                                            >
                                                <div className="estudo-card-topo">
                                                    <span className={`estudo-etiqueta ${t.classe}`}>
                                                        <i className={`fa-solid ${t.icone}`}></i> {t.rotulo}
                                                    </span>
                                                    {m.estudado && (
                                                        <span className="estudo-card-estudado" title="Estudado">
                                                            <i className="fa-solid fa-circle-check"></i>
                                                        </span>
                                                    )}
                                                </div>
                                                <h3>{m.titulo}</h3>
                                                {m.subtitulo && <p className="estudo-card-sub">{m.subtitulo}</p>}
                                                <div className="estudo-card-rodape">
                                                    {m.tema_nome && <span className="estudo-card-tema">{m.tema_nome}</span>}
                                                    <span className="estudo-card-nivel">{NIVEIS[m.nivel] || m.nivel}</span>
                                                    {m.tags.slice(0, 3).map((tag) => (
                                                        <span key={tag} className="estudo-tag">#{tag}</span>
                                                    ))}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
