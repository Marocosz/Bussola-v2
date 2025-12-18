import React, { useState, useEffect } from 'react';
import { createDieta, searchExternalFoods } from '../../../services/api'; 
import { useToast } from '../../../context/ToastContext';

export function DietaModal({ onClose, onSuccess }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomeDieta, setNomeDieta] = useState('');
    const [refeicoes, setRefeicoes] = useState([
        { nome: 'Café da Manhã', horario: '08:00', alimentos: [] }
    ]);

    // Estados para busca externa
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [activeSearch, setActiveSearch] = useState(null); // { rIndex, aIndex }

    // Lógica de Busca com Debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 3) {
                try {
                    const data = await searchExternalFoods(searchQuery);
                    setSearchResults(data);
                } catch (error) {
                    console.error("Erro na busca de alimentos");
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectFood = (food, rIndex, aIndex) => {
        const newRef = [...refeicoes];
        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            nome: food.nome,
            calorias: food.calorias,
            proteina: food.proteina,
            carbo: food.carbo,
            gordura: food.gordura
        };
        setRefeicoes(newRef);
        setSearchResults([]);
        setActiveSearch(null);
    };

    const addRefeicao = () => {
        setRefeicoes([...refeicoes, { 
            nome: `Refeição ${refeicoes.length + 1}`, 
            horario: '00:00', 
            alimentos: [] 
        }]);
    };

    const removeRefeicao = (index) => {
        const newRef = [...refeicoes];
        newRef.splice(index, 1);
        setRefeicoes(newRef);
    };

    const handleRefeicaoChange = (index, field, value) => {
        const newRef = [...refeicoes];
        newRef[index][field] = value;
        setRefeicoes(newRef);
    };

    const addAlimento = (refIndex) => {
        const newRef = [...refeicoes];
        newRef[refIndex].alimentos.push({
            nome: '',
            quantidade: 100,
            unidade: 'g',
            calorias: 0,
            proteina: 0,
            carbo: 0,
            gordura: 0
        });
        setRefeicoes(newRef);
    };

    const removeAlimento = (refIndex, aliIndex) => {
        const newRef = [...refeicoes];
        newRef[refIndex].alimentos.splice(aliIndex, 1);
        setRefeicoes(newRef);
    };

    const handleAlimentoChange = (refIndex, aliIndex, field, value) => {
        const newRef = [...refeicoes];
        newRef[refIndex].alimentos[aliIndex][field] = value;
        setRefeicoes(newRef);

        if (field === 'nome') {
            setSearchQuery(value);
            setActiveSearch({ rIndex: refIndex, aIndex: aliIndex });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                nome: nomeDieta,
                ativo: true,
                refeicoes: refeicoes.map((ref, idx) => ({
                    nome: ref.nome,
                    horario: ref.horario,
                    ordem: idx,
                    alimentos: ref.alimentos.map(ali => ({
                        nome: ali.nome,
                        quantidade: parseFloat(ali.quantidade),
                        unidade: ali.unidade,
                        calorias: parseFloat(ali.calorias),
                        proteina: parseFloat(ali.proteina),
                        carbo: parseFloat(ali.carbo),
                        gordura: parseFloat(ali.gordura)
                    }))
                }))
            };
            await createDieta(payload);
            addToast({ type: 'success', title: 'Dieta Criada!', description: 'Seu plano nutricional foi ativado.' });
            onSuccess();
            onClose();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao criar plano de dieta.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ritmo-scope modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Configurar Nova Dieta</h2>
                        <button className="close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Nome da Dieta / Estratégia</label>
                            <input className="form-input" type="text" value={nomeDieta} onChange={e => setNomeDieta(e.target.value)} placeholder="Ex: Cutting Verão 2025" required />
                        </div>

                        <div className="refeicoes-container">
                            {refeicoes.map((ref, rIndex) => (
                                <div key={rIndex} className="day-block" style={{ marginBottom: '1.5rem', background: 'var(--cor-card-secundario)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--cor-borda)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', gap: '10px', marginBottom: '1rem' }}>
                                        <input className="form-input" style={{ fontWeight: 'bold', color: 'var(--cor-azul-primario)', background: 'transparent', border: 'none', fontSize: '1rem' }} type="text" value={ref.nome} onChange={(e) => handleRefeicaoChange(rIndex, 'nome', e.target.value)} placeholder="Nome da Refeição" />
                                        <input className="form-input" type="time" value={ref.horario} onChange={(e) => handleRefeicaoChange(rIndex, 'horario', e.target.value)} />
                                        {refeicoes.length > 1 && (
                                            <button type="button" onClick={() => removeRefeicao(rIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-vermelho-delete)', cursor: 'pointer' }}><i className="fa-solid fa-trash-can"></i></button>
                                        )}
                                    </div>

                                    {ref.alimentos.map((ali, aIndex) => (
                                        <div key={aIndex} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.6fr 0.7fr 0.7fr 0.7fr 0.7fr 30px', gap: '8px', alignItems: 'end', marginBottom: '8px', position: 'relative' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Alimento</label>
                                                <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="text" value={ali.nome} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'nome', e.target.value)} required autoComplete="off" />
                                                
                                                {/* Dropdown de Sugestões API */}
                                                {activeSearch?.rIndex === rIndex && activeSearch?.aIndex === aIndex && searchResults.length > 0 && (
                                                    <div className="search-results-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--cor-card-principal)', border: '1px solid var(--cor-borda)', zIndex: 10, borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                        {searchResults.map((food, fIdx) => (
                                                            <div key={fIdx} onClick={() => handleSelectFood(food, rIndex, aIndex)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cor-borda)', fontSize: '0.8rem' }}>
                                                                <strong>{food.nome}</strong> <small style={{ color: 'var(--cor-texto-secundario)' }}>({food.marca})</small>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Qtd</label>
                                                <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="number" value={ali.quantidade} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'quantidade', e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>Un</label>
                                                <select className="form-input" style={{ height: '32px', fontSize: '0.85rem', padding: '0 5px' }} value={ali.unidade} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'unidade', e.target.value)}>
                                                    <option value="g">g</option>
                                                    <option value="ml">ml</option>
                                                    <option value="un">un</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem', color: 'var(--cor-azul-primario)' }}>Kcal</label>
                                                <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="number" value={ali.calorias} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'calorias', e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>P (g)</label>
                                                <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="number" value={ali.proteina} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'proteina', e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>C (g)</label>
                                                <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="number" value={ali.carbo} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'carbo', e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.6rem' }}>G (g)</label>
                                                <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="number" value={ali.gordura} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'gordura', e.target.value)} />
                                            </div>
                                            <button type="button" onClick={() => removeAlimento(rIndex, aIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', paddingBottom: '8px' }}><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                    ))}

                                    <button type="button" onClick={() => addAlimento(rIndex)} style={{ marginTop: '10px', fontSize: '0.7rem', background: 'transparent', border: '1px dashed var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}>+ Adicionar Alimento</button>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="btn-secondary" onClick={addRefeicao} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--cor-borda)', background: 'var(--cor-card-secundario)', cursor: 'pointer', color: 'var(--cor-texto-principal)' }}><i className="fa-solid fa-utensils"></i> Adicionar Refeição</button>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Criar Plano de Dieta'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}