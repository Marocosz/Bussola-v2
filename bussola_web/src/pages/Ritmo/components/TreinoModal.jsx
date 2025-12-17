import React, { useState } from 'react';
import { createPlanoTreino } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function TreinoModal({ onClose, onSuccess }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Estado do Plano
    const [nomePlano, setNomePlano] = useState('');
    const [descricao, setDescricao] = useState('');
    
    // Estado dos Dias (Array dinâmico)
    const [dias, setDias] = useState([
        { nome: 'Treino A', exercicios: [] }
    ]);

    // --- Gerenciamento de Dias ---
    const addDia = () => {
        setDias([...dias, { nome: `Treino ${String.fromCharCode(65 + dias.length)}`, exercicios: [] }]);
    };

    const removeDia = (index) => {
        const newDias = [...dias];
        newDias.splice(index, 1);
        setDias(newDias);
    };

    const handleDiaChange = (index, value) => {
        const newDias = [...dias];
        newDias[index].nome = value;
        setDias(newDias);
    };

    // --- Gerenciamento de Exercícios ---
    const addExercicio = (diaIndex) => {
        const newDias = [...dias];
        newDias[diaIndex].exercicios.push({
            nome_exercicio: '',
            series: 3,
            repeticoes_min: 8,
            repeticoes_max: 12,
            carga_prevista: ''
        });
        setDias(newDias);
    };

    const removeExercicio = (diaIndex, exIndex) => {
        const newDias = [...dias];
        newDias[diaIndex].exercicios.splice(exIndex, 1);
        setDias(newDias);
    };

    const handleExercicioChange = (diaIndex, exIndex, field, value) => {
        const newDias = [...dias];
        newDias[diaIndex].exercicios[exIndex][field] = value;
        setDias(newDias);
    };

    // --- Envio ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);

            // Monta payload
            const payload = {
                nome: nomePlano,
                descricao: descricao,
                ativo: true, // Já cria ativado
                dias: dias.map((dia, idx) => ({
                    nome: dia.nome,
                    ordem: idx,
                    exercicios: dia.exercicios.map(ex => ({
                        ...ex,
                        series: parseInt(ex.series),
                        repeticoes_min: parseInt(ex.repeticoes_min),
                        repeticoes_max: parseInt(ex.repeticoes_max),
                        carga_prevista: ex.carga_prevista ? parseFloat(ex.carga_prevista) : null
                    }))
                }))
            };

            await createPlanoTreino(payload);
            addToast({ type: 'success', title: 'Plano Criado!', description: 'Seu novo treino já está ativo.' });
            onSuccess();
            onClose();

        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar plano de treino.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto'}}>
                <div className="modal-header">
                    <h2>Novo Plano de Treino</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nome do Plano</label>
                        <input type="text" value={nomePlano} onChange={e => setNomePlano(e.target.value)} placeholder="Ex: Hipertrofia 2025" required />
                    </div>
                    <div className="form-group">
                        <label>Descrição (Opcional)</label>
                        <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Foco em força base..." />
                    </div>

                    <hr className="modal-divider" />

                    <div className="days-container">
                        {dias.map((dia, dIndex) => (
                            <div key={dIndex} className="day-block" style={{marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                                    <input 
                                        type="text" 
                                        value={dia.nome} 
                                        onChange={(e) => handleDiaChange(dIndex, e.target.value)}
                                        style={{fontWeight: 'bold', color: 'var(--primary-color)'}}
                                    />
                                    {dias.length > 1 && (
                                        <button type="button" className="btn-icon-small" onClick={() => removeDia(dIndex)} style={{color: '#ff4444'}}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    )}
                                </div>

                                {/* Lista de Exercícios */}
                                {dia.exercicios.map((ex, eIndex) => (
                                    <div key={eIndex} style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 30px', gap: '8px', alignItems: 'end', marginBottom: '8px'}}>
                                        <div className="form-group-compact">
                                            <label style={{fontSize:'0.7rem'}}>Exercício</label>
                                            <input type="text" placeholder="Nome" value={ex.nome_exercicio} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'nome_exercicio', e.target.value)} required />
                                        </div>
                                        <div className="form-group-compact">
                                            <label style={{fontSize:'0.7rem'}}>Séries</label>
                                            <input type="number" value={ex.series} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'series', e.target.value)} />
                                        </div>
                                        <div className="form-group-compact">
                                            <label style={{fontSize:'0.7rem'}}>Reps Min</label>
                                            <input type="number" value={ex.repeticoes_min} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'repeticoes_min', e.target.value)} />
                                        </div>
                                        <div className="form-group-compact">
                                            <label style={{fontSize:'0.7rem'}}>Reps Max</label>
                                            <input type="number" value={ex.repeticoes_max} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'repeticoes_max', e.target.value)} />
                                        </div>
                                        <div className="form-group-compact">
                                            <label style={{fontSize:'0.7rem'}}>Kg (Meta)</label>
                                            <input type="number" value={ex.carga_prevista} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'carga_prevista', e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => removeExercicio(dIndex, eIndex)} style={{background:'none', border:'none', color:'#666', cursor:'pointer', marginBottom:'10px'}}>
                                            <i className="fa-solid fa-times"></i>
                                        </button>
                                    </div>
                                ))}

                                <button type="button" className="btn-secondary-small" onClick={() => addExercicio(dIndex)} style={{marginTop: '5px', fontSize: '0.8rem'}}>
                                    + Adicionar Exercício
                                </button>
                            </div>
                        ))}
                    </div>

                    <button type="button" className="btn-secondary" onClick={addDia} style={{width: '100%', marginBottom: '20px'}}>
                        + Adicionar Dia de Treino
                    </button>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : 'Criar Plano'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}