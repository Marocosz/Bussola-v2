import React, { useState, useEffect } from 'react';
import { createPlanoTreino, searchExternalExercises } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function TreinoModal({ onClose, onSuccess }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomePlano, setNomePlano] = useState('');
    const [descricao, setDescricao] = useState('');
    const [dias, setDias] = useState([{ nome: 'Treino A', exercicios: [] }]);

    // Estados para busca externa
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeSearch, setActiveSearch] = useState(null); // { dIndex, eIndex }

    // Lógica de Busca com Debounce
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
        const newDias = [...dias];
        newDias[dIndex].exercicios[eIndex] = {
            ...newDias[dIndex].exercicios[eIndex],
            nome_exercicio: ex.nome,
            grupo_muscular: ex.grupo_sugerido
        };
        setDias(newDias);
        setSearchResults([]);
        setActiveSearch(null);
    };

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

    const addExercicio = (diaIndex) => {
        const newDias = [...dias];
        newDias[diaIndex].exercicios.push({
            nome_exercicio: '',
            series: 3,
            repeticoes_min: 8,
            repeticoes_max: 12,
            carga_prevista: '',
            grupo_muscular: 'Outros'
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
                descricao: descricao,
                ativo: true,
                dias: dias.map((dia, idx) => ({
                    nome: dia.nome,
                    ordem: idx,
                    exercicios: dia.exercicios.map(ex => ({
                        ...ex,
                        series: parseInt(ex.series) || 0,
                        repeticoes_min: parseInt(ex.repeticoes_min) || 0,
                        repeticoes_max: parseInt(ex.repeticoes_max) || 0,
                        carga_prevista: ex.carga_prevista ? parseFloat(ex.carga_prevista) : null
                    }))
                }))
            };
            await createPlanoTreino(payload);
            addToast({ type: 'success', title: 'Plano Criado!', description: 'Treino ativado com sucesso.' });
            onSuccess();
            onClose();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar plano de treino.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ritmo-scope modal-overlay">
            <div className="modal-content" style={{ maxWidth: '850px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Configurar Novo Treino</h2>
                        <button className="close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row grid-60-40" style={{ display: 'grid', gridTemplateColumns: '60fr 40fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label>Nome do Plano</label>
                                <input className="form-input" type="text" value={nomePlano} onChange={e => setNomePlano(e.target.value)} placeholder="Ex: Push Pull Legs" required />
                            </div>
                            <div className="form-group">
                                <label>Foco / Descrição</label>
                                <input className="form-input" type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Opcional" />
                            </div>
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
                                        <div key={eIndex} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.6fr 0.6fr 0.6fr 0.8fr 30px', gap: '8px', alignItems: 'end', marginBottom: '8px', position: 'relative' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Exercício</label>
                                                <input className="form-input" style={{ height: '35px', padding: '0 5px' }} type="text" value={ex.nome_exercicio} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'nome_exercicio', e.target.value)} required autoComplete="off" />
                                                
                                                {/* Dropdown de Sugestões API */}
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
                                                <select className="form-input" style={{ height: '35px', padding: '0 5px' }} value={ex.grupo_muscular} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'grupo_muscular', e.target.value)}>
                                                    <option value="Peito">Peito</option>
                                                    <option value="Costas">Costas</option>
                                                    <option value="Pernas">Pernas</option>
                                                    <option value="Ombros">Ombros</option>
                                                    <option value="Bíceps">Bíceps</option>
                                                    <option value="Tríceps">Tríceps</option>
                                                    <option value="Abdominais">Abs</option>
                                                    <option value="Outros">Outros</option>
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
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Kg</label>
                                                <input className="form-input" style={{ height: '35px', padding: '0 5px' }} type="number" value={ex.carga_prevista} onChange={(e) => handleExercicioChange(dIndex, eIndex, 'carga_prevista', e.target.value)} />
                                            </div>
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
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Criar Plano'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}