import { useState } from 'react';
import { toggleStatusHabito, deleteHabito } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmDialogContext';
import { BaseModal } from '../../../components/BaseModal';
import '../styles.css';

// ─── Constantes ──────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
    { key: 'seg', label: 'Seg', full: 'Segunda-feira' },
    { key: 'ter', label: 'Ter', full: 'Terça-feira' },
    { key: 'qua', label: 'Qua', full: 'Quarta-feira' },
    { key: 'qui', label: 'Qui', full: 'Quinta-feira' },
    { key: 'sex', label: 'Sex', full: 'Sexta-feira' },
    { key: 'sab', label: 'Sáb', full: 'Sábado' },
    { key: 'dom', label: 'Dom', full: 'Domingo' },
];

const STATUS_CONFIG = {
    ativo:     { label: 'Ativo',     color: '#10b981' },
    pausado:   { label: 'Pausado',   color: '#94a3b8' },
    arquivado: { label: 'Arquivado', color: '#64748b' },
};

function getTodayKey() {
    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return dias[new Date().getDay()];
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function FrequenciaDisplay({ frequencia, cor }) {
    return (
        <div className="hl-freq-display">
            {DIAS_SEMANA.map(d => (
                <span
                    key={d.key}
                    className={`hl-freq-dot ${frequencia.includes(d.key) ? 'active' : ''}`}
                    style={frequencia.includes(d.key) ? { backgroundColor: cor, borderColor: cor } : {}}
                    title={d.full}
                >
                    {d.label[0]}
                </span>
            ))}
        </div>
    );
}

function HabitoRow({ habito, onEdit, onTogglePause, onDelete }) {
    const statusCfg = STATUS_CONFIG[habito.status] ?? STATUS_CONFIG.ativo;

    return (
        <div className="hl-row">
            {/* Barra de cor lateral */}
            <div className="hl-color-bar" style={{ backgroundColor: habito.cor }} />

            {/* Horário */}
            <div className="hl-cell hl-cell-time">
                <span className="hl-time-badge">{habito.horario}</span>
            </div>

            {/* Título + Descrição */}
            <div className="hl-cell hl-cell-title">
                <span className="hl-titulo" title={habito.titulo}>{habito.titulo}</span>
                {habito.descricao && (
                    <span className="hl-descricao" title={habito.descricao}>
                        {habito.descricao}
                    </span>
                )}
            </div>

            {/* Duração */}
            <div className="hl-cell hl-cell-duration">
                <span className="hl-dur-badge">
                    <i className="fa-regular fa-clock"></i>
                    {habito.duracao_min}min
                </span>
            </div>

            {/* Frequência */}
            <div className="hl-cell hl-cell-freq">
                <FrequenciaDisplay frequencia={habito.frequencia} cor={habito.cor} />
            </div>

            {/* Status */}
            <div className="hl-cell hl-cell-status">
                <span
                    className="hl-status-badge"
                    style={{
                        color: statusCfg.color,
                        backgroundColor: `${statusCfg.color}1a`,
                        borderColor: `${statusCfg.color}40`,
                    }}
                >
                    <span className="hl-status-dot" style={{ backgroundColor: statusCfg.color }} />
                    {statusCfg.label}
                </span>
            </div>

            {/* Ações */}
            <div className="hl-cell hl-cell-actions">
                <button
                    className="btn-action-icon btn-edit"
                    onClick={() => onEdit(habito)}
                    title="Editar hábito"
                >
                    <i className="fa-solid fa-pen-to-square"></i>
                </button>
                <button
                    className="btn-action-icon btn-pause"
                    onClick={() => onTogglePause(habito)}
                    title={habito.status === 'pausado' ? 'Retomar hábito' : 'Pausar hábito'}
                >
                    <i className={`fa-solid ${habito.status === 'pausado' ? 'fa-play' : 'fa-pause'}`}></i>
                </button>
                <button
                    className="btn-action-icon btn-delete"
                    onClick={() => onDelete(habito)}
                    title="Excluir hábito"
                >
                    <i className="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function HabitoListaModal({ active, closeModal, habitos, onEdit, onUpdate }) {
    const hoje = getTodayKey();
    const [filtroDia, setFiltroDia] = useState(hoje);

    const { addToast } = useToast();
    const dialogConfirm = useConfirm();

    if (!active) return null;

    const habitosFiltrados = [...habitos]
        .filter(h => filtroDia === 'todos' || h.frequencia.includes(filtroDia))
        .sort((a, b) => a.horario.localeCompare(b.horario));

    const handleTogglePause = async (habito) => {
        try {
            await toggleStatusHabito(habito.id);
            onUpdate();
            addToast({
                type: 'info',
                title: habito.status === 'ativo' ? 'Hábito pausado.' : 'Hábito retomado!',
                description: '',
            });
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

    return (
        <BaseModal onClose={closeModal} className="registros-scope">
            <div className="modal-content hl-modal-content">

                {/* Cabeçalho */}
                <div className="modal-header">
                    <div className="hl-modal-title">
                        <i className="fa-solid fa-list-ul" style={{ color: 'var(--cor-azul-primario)', fontSize: '1rem' }}></i>
                        <h2>Todos os Hábitos</h2>
                        {habitos.length > 0 && (
                            <span className="hl-count-badge">{habitos.length}</span>
                        )}
                    </div>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>

                {/* Filtro por dia da semana */}
                <div className="hl-day-filter">
                    <button
                        className={`hl-day-btn ${filtroDia === 'todos' ? 'active' : ''}`}
                        onClick={() => setFiltroDia('todos')}
                    >
                        Todos
                        <span className="hl-day-count">{habitos.length}</span>
                    </button>

                    {DIAS_SEMANA.map(d => {
                        const count = habitos.filter(h => h.frequencia.includes(d.key)).length;
                        const isToday = d.key === hoje;
                        return (
                            <button
                                key={d.key}
                                className={`hl-day-btn ${filtroDia === d.key ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                                onClick={() => setFiltroDia(d.key)}
                                title={d.full}
                            >
                                {d.label}
                                {count > 0 && (
                                    <span className="hl-day-count">{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Corpo — lista de hábitos */}
                <div className="hl-list-container">
                    {habitosFiltrados.length === 0 ? (
                        <div className="hl-empty">
                            <i className="fa-regular fa-calendar-xmark"></i>
                            <p>Nenhum hábito para este dia da semana.</p>
                        </div>
                    ) : (
                        <>
                            {/* Cabeçalho da tabela */}
                            <div className="hl-table-head">
                                <div className="hl-th-spacer" />
                                <span className="hl-th hl-th-time">Horário</span>
                                <span className="hl-th hl-th-title">Hábito</span>
                                <span className="hl-th hl-th-duration">Duração</span>
                                <span className="hl-th hl-th-freq">Frequência</span>
                                <span className="hl-th hl-th-status">Status</span>
                                <span className="hl-th hl-th-actions">Ações</span>
                            </div>

                            {/* Linhas */}
                            <div className="hl-table-body">
                                {habitosFiltrados.map(habito => (
                                    <HabitoRow
                                        key={habito.id}
                                        habito={habito}
                                        onEdit={onEdit}
                                        onTogglePause={handleTogglePause}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Rodapé */}
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={closeModal}>
                        Fechar
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}