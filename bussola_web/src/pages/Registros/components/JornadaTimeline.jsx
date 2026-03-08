import { Fragment } from 'react';
import { toggleCheckinHabito, toggleStatusHabito, deleteHabito } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';
import '../styles.css';

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERIODOS = [
    {
        key: 'manha',
        label: 'Manhã',
        icon: 'fa-sun',
        range: [0, 12],
        gradient: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.06) 100%)',
        accentColor: '#3b82f6',
        emptyIcon: 'fa-mug-hot',
    },
    {
        key: 'tarde',
        label: 'Tarde',
        icon: 'fa-cloud-sun',
        range: [12, 18],
        gradient: 'linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(251,146,60,0.06) 100%)',
        accentColor: '#f59e0b',
        emptyIcon: 'fa-briefcase',
    },
    {
        key: 'noite',
        label: 'Noite',
        icon: 'fa-moon',
        range: [18, 24],
        gradient: 'linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(168,85,247,0.06) 100%)',
        accentColor: '#8b5cf6',
        emptyIcon: 'fa-star',
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayKey() {
    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return dias[new Date().getDay()];
}

function formatarData(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getHora(horario) {
    return parseInt(horario.split(':')[0], 10);
}

function calcularPrograssoPeriodo(habitos, periodo) {
    const hoje = getTodayKey();
    const ativos = habitos.filter(h => {
        if (h.status !== 'ativo') return false;
        if (!h.frequencia.includes(hoje)) return false;
        const hora = getHora(h.horario);
        return hora >= periodo.range[0] && hora < periodo.range[1];
    });
    if (!ativos.length) return null;
    const feitos = ativos.filter(h => h.registro_hoje?.concluido).length;
    return { feitos, total: ativos.length };
}

// ─── HabitoCard ──────────────────────────────────────────────────────────────

function HabitoCard({ habito, isLast, onCheckin, onEdit, onTogglePause, onDelete }) {
    const hoje = getTodayKey();
    const ocorreHoje = habito.frequencia.includes(hoje);
    const concluido = habito.registro_hoje?.concluido;
    const pausado = habito.status === 'pausado';

    const horaAtual = new Date().getHours();
    const horaHabito = getHora(habito.horario);
    const atrasado = !concluido && !pausado && ocorreHoje && horaAtual > horaHabito;

    const nodeState = pausado ? 'pausado'
        : !ocorreHoje ? 'sem-hoje'
        : concluido ? 'concluido'
        : atrasado ? 'atrasado'
        : 'pendente';

    const clickable = !pausado && ocorreHoje;

    return (
        <div className="jk-habit-row">
            {/* Track (linha + círculo) */}
            <div className="jk-track">
                <div className={`jk-track-line top ${nodeState}`}></div>
                <button
                    className={`jk-circle state-${nodeState}`}
                    style={{ '--hcor': habito.cor }}
                    onClick={() => clickable && onCheckin(habito)}
                    disabled={!clickable}
                    title={
                        pausado ? 'Hábito pausado' :
                        !ocorreHoje ? 'Não ocorre hoje' :
                        concluido ? 'Desmarcar' : 'Marcar como feito'
                    }
                >
                    {pausado && <i className="fa-solid fa-pause jk-circle-icon"></i>}
                    {!pausado && concluido && <i className="fa-solid fa-check jk-circle-icon"></i>}
                    {!pausado && !concluido && atrasado && <i className="fa-solid fa-clock jk-circle-icon"></i>}
                    {!pausado && !concluido && !atrasado && ocorreHoje && (
                        <span className="jk-circle-pulse"></span>
                    )}

                    {habito.streak >= 2 && !pausado && (
                        <span className="jk-streak">
                            <i className="fa-solid fa-fire"></i>{habito.streak}
                        </span>
                    )}
                </button>
                {!isLast ? (
                    <div className={`jk-track-line bottom ${nodeState}`}></div>
                ) : (
                    <div style={{ flex: 1, minHeight: '10px' }}></div>
                )}
            </div>

            {/* Conteúdo */}
            <div className={`jk-habit-info ${pausado ? 'is-pausado' : ''}`}>
                <div className="jk-habit-header">
                    <div className="jk-habit-header-left">
                        <span className="jk-time">{habito.horario}</span>
                        {pausado && <span className="jk-badge-pausado">pausado</span>}
                        {atrasado && !pausado && <span className="jk-badge-atrasado">atrasado</span>}
                    </div>

                    {/* Ações no hover */}
                    <div className="jk-habit-actions">
                        <button
                            className="btn-action-icon btn-edit"
                            onClick={e => { e.stopPropagation(); onEdit(habito); }}
                            title="Editar"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                            className="btn-action-icon btn-pause"
                            onClick={e => { e.stopPropagation(); onTogglePause(habito); }}
                            title={pausado ? 'Retomar' : 'Pausar'}
                        >
                            <i className={`fa-solid ${pausado ? 'fa-play' : 'fa-pause'}`}></i>
                        </button>
                        <button
                            className="btn-action-icon btn-delete"
                            onClick={e => { e.stopPropagation(); onDelete(habito); }}
                            title="Excluir"
                        >
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <p className="jk-titulo">{habito.titulo}</p>

                <div className="jk-meta">
                    <span className="jk-duracao-badge"><i className="fa-regular fa-clock"></i> {habito.duracao_min}min</span>
                    {habito.descricao && <span className="jk-descricao-inline">{habito.descricao}</span>}
                </div>
            </div>
        </div>
    );
}

// ─── ColunaPeriodo ────────────────────────────────────────────────────────────

function ColunaPeriodo({ periodo, habitos, onCheckin, onEdit, onTogglePause, onDelete }) {
    const stats = calcularPrograssoPeriodo(habitos, periodo);

    return (
        <div className="jk-col" style={{ '--periodo-gradient': periodo.gradient, '--periodo-accent': periodo.accentColor }}>
            {/* Header da coluna */}
            <div className="jk-col-header">
                <div className="jk-col-header-left">
                    <div className="jk-col-icon">
                        <i className={`fa-solid ${periodo.icon}`}></i>
                    </div>
                    <span className="jk-col-label">{periodo.label}</span>
                </div>

                {stats && (
                    <div className="jk-col-stats">
                        <span className="jk-col-stats-count">{stats.feitos}/{stats.total}</span>
                        <div className="jk-col-progress-bar">
                            <div
                                className="jk-col-progress-fill"
                                style={{
                                    width: `${Math.round((stats.feitos / stats.total) * 100)}%`,
                                    backgroundColor: periodo.accentColor,
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="jk-col-body">
                {habitos.length === 0 ? (
                    <div className="jk-col-empty">
                        <i className={`fa-regular ${periodo.emptyIcon}`}></i>
                        <span>Sem hábitos</span>
                    </div>
                ) : (
                    habitos.map((h, idx) => (
                        <HabitoCard
                            key={h.id}
                            habito={h}
                            isLast={idx === habitos.length - 1}
                            onCheckin={onCheckin}
                            onEdit={onEdit}
                            onTogglePause={onTogglePause}
                            onDelete={onDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Connector ───────────────────────────────────────────────────────────────

function PeriodoConector() {
    return (
        <div className="jk-connector" aria-hidden="true">
            <div className="jk-connector-line"></div>
            <div className="jk-connector-arrow">
                <i className="fa-solid fa-chevron-right"></i>
            </div>
            <div className="jk-connector-line"></div>
        </div>
    );
}

// ─── JornadaTimeline (main export) ───────────────────────────────────────────

export function JornadaTimeline({ habitos, onUpdate, onEdit }) {
    const { addToast } = useToast();
    const dialogConfirm = useConfirm();

    const handleCheckin = async (habito) => {
        try {
            await toggleCheckinHabito(habito.id, formatarData(new Date()));
            onUpdate();
        } catch (err) {
            console.error(err);
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível registrar o check-in.' });
        }
    };

    const handleTogglePause = async (habito) => {
        try {
            await toggleStatusHabito(habito.id);
            onUpdate();
            addToast({ type: 'info', title: habito.status === 'ativo' ? 'Hábito pausado.' : 'Hábito retomado!', description: '' });
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível alterar o status.' });
        }
    };

    const handleDelete = async (habito) => {
        const ok = await dialogConfirm({
            title: 'Excluir hábito?',
            description: `"${habito.titulo}" e todo seu histórico serão removidos permanentemente.`,
            confirmLabel: 'Sim, excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteHabito(habito.id);
            addToast({ type: 'success', title: 'Hábito excluído', description: '' });
            onUpdate();
        } catch {
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível excluir o hábito.' });
        }
    };

    if (habitos.length === 0) {
        return (
            <div className="empty-state">
                <i className="fa-solid fa-route"></i>
                <p>Sua Jornada está vazia.</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>Crie seu primeiro hábito para começar.</p>
            </div>
        );
    }

    // Agrupa hábitos por período
    const colunas = PERIODOS.map(p => ({
        ...p,
        items: habitos.filter(h => {
            const hora = getHora(h.horario);
            return hora >= p.range[0] && hora < p.range[1];
        }),
    }));

    return (
        <div className="jk-wrapper">

            {/* ── Kanban ── */}
            <div className="jk-kanban">
                {colunas.map((col, idx) => (
                    <Fragment key={col.key}>
                        <ColunaPeriodo
                            periodo={col}
                            habitos={col.items}
                            onCheckin={handleCheckin}
                            onEdit={onEdit}
                            onTogglePause={handleTogglePause}
                            onDelete={handleDelete}
                        />
                        {idx < colunas.length - 1 && <PeriodoConector />}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
