import React, { useState, useEffect } from 'react';
import { createDieta, updateDieta, searchLocalFoods } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';
import { CustomSelect } from '../../../components/CustomSelect'; 
import { BaseModal } from '../../../components/BaseModal';

export function DietaModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nomeDieta, setNomeDieta] = useState('');
    const [refeicoes, setRefeicoes] = useState([{ nome: 'Café da Manhã', alimentos: [] }]);
    const unitOptions = [{ value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }, { value: 'un', label: 'un' }];
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [activeSearch, setActiveSearch] = useState(null); 

    useEffect(() => {
        if (initialData) {
            setNomeDieta(initialData.nome);
            const refeicoesEdit = initialData.refeicoes.map(ref => ({
                ...ref,
                alimentos: ref.alimentos.map(ali => ({
                    ...ali,
                    base_kcal: 0, base_prot: 0, base_carb: 0, base_gord: 0,
                    isTacoItem: false,
                }))
            }));
            setRefeicoes(refeicoesEdit);
        }
    }, [initialData]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) { 
                setSearching(true);
                try {
                    const data = await searchLocalFoods(searchQuery);
                    setSearchResults(data);
                } catch { logger.error("Erro na busca de alimentos"); } finally { setSearching(false); }
            } else { setSearchResults([]); setSearching(false); }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const arredondar = (valor) => Math.round(valor || 0);
    const calcularMacro = (valorBase100, qtd) => (!valorBase100 ? 0 : arredondar((valorBase100 / 100) * qtd));

    const handleSelectFood = (food, rIndex, aIndex) => {
        const newRef = [...refeicoes];
        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            nome: food.nome,
            unidade: 'g',
            base_kcal: food.calorias_100g, base_prot: food.proteina_100g, base_carb: food.carbo_100g, base_gord: food.gordura_100g,
            quantidade: 100, calorias: arredondar(food.calorias_100g), proteina: arredondar(food.proteina_100g),
            carbo: arredondar(food.carbo_100g), gordura: arredondar(food.gordura_100g),
            isTacoItem: true,
        };
        setRefeicoes(newRef); setSearchResults([]); setActiveSearch(null);
    };

    const handleSelectCustom = (rIndex, aIndex) => {
        const newRef = [...refeicoes];
        newRef[rIndex].alimentos[aIndex] = {
            ...newRef[rIndex].alimentos[aIndex],
            nome: searchQuery,
            base_kcal: 0, base_prot: 0, base_carb: 0, base_gord: 0,
            calorias: 0, proteina: 0, carbo: 0, gordura: 0,
            isTacoItem: false,
        };
        setRefeicoes(newRef); setSearchResults([]); setActiveSearch(null);
    };

    const addRefeicao = () => setRefeicoes([...refeicoes, { nome: `Refeição ${refeicoes.length + 1}`, alimentos: [] }]);
    const removeRefeicao = (index) => { const newRef = [...refeicoes]; newRef.splice(index, 1); setRefeicoes(newRef); };
    const handleRefeicaoChange = (index, field, value) => { const newRef = [...refeicoes]; newRef[index][field] = value; setRefeicoes(newRef); };
    const addAlimento = (refIndex) => { const newRef = [...refeicoes]; newRef[refIndex].alimentos.push({ nome: '', quantidade: 100, unidade: 'g', calorias: 0, proteina: 0, carbo: 0, gordura: 0, base_kcal: 0, base_prot: 0, base_carb: 0, base_gord: 0, isTacoItem: false }); setRefeicoes(newRef); };
    const removeAlimento = (refIndex, aliIndex) => { const newRef = [...refeicoes]; newRef[refIndex].alimentos.splice(aliIndex, 1); setRefeicoes(newRef); };

    const handleAlimentoChange = (refIndex, aliIndex, field, value) => {
        const newRef = [...refeicoes];
        const alimento = newRef[refIndex].alimentos[aliIndex];
        alimento[field] = value;
        if (field === 'quantidade' && alimento.isTacoItem) {
            const qtd = parseFloat(value) || 0;
            alimento.calorias = calcularMacro(alimento.base_kcal, qtd);
            alimento.proteina = calcularMacro(alimento.base_prot, qtd);
            alimento.carbo = calcularMacro(alimento.base_carb, qtd);
            alimento.gordura = calcularMacro(alimento.base_gord, qtd);
        }
        setRefeicoes(newRef);
        if (field === 'nome') { setSearchQuery(value); setActiveSearch({ rIndex: refIndex, aIndex: aliIndex }); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                nome: nomeDieta, ativo: initialData ? initialData.ativo : true,
                refeicoes: refeicoes.map((ref, idx) => ({
                    nome: ref.nome, ordem: idx,
                    alimentos: ref.alimentos.map(ali => ({
                        nome: ali.nome, quantidade: parseFloat(ali.quantidade), unidade: ali.unidade,
                        calorias: arredondar(ali.calorias), proteina: arredondar(ali.proteina),
                        carbo: arredondar(ali.carbo), gordura: arredondar(ali.gordura)
                    }))
                }))
            };
            if (initialData && initialData.id) await updateDieta(initialData.id, payload); else await createDieta(payload);
            addToast({ type: 'success', title: 'Sucesso', description: 'Plano salvo.' });
            onSuccess(); onClose();
        } catch { addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar.' }); } finally { setLoading(false); }
    };

    return (
        <BaseModal onClose={onClose} className="ritmo-scope" sheet="full">
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%' }}>
                <div className="modal-header">
                    <div className="rb-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 className="rb-title" style={{ margin: 0, fontSize: '1.2rem' }}>{initialData ? `Editar: ${initialData.nome}` : 'Configurar Dieta'}</h2>
                        <button type="button" className="close-btn" aria-label="Fechar" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-secundario)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group rb-name-group">
                            <label>Nome da Dieta</label>
                            <input className="form-input" type="text" value={nomeDieta} onChange={e => setNomeDieta(e.target.value)} placeholder="Ex: Cutting 2025" required />
                        </div>
                        <div className="refeicoes-container">
                            {refeicoes.map((ref, rIndex) => (
                                <div key={rIndex} className="day-block">
                                    <div className="rb-day-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '1.2rem' }}>
                                        <input className="form-input rb-day-name" style={{ fontWeight: 'bold', color: 'var(--cor-azul-primario)', background: 'transparent', border: 'none', fontSize: '1.1rem', flex: 1, padding: 0 }} type="text" value={ref.nome} onChange={(e) => handleRefeicaoChange(rIndex, 'nome', e.target.value)} placeholder="Nome da Refeição" />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {refeicoes.length > 1 && (<button type="button" className="rb-icon-btn" aria-label="Remover refeição" onClick={() => removeRefeicao(rIndex)} style={{ background: 'none', border: 'none', color: 'var(--cor-vermelho-delete)', cursor: 'pointer', fontSize: '1.1rem' }}><i className="fa-solid fa-trash-can"></i></button>)}
                                        </div>
                                    </div>
                                    {ref.alimentos.map((ali, aIndex) => {
                                        const isLocked = ali.isTacoItem;
                                        const lockStyle = { opacity: isLocked ? 0.7 : 1 };
                                        return (
                                            // Desktop: 8 colunas. Celular: nome / Qtd+Un / Kcal P C G.
                                            <div key={aIndex} className="rb-food-row">
                                                <div className="form-group rb-f-nome">
                                                    <label className="rb-label">Alimento</label>
                                                    <input className="form-input" type="text" value={ali.nome} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'nome', e.target.value)} required autoComplete="off" />
                                                    {activeSearch?.rIndex === rIndex && activeSearch?.aIndex === aIndex && (searchQuery.length >= 2) && (
                                                        <div className="search-results-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--cor-card-principal)', border: '1px solid var(--cor-borda)', zIndex: 10, borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                            <div onClick={() => handleSelectCustom(rIndex, aIndex)} className="search-item-hover custom-option" style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '2px solid var(--cor-borda)', fontSize: '0.8rem', background: 'rgba(74, 109, 255, 0.05)' }}>
                                                                <div style={{ fontWeight: '700', color: 'var(--cor-azul-primario)' }}><i className="fa-solid fa-pen-to-square" style={{marginRight: '6px'}}></i> Usar "{searchQuery}" como personalizado</div>
                                                            </div>
                                                            {!searching && searchResults.map((food, fIdx) => (
                                                                <div key={fIdx} onClick={() => handleSelectFood(food, rIndex, aIndex)} className="search-item-hover" style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cor-borda)', fontSize: '0.8rem', transition: 'background 0.2s' }}>
                                                                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>{food.nome}</div>
                                                                    <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-secundario)', display: 'flex', gap: '10px' }}>
                                                                        <span>{arredondar(food.calorias_100g)} kcal</span>
                                                                        <span>P: {arredondar(food.proteina_100g)}g</span>
                                                                        <span>C: {arredondar(food.carbo_100g)}g</span>
                                                                        <span>G: {arredondar(food.gordura_100g)}g</span>
                                                                        <span style={{ color: 'var(--cor-borda)' }}>por 100g</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="form-group rb-f-qtd"><label className="rb-label">Qtd</label><input className="form-input" type="number" inputMode="decimal" value={ali.quantidade} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'quantidade', e.target.value)} /></div>
                                                <div className="form-group rb-f-un"><label className="rb-label">Un</label><div style={{ minWidth: 0 }}>{isLocked ? (<input className="form-input" style={{ opacity: 0.7 }} value="g" readOnly />) : (<CustomSelect name="unidade" value={ali.unidade} options={unitOptions} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'unidade', e.target.value)} placeholder="un" />)}</div></div>
                                                <div className="form-group rb-f-kcal"><label className="rb-label">Kcal</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.calorias)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'calorias', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group rb-f-p"><label className="rb-label">P</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.proteina)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'proteina', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group rb-f-c"><label className="rb-label">C</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.carbo)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'carbo', e.target.value)} readOnly={isLocked}/></div>
                                                <div className="form-group rb-f-g"><label className="rb-label">G</label><input className="form-input" style={lockStyle} type="number" inputMode="numeric" value={arredondar(ali.gordura)} onChange={(e) => handleAlimentoChange(rIndex, aIndex, 'gordura', e.target.value)} readOnly={isLocked}/></div>
                                                <button type="button" className="rb-remove" aria-label="Remover alimento" onClick={() => removeAlimento(rIndex, aIndex)}><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        );
                                    })}
                                    <button type="button" className="rb-add-btn is-food" onClick={() => addAlimento(rIndex)}>+ Add Alimento</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="btn-secondary rb-add-day" onClick={addRefeicao} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--cor-borda)', background: 'var(--cor-card-secundario)', cursor: 'pointer', color: 'var(--cor-texto-principal)' }}><i className="fa-solid fa-utensils"></i> Add Refeição</button>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="rb-cancel" onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-secundario)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Dieta'}</button>
                    </div>
                </form>
            </div>
            <style>{`.search-item-hover:hover { background-color: var(--cor-fundo-hover) !important; } .custom-option:hover { background-color: rgba(74, 109, 255, 0.15) !important; }`}</style>
        </BaseModal>
    );
}