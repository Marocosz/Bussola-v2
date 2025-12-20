import React, { useState, useEffect } from 'react';
import { createPlanoTreino, updatePlanoTreino, searchExternalExercises } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

// =========================================================
// LISTA DE GRUPOS MUSCULARES (ADICIONE OU REMOVA AQUI)
// =========================================================
const GRUPOS_MUSCULARES = [
    "Peito",
    "Costas",
    "Quadríceps",
    "Posterior",
    "Glúteos",
    "Panturrilhas",
    "Ombros",
    "Bíceps",
    "Tríceps",
    "Antebraço",
    "Abdominais",
    "Outros"
];

export function TreinoModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomePlano, setNomePlano] = useState('');
    // REMOVIDO: const [descricao, setDescricao] = useState('');
    const [dias, setDias] = useState([{ nome: 'Treino A', exercicios: [] }]);

    // Estados para busca externa
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeSearch, setActiveSearch] = useState(null);

    // Efeito para carregar dados (Deep Copy)
    useEffect(() => {
        if (initialData) {
            setNomePlano(initialData.nome);
            // REMOVIDO: setDescricao(initialData.descricao || '');
            if (initialData.dias && initialData.dias.length > 0) {
                setDias(JSON.parse(JSON.stringify(initialData.dias)));
            } else {
                setDias([{ nome: 'Treino A', exercicios: [] }]);
            }
        } else {
            setNomePlano('');
            setDias([{ nome: 'Treino A', exercicios: [] }]);
        }
    }, [initialData]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                try {
                    const data = await searchExternalExercises(searchQuery);
                    setSearchResults(data);
                } catch (error) {
                    console.error("Erro na busca de exercícios");
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectExercise = (ex, dIndex, eIndex) => {
        setDias(prevDias => prevDias.map((dia, i) => {
            if (i !== dIndex) return dia;
            const newExercicios = [...dia.exercicios];
            newExercicios[eIndex] = {
                ...newExercicios[eIndex],
                nome_exercicio: ex.nome,
                grupo_muscular: ex.grupo_sugerido
            };
            return { ...dia, exercicios: newExercicios };
        }));
        setSearchResults([]);
        setActiveSearch(null);
    };

    const addDia = () => {
        setDias(prev => [...prev, { nome: `Treino ${String.fromCharCode(65 + prev.length)}`, exercicios: [] }]);
    };

    const removeDia = (index) => {
        setDias(prev => prev.filter((_, i) => i !== index));
    };

    const handleDiaChange = (index, value) => {
        setDias(prevDias => prevDias.map((dia, i) => 
            i === index ? { ...dia, nome: value } : dia
        ));
    };

    const addExercicio = (diaIndex) => {
        setDias(prevDias => prevDias.map((dia, i) => {
            if (i !== diaIndex) return dia;
            return {
                ...dia,
                exercicios: [
                    ...dia.exercicios,
                    {
                        nome_exercicio: '',
                        series: 3,
                        repeticoes_min: 8,
                        repeticoes_max: 12,
                        // REMOVIDO: carga_prevista
                        grupo_muscular: 'Outros'
                    }
                ]
            };
        }));
    };

    const removeExercicio = (diaIndex, exIndex) => {
        setDias(prevDias => prevDias.map((dia, i) => {
            if (i !== diaIndex) return dia;
            return {
                ...dia,
                exercicios: dia.exercicios.filter((_, j) => j !== exIndex)
            };
        }));
    };

    const handleExercicioChange = (diaIndex, exIndex, field, value) => {
        setDias(prevDias => prevDias.map((dia, i) => {
            if (i !== diaIndex) return dia;
            
            const newExercicios = dia.exercicios.map((ex, j) => {
                if (j !== exIndex) return ex;
                return { ...ex, [field]: value };
            });

            return { ...dia, exercicios: newExercicios };
        }));

        if (field === 'nome_exercicio') {
            setSearchQuery(value);
            setActiveSearch({ dIndex: diaIndex, eIndex: exIndex });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                nome: nomePlano,
                // REMOVIDO: descricao
                ativo: initialData ? initialData.ativo : true,
                dias: dias.map((dia, idx) => ({
                    nome: dia.nome,
                    ordem: idx,
                    exercicios: dia.exercicios.map(ex => ({
                        nome_exercicio: ex.nome_exercicio,
                        api_id: ex.api_id,
                        grupo_muscular: ex.grupo_muscular,
                        series: parseInt(ex.series) || 0,
                        repeticoes_min: parseInt(ex.repeticoes_min) || 0,
                        repeticoes_max: parseInt(ex.repeticoes_max) || 0,
                        // REMOVIDO: carga_prevista
                        descanso_segundos: ex.descanso_segundos,
                        observacao: ex.observacao
                    }))
                }))
            };

            if (initialData && initialData.id) {
                await updatePlanoTreino(initialData.id, payload);
            } else {
                await createPlanoTreino(payload);
            }

            addToast({ 
                type: 'success', 
                title: initialData ? 'Plano Atualizado!' : 'Plano Criado!', 
                description: 'Seu cronograma de treinos foi sincronizado.' 
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar plano de treino.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ritmo-scope modal-overlay">
            <div className="modal-content" style={{ maxWidth: '850px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                            {initialData ? `Editar: ${initialData.nome}` : 'Configurar Novo Treino'}
                        </h2>
                        <button className="close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Simplificado para apenas o Nome */}
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Nome do Plano</label>
                            <input className="form-input" type="text" value={nomePlano} onChange={e => setNomePlano(e.target.value)} placeholder="Ex: Push Pull Legs" required />
                        </div>

                        <div className="days-container">
                            {dias.map((dia, dIndex) => (
                                <div key={dIndex} className="day-block" style={{ marginBottom: '1.5rem', background: 'var(--cor-card-secundario)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--cor-borda)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <input className="form-input" style={{ fontWeight: 'bold', color: 'var(--cor-azul-primario)', background: 'transparent', border: 'none', fontSize: '1rem', width: 'auto' }} type="text" value={dia.nome} onChange={(e) => handleDiaChange(dIndex, e.target.value)} />
                                        {dias.length > 1 && (
                                            <button type="button" onClick={() => removeDia(dIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-vermelho-delete)', cursor: 'pointer' }}><i className="fa-solid fa-trash-can"></i></button>
                                        )}
                                    </div>

                                    {dia.exercicios.map((ex, eIndex) => (
                                        <div key={eIndex} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.6fr 0.6fr 0.6fr 30px', gap: '8px', alignItems: 'end', marginBottom: '8px', position: 'relative' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Exercício</label>
                                                <input className="form-input" style={{ height: '35px', padding: '0 5px' }} type="text" value={ex.nome_exercicio} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'nome_exercicio', e.target.value)} required autoComplete="off" />
                                                
                                                {activeSearch?.dIndex === dIndex && activeSearch?.eIndex === eIndex && searchResults.length > 0 && (
                                                    <div className="search-results-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--cor-card-principal)', border: '1px solid var(--cor-borda)', zIndex: 10, borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                        {searchResults.map((exercise, fIdx) => (
                                                            <div key={fIdx} onClick={() => handleSelectExercise(exercise, dIndex, eIndex)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cor-borda)', fontSize: '0.8rem' }}>
                                                                <strong>{exercise.nome}</strong> <small style={{ color: 'var(--cor-texto-secundario)' }}>({exercise.grupo_sugerido})</small>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Grupo</label>
                                                <select 
                                                    className="form-input" 
                                                    style={{ height: '35px', padding: '0 5px' }} 
                                                    value={ex.grupo_muscular} 
                                                    onChange={(e) => handleExercicioChange(dIndex, eIndex, 'grupo_muscular', e.target.value)}
                                                >
                                                    {GRUPOS_MUSCULARES.map(grupo => (
                                                        <option key={grupo} value={grupo}>
                                                            {grupo}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Sets</label>
                                                <input className="form-input" style={{ height: '35px', padding: '0 5px' }} type="number" value={ex.series} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'series', e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Min</label>
                                                <input className="form-input" style={{ height: '35px', padding: '0 5px' }} type="number" value={ex.repeticoes_min} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'repeticoes_min', e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Max</label>
                                                <input className="form-input" style={{ height: '35px', padding: '0 5px' }} type="number" value={ex.repeticoes_max} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'repeticoes_max', e.target.value)} />
                                            </div>
                                            {/* REMOVIDO: Input de Carga (Kg) */}
                                            <button type="button" onClick={() => removeExercicio(dIndex, eIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', paddingBottom: '10px' }}><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                    ))}

                                    <button type="button" onClick={() => addExercicio(dIndex)} style={{ marginTop: '10px', fontSize: '0.75rem', background: 'transparent', border: '1px dashed var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}>+ Add Exercício</button>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="btn-secondary" onClick={addDia} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--cor-borda)', background: 'var(--cor-card-secundario)', cursor: 'pointer', color: 'var(--cor-texto-principal)' }}><i className="fa-solid fa-calendar-plus"></i> Adicionar Dia de Treino</button>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Criar Plano')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}