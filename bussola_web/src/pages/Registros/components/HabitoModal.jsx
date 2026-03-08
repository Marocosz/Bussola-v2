import { useState, useEffect } from 'react';
import { createHabito, updateHabito } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';
import '../styles.css';

const DIAS = [
    { key: 'seg', label: 'S' },
    { key: 'ter', label: 'T' },
    { key: 'qua', label: 'Q' },
    { key: 'qui', label: 'Q' },
    { key: 'sex', label: 'S' },
    { key: 'sab', label: 'S' },
    { key: 'dom', label: 'D' },
];

const TODOS_DIAS = DIAS.map(d => d.key);

const CORES_PRESET = [
    '#4A6DFF', '#8B5CF6', '#EC4899', '#EF4444',
    '#F59E0B', '#10B981', '#06B6D4', '#64748B',
];

const ESTADO_INICIAL = {
    titulo: '',
    descricao: '',
    horario: '07:00',
    frequencia: TODOS_DIAS,
    duracao_min: 15,
    cor: '#4A6DFF',
};

export function HabitoModal({ active, closeModal, onUpdate, editingData }) {
    const [form, setForm] = useState(ESTADO_INICIAL);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const isEditing = !!editingData;

    useEffect(() => {
        if (active) {
            if (editingData) {
                setForm({
                    titulo: editingData.titulo || '',
                    descricao: editingData.descricao || '',
                    horario: editingData.horario || '07:00',
                    frequencia: editingData.frequencia || TODOS_DIAS,
                    duracao_min: editingData.duracao_min || 15,
                    cor: editingData.cor || '#4A6DFF',
                });
            } else {
                setForm(ESTADO_INICIAL);
            }
        }
    }, [active, editingData]);

    const toggleDia = (key) => {
        setForm(prev => {
            const jaIncluido = prev.frequencia.includes(key);
            if (jaIncluido && prev.frequencia.length === 1) return prev; // mínimo 1 dia
            return {
                ...prev,
                frequencia: jaIncluido
                    ? prev.frequencia.filter(d => d !== key)
                    : [...prev.frequencia, key],
            };
        });
    };

    const selecionarPreset = (preset) => {
        if (preset === 'todos') {
            setForm(prev => ({ ...prev, frequencia: TODOS_DIAS }));
        } else if (preset === 'uteis') {
            setForm(prev => ({ ...prev, frequencia: ['seg','ter','qua','qui','sex'] }));
        } else if (preset === 'fim') {
            setForm(prev => ({ ...prev, frequencia: ['sab','dom'] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.titulo.trim()) return;
        if (!form.horario) return;

        setLoading(true);
        try {
            const payload = {
                titulo: form.titulo.trim(),
                descricao: form.descricao.trim() || null,
                horario: form.horario,
                frequencia: form.frequencia,
                duracao_min: Number(form.duracao_min),
                cor: form.cor,
            };

            if (isEditing) {
                await updateHabito(editingData.id, payload);
                addToast({ type: 'success', title: 'Hábito atualizado', description: '' });
            } else {
                await createHabito(payload);
                addToast({ type: 'success', title: 'Hábito criado!', description: 'Adicionado à sua Jornada.' });
            }
            onUpdate();
            closeModal();
        } catch (err) {
            console.error(err);
            addToast({ type: 'error', title: 'Erro', description: 'Não foi possível salvar o hábito.' });
        } finally {
            setLoading(false);
        }
    };

    if (!active) return null;

    return (
        <BaseModal onClose={closeModal} className="registros-scope">
            <div className="modal-content habito-modal-content">
                <div className="modal-header">
                    <h2>{isEditing ? 'Editar Hábito' : 'Novo Hábito'}</h2>
                    <span className="close-btn" onClick={closeModal}>&times;</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">

                        {/* Título */}
                        <div className="form-group">
                            <label className="form-label">Título *</label>
                            <input
                                className="form-input"
                                placeholder="Ex: Meditação matinal"
                                value={form.titulo}
                                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                                required
                                maxLength={200}
                                autoFocus
                            />
                        </div>

                        {/* Descrição */}
                        <div className="form-group">
                            <label className="form-label">Descrição</label>
                            <textarea
                                className="form-input"
                                style={{ resize: 'none', height: '80px', paddingTop: '12px' }}
                                placeholder="Detalhes ou motivação..."
                                value={form.descricao}
                                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                            />
                        </div>

                        {/* Horário + Duração */}
                        <div className="form-row-2col">
                            <div className="form-group">
                                <label className="form-label">Horário</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={form.horario}
                                    onChange={e => setForm(p => ({ ...p, horario: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Duração (min)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min={1}
                                    max={480}
                                    value={form.duracao_min}
                                    onChange={e => setForm(p => ({ ...p, duracao_min: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Frequência */}
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label className="form-label" style={{ margin: 0 }}>Frequência</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {[
                                        { id: 'todos', label: 'Todo dia' },
                                        { id: 'uteis', label: 'Dias úteis' },
                                        { id: 'fim', label: 'Final de semana' },
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className="habito-freq-preset"
                                            onClick={() => selecionarPreset(p.id)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="habito-dias-selector">
                                {DIAS.map((d, i) => (
                                    <button
                                        key={d.key}
                                        type="button"
                                        className={`habito-dia-btn ${form.frequencia.includes(d.key) ? 'selected' : ''}`}
                                        onClick={() => toggleDia(d.key)}
                                        style={form.frequencia.includes(d.key) ? { backgroundColor: form.cor, borderColor: form.cor } : {}}
                                        title={DIAS[i].key}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Cor */}
                        <div className="form-group">
                            <label className="form-label">Cor</label>
                            <div className="habito-cores-wrapper">
                                {CORES_PRESET.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`habito-cor-btn ${form.cor === c ? 'selected' : ''}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setForm(p => ({ ...p, cor: c }))}
                                    />
                                ))}
                                <label className="habito-cor-custom-wrapper" title="Cor personalizada">
                                    <i className="fa-solid fa-palette"></i>
                                    <input
                                        type="color"
                                        className="habito-cor-custom-input"
                                        value={form.cor}
                                        onChange={e => setForm(p => ({ ...p, cor: e.target.value }))}
                                    />
                                </label>
                            </div>
                        </div>



                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-secondary" onClick={closeModal} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading || !form.titulo.trim()}>
                            {loading
                                ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Salvando...</>
                                : isEditing ? 'Salvar alterações' : 'Criar Hábito'
                            }
                        </button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}
