import React, { useState, useEffect } from 'react';
import { createDieta, updateDieta, searchLocalFoods } from '../../../services/api'; 
import { useToast } from '../../../context/ToastContext';

export function DietaModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomeDieta, setNomeDieta] = useState('');
    // REMOVIDO: horario do estado inicial
    const [refeicoes, setRefeicoes] = useState([
        { nome: 'Café da Manhã', alimentos: [] }
    ]);

    // Estados para busca TACO
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [activeSearch, setActiveSearch] = useState(null); 

    // Efeito para carregar dados caso seja EDIÇÃO
    useEffect(() => {
        if (initialData) {
            setNomeDieta(initialData.nome);
            
            const refeicoesEdit = initialData.refeicoes.map(ref => ({
                ...ref,
                // REMOVIDO: horario
                alimentos: ref.alimentos.map(ali => ({
                    ...ali,
                    base_kcal: (ali.calorias / ali.quantidade) * 100,
                    base_prot: (ali.proteina / ali.quantidade) * 100,
                    base_carb: (ali.carbo / ali.quantidade) * 100,
                    base_gord: (ali.gordura / ali.quantidade) * 100,
                }))
            }));
            setRefeicoes(refeicoesEdit);
        }
    }, [initialData]);

    // Lógica de Busca com Debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) { 
                setSearching(true);
                try {
                    const data = await searchLocalFoods(searchQuery);
                    setSearchResults(data);
                } catch (error) {
                    console.error("Erro na busca de alimentos TACO");
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
                setSearching(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const arredondar = (valor) => Math.round(valor || 0);

    const calcularMacro = (valorBase100, qtd) => {
        if (!valorBase100) return 0;
        return arredondar((valorBase100 / 100) * qtd);
    };

    const handleSelectFood = (food, rIndex, aIndex) => {
        const newRef = [...refeicoes];
        const defaultQtd = 100;

        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            nome: food.nome,
            base_kcal: food.calorias_100g,
            base_prot: food.proteina_100g,
            base_carb: food.carbo_100g,
            base_gord: food.gordura_100g,
            quantidade: defaultQtd,
            calorias: arredondar(food.calorias_100g),
            proteina: arredondar(food.proteina_100g),
            carbo: arredondar(food.carbo_100g),
            gordura: arredondar(food.gordura_100g)
        };
        setRefeicoes(newRef);
        setSearchResults([]);
        setActiveSearch(null);
    };

    const handleSelectCustom = (rIndex, aIndex) => {
        const newRef = [...refeicoes];
        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            base_kcal: 0,
            base_prot: 0,
            base_carb: 0,
            base_gord: 0,
            calorias: 0,
            proteina: 0,
            carbo: 0,
            gordura: 0
        };
        setRefeicoes(newRef);
        setSearchResults([]);
        setActiveSearch(null);
    };

    const addRefeicao = () => {
        // REMOVIDO: horario do novo objeto
        setRefeicoes([...refeicoes, { 
            nome: `Refeição ${refeicoes.length + 1}`, 
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
            gordura: 0,
            base_kcal: 0,
            base_prot: 0,
            base_carb: 0,
            base_gord: 0
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
        const alimento = newRef[refIndex].alimentos[aliIndex];
        
        alimento[field] = value;

        if (field === 'quantidade') {
            const qtd = parseFloat(value) || 0;
            alimento.calorias = calcularMacro(alimento.base_kcal, qtd);
            alimento.proteina = calcularMacro(alimento.base_prot, qtd);
            alimento.carbo = calcularMacro(alimento.base_carb, qtd);
            alimento.gordura = calcularMacro(alimento.base_gord, qtd);
        }

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
                ativo: initialData ? initialData.ativo : true,
                refeicoes: refeicoes.map((ref, idx) => ({
                    nome: ref.nome,
                    // REMOVIDO: horario do payload
                    ordem: idx,
                    alimentos: ref.alimentos.map(ali => ({
                        nome: ali.nome,
                        quantidade: parseFloat(ali.quantidade),
                        unidade: ali.unidade,
                        calorias: arredondar(ali.calorias),
                        proteina: arredondar(ali.proteina),
                        carbo: arredondar(ali.carbo),
                        gordura: arredondar(ali.gordura)
                    }))
                }))
            };

            if (initialData && initialData.id) {
                await updateDieta(initialData.id, payload);
            } else {
                await createDieta(payload);
            }

            addToast({ 
                type: 'success', 
                title: initialData ? 'Dieta Atualizada!' : 'Dieta Criada!', 
                description: 'Seu plano nutricional foi sincronizado.' 
            });
            onSuccess();
            onClose();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar plano de dieta.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ritmo-scope modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                            {initialData ? `Editar: ${initialData.nome}` : 'Configurar Nova Dieta'}
                        </h2>
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
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '1.2rem' }}>
                                        <input 
                                            className="form-input" 
                                            style={{ fontWeight: 'bold', color: 'var(--cor-azul-primario)', background: 'transparent', border: 'none', fontSize: '1.1rem', flex: 1, padding: 0 }} 
                                            type="text" 
                                            value={ref.nome} 
                                            onChange={(e) => handleRefeicaoChange(rIndex, 'nome', e.target.value)} 
                                            placeholder="Nome da Refeição" 
                                        />
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {/* REMOVIDO: Input type="time" */}
                                            {refeicoes.length > 1 && (
                                                <button type="button" onClick={() => removeRefeicao(rIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-vermelho-delete)', cursor: 'pointer', fontSize: '1.1rem' }}>
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {ref.alimentos.map((ali, aIndex) => {
                                        const isLocked = ali.base_kcal > 0 || ali.base_prot > 0 || ali.base_carb > 0 || ali.base_gord > 0;

                                        return (
                                            <div key={aIndex} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.6fr 0.7fr 0.7fr 0.7fr 0.7fr 30px', gap: '8px', alignItems: 'end', marginBottom: '8px', position: 'relative' }}>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '0.6rem' }}>Alimento</label>
                                                    <input className="form-input" style={{ height: '32px', fontSize: '0.85rem' }} type="text" value={ali.nome} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'nome', e.target.value)} required autoComplete="off" />
                                                    
                                                    {activeSearch?.rIndex === rIndex && activeSearch?.aIndex === aIndex && (searchQuery.length >= 2) && (
                                                        <div className="search-results-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--cor-card-principal)', border: '1px solid var(--cor-borda)', zIndex: 10, borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                            
                                                            <div onClick={() => handleSelectCustom(rIndex, aIndex)} className="search-item-hover custom-option" style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '2px solid var(--cor-borda)', fontSize: '0.8rem', background: 'rgba(74, 109, 255, 0.05)' }}>
                                                                <div style={{ fontWeight: '700', color: 'var(--cor-azul-primario)' }}>
                                                                    <i className="fa-solid fa-pen-to-square" style={{marginRight: '6px'}}></i> 
                                                                    Usar "{searchQuery}" como item personalizado
                                                                </div>
                                                            </div>

                                                            {searching && (
                                                                <div style={{ padding: '15px', textAlign: 'center', color: 'var(--cor-azul-primario)' }}>
                                                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                                </div>
                                                            )}

                                                            {!searching && searchResults.map((food, fIdx) => (
                                                                <div key={fIdx} onClick={() => handleSelectFood(food, rIndex, aIndex)} className="search-item-hover" style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cor-borda)', fontSize: '0.8rem', transition: 'background 0.2s' }}>
                                                                    <div style={{ fontWeight: '600' }}>{food.nome}</div>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-secundario)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                                                                        <span><strong>{arredondar(food.calorias_100g)}</strong> kcal</span>
                                                                        <span>P: {arredondar(food.proteina_100g)}g</span>
                                                                        <span>C: {arredondar(food.carbo_100g)}g</span>
                                                                        <span>G: {arredondar(food.gordura_100g)}g</span>
                                                                    </div>
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
                                                    <select className="form-input" style={{ height: '32px', fontSize: '0.85rem', padding: '0 5px', opacity: isLocked ? 0.7 : 1 }} value={ali.unidade} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'unidade', e.target.value)} disabled={isLocked}>
                                                        <option value="g">g</option><option value="ml">ml</option><option value="un">un</option>
                                                    </select>
                                                </div>
                                                <div className="form-group"><label style={{ fontSize: '0.6rem', color: 'var(--cor-azul-primario)' }}>Kcal</label><input className="form-input" style={{ height: '32px', fontSize: '0.85rem', opacity: isLocked ? 0.7 : 1 }} type="number" value={arredondar(ali.calorias)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'calorias', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group"><label style={{ fontSize: '0.6rem' }}>P (g)</label><input className="form-input" style={{ height: '32px', fontSize: '0.85rem', opacity: isLocked ? 0.7 : 1 }} type="number" value={arredondar(ali.proteina)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'proteina', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group"><label style={{ fontSize: '0.6rem' }}>C (g)</label><input className="form-input" style={{ height: '32px', fontSize: '0.85rem', opacity: isLocked ? 0.7 : 1 }} type="number" value={arredondar(ali.carbo)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'carbo', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group"><label style={{ fontSize: '0.6rem' }}>G (g)</label><input className="form-input" style={{ height: '32px', fontSize: '0.85rem', opacity: isLocked ? 0.7 : 1 }} type="number" value={arredondar(ali.gordura)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'gordura', e.target.value)} readOnly={isLocked}/></div>
                                                <button type="button" onClick={() => removeAlimento(rIndex, aIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', paddingBottom: '8px' }}><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        );
                                    })}

                                    <button type="button" onClick={() => addAlimento(rIndex)} style={{ marginTop: '10px', fontSize: '0.7rem', background: 'transparent', border: '1px dashed var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}>+ Adicionar Alimento</button>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="btn-secondary" onClick={addRefeicao} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--cor-borda)', background: 'var(--cor-card-secundario)', cursor: 'pointer', color: 'var(--cor-texto-principal)' }}><i className="fa-solid fa-utensils"></i> Adicionar Refeição</button>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Criar Plano de Dieta')}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`.search-item-hover:hover { background-color: var(--cor-fundo-hover) !important; } .custom-option:hover { background-color: rgba(74, 109, 255, 0.15) !important; }`}</style>
        </div>
    );
}