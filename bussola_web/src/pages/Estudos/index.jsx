import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getEstudosMateriais, getEstudosTemas } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { TIPOS } from './constantes';
import { EstudoCard } from './EstudoCard';
import './styles.css';

// Filtro de status: o botão cicla todos → não estudados → estudados.
const STATUS = {
    todos: { rotulo: 'Todos', icone: 'fa-layer-group', proximo: 'pendentes' },
    pendentes: { rotulo: 'Não estudados', icone: 'fa-hourglass-half', proximo: 'estudados' },
    estudados: { rotulo: 'Estudados', icone: 'fa-circle-check', proximo: 'todos' },
};

// Grupos (temas) recolhidos ficam salvos no navegador; o padrão é tudo aberto.
const CHAVE_FECHADOS = '@Bussola:estudos_grupos_fechados';

// Biblioteca de materiais de estudo. Quem cria os materiais é o Claude (kit + MCP);
// aqui só se navega, filtra e abre. Filtro de tema fica na URL (?tema=<id>|sem).
export function Estudos() {
    const { addToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [dados, setDados] = useState({ carregado: false, erro: false, temas: [], materiais: [] });
    const [tentativa, setTentativa] = useState(0);
    const [tipo, setTipo] = useState('');
    const [status, setStatus] = useState('todos');
    const [busca, setBusca] = useState('');
    const [dropdownAberto, setDropdownAberto] = useState(false);
    const [fechados, setFechados] = useState(() => {
        try { return JSON.parse(localStorage.getItem(CHAVE_FECHADOS)) || {}; } catch { return {}; }
    });
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

    const termo = busca.trim().toLowerCase();
    const filtrados = useMemo(() => materiais.filter((m) => {
        if (temaSelecionado === 'sem' && m.tema_id !== null) return false;
        if (temaSelecionado && temaSelecionado !== 'sem' && String(m.tema_id) !== temaSelecionado) return false;
        if (tipo && m.tipo !== tipo) return false;
        if (status === 'pendentes' && m.estudado) return false;
        if (status === 'estudados' && !m.estudado) return false;
        if (termo) {
            const alvo = [m.titulo, m.subtitulo, m.tema_nome, ...m.tags].filter(Boolean).join(' ').toLowerCase();
            if (!alvo.includes(termo)) return false;
        }
        return true;
    }), [materiais, temaSelecionado, tipo, status, termo]);

    const escolherTema = (valor) => {
        const proximo = new URLSearchParams(searchParams);
        if (valor) proximo.set('tema', valor);
        else proximo.delete('tema');
        setSearchParams(proximo);
        setDropdownAberto(false);
    };

    // Agrupa por tema na ordem da lista de temas; "Sem tema" por último.
    const grupos = useMemo(() => {
        const porTema = new Map();
        filtrados.forEach((m) => {
            const chave = m.tema_id === null ? 'sem' : String(m.tema_id);
            if (!porTema.has(chave)) porTema.set(chave, []);
            porTema.get(chave).push(m);
        });
        const lista = temas
            .filter((t) => porTema.has(String(t.id)))
            .map((t) => ({
                chave: String(t.id),
                nome: t.nome,
                cor: t.cor || 'var(--cor-azul-primario)',
                materiais: porTema.get(String(t.id)),
            }));
        if (porTema.has('sem')) lista.push({ chave: 'sem', nome: 'Sem tema', cor: '#ccc', materiais: porTema.get('sem') });
        return lista;
    }, [filtrados, temas]);

    const alternarGrupo = (chave) => {
        setFechados((prev) => {
            const proximo = { ...prev, [chave]: !prev[chave] };
            try { localStorage.setItem(CHAVE_FECHADOS, JSON.stringify(proximo)); } catch { /* sem storage: só não persiste */ }
            return proximo;
        });
    };

    const temaAtual = temas.find((t) => String(t.id) === temaSelecionado);
    const rotuloTema = temaSelecionado === 'sem' ? 'Sem tema' : (temaAtual?.nome || 'Todos os Temas');

    const itemTema = (valor, nome, cor, total) => (
        <div
            key={valor || 'todos'}
            className={`dropdown-item ${temaSelecionado === valor ? 'selected' : ''}`}
            onClick={() => escolherTema(valor)}
        >
            <div className="dropdown-item-info">
                {cor && <span className="dot" style={{ backgroundColor: cor }}></span>}
                <span className="name">{nome}</span>
            </div>
            <span className="estudos-dropdown-total">{total}</span>
        </div>
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
                </div>
            </div>

            <div className="estudos-wrapper estudos-biblioteca">
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
                    <>
                        <div className="column-header-flex estudos-barra">
                            <div className="tab-selector-wrapper" aria-label="Tipos" data-offscreen-ok>
                                <button
                                    type="button"
                                    className={`tab-btn-pill ${tipo === '' ? 'active' : ''}`}
                                    onClick={() => setTipo('')}
                                >
                                    Todos
                                </button>
                                {Object.entries(TIPOS).map(([chave, t]) => (
                                    <button
                                        key={chave}
                                        type="button"
                                        className={`tab-btn-pill ${tipo === chave ? 'active' : ''}`}
                                        onClick={() => setTipo(chave)}
                                    >
                                        {t.rotulo}
                                    </button>
                                ))}
                            </div>

                            <div className="header-actions-group">
                                <div className="header-search-wrapper">
                                    <i className="fa-solid fa-magnifying-glass header-search-icon"></i>
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={busca}
                                        onChange={(e) => setBusca(e.target.value)}
                                        className="header-search-input"
                                    />
                                </div>

                                <button
                                    type="button"
                                    className={`dropdown-trigger-btn estudos-status-btn ${status !== 'todos' ? 'active' : ''}`}
                                    onClick={() => setStatus(STATUS[status].proximo)}
                                    title="Alternar entre todos, não estudados e estudados"
                                >
                                    <i className={`fa-solid ${STATUS[status].icone}`}></i>
                                    <span>{STATUS[status].rotulo}</span>
                                </button>

                                <div className="custom-dropdown-wrapper">
                                    <button
                                        type="button"
                                        className={`dropdown-trigger-btn ${temaSelecionado ? 'active' : ''}`}
                                        onClick={() => setDropdownAberto(!dropdownAberto)}
                                    >
                                        <span>{rotuloTema}</span>
                                        <i className="fa-solid fa-chevron-down"></i>
                                    </button>

                                    {dropdownAberto && (
                                        <>
                                            <div className="dropdown-backdrop" onClick={() => setDropdownAberto(false)}></div>
                                            <div className="custom-dropdown-menu">
                                                {itemTema('', 'Todos os Temas', null, materiais.length)}
                                                <div className="dropdown-divider"></div>
                                                <div className="dropdown-scroll-area">
                                                    {temas.map((t) => itemTema(String(t.id), t.nome, t.cor || 'var(--cor-azul-primario)', t.total_materiais))}
                                                    {totalSemTema > 0 && itemTema('sem', 'Sem tema', '#ccc', totalSemTema)}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <Link to="/estudos/kit" className="btn-primary small-btn">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i> Kit
                                </Link>
                            </div>
                        </div>

                        {filtrados.length === 0 ? (
                            <div className="empty-state">
                                <i className="fa-regular fa-folder-open"></i>
                                <p>{termo ? 'Nenhum material encontrado.' : 'Nenhum material com esses filtros.'}</p>
                            </div>
                        ) : (
                            <div className="estudos-grupos">
                                {grupos.map((g) => {
                                    const aberto = !fechados[g.chave];
                                    return (
                                        <div className="group-accordion" key={g.chave}>
                                            <h3
                                                className={`accordion-header ${aberto ? 'active' : ''}`}
                                                onClick={() => alternarGrupo(g.chave)}
                                            >
                                                <div className="header-title-wrapper">
                                                    <span className="grp-dot" style={{ backgroundColor: g.cor }}></span>
                                                    <span>{g.nome}</span>
                                                </div>
                                                <div className="header-meta">
                                                    <span className="count-text">
                                                        {g.materiais.length} {g.materiais.length === 1 ? 'MATERIAL' : 'MATERIAIS'}
                                                    </span>
                                                    <i className={`fa-solid fa-chevron-down ${aberto ? 'rotate' : ''}`}></i>
                                                </div>
                                            </h3>

                                            <div className={`accordion-wrapper ${aberto ? 'open' : ''}`}>
                                                <div className="accordion-inner">
                                                    <div className="estudos-grade">
                                                        {g.materiais.map((m) => <EstudoCard key={m.id} material={m} />)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
