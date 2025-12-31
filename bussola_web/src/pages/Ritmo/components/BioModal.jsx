import React, { useState, useEffect } from 'react';
import { createBioData } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { CustomSelect } from '../../../components/CustomSelect'; 
import { BaseModal } from '../../../components/BaseModal';

export function BioModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // Dados Cadastrais
    const [formData, setFormData] = useState({ 
        peso: '', altura: '', idade: '', genero: 'M', 
        nivel_atividade: 'moderado', objetivo: 'manutencao', bf_estimado: '' 
    });

    // Dados de Metas (Editáveis)
    const [customMetas, setCustomMetas] = useState({
        gasto_calorico_total: '',
        meta_proteina: '',
        meta_carbo: '',
        meta_gordura: '',
        meta_agua: ''
    });

    // Sugestões Calculadas (Com explicação)
    const [suggestions, setSuggestions] = useState({
        tmb: 0, gasto_total: 0, proteina: 0, carbo: 0, gordura: 0, agua: 0
    });

    const genderOptions = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }];
    const activityOptions = [{ value: 'sedentario', label: 'Sedentário' }, { value: 'leve', label: 'Leve' }, { value: 'moderado', label: 'Moderado' }, { value: 'alto', label: 'Alto' }, { value: 'atleta', label: 'Atleta' }];
    const objectiveOptions = [{ value: 'perda_peso', label: 'Perda de Peso (-500kcal)' }, { value: 'manutencao', label: 'Manutenção' }, { value: 'ganho_massa', label: 'Ganho de Massa (+300kcal)' }];

    useEffect(() => {
        if (initialData) {
            setFormData({
                peso: initialData.peso || '', altura: initialData.altura || '', idade: initialData.idade || '',
                genero: initialData.genero || 'M', nivel_atividade: initialData.nivel_atividade || 'moderado',
                objetivo: initialData.objetivo || 'manutencao', bf_estimado: initialData.bf_estimado || ''
            });
            setCustomMetas({
                gasto_calorico_total: initialData.gasto_calorico_total || '',
                meta_proteina: initialData.meta_proteina || '',
                meta_carbo: initialData.meta_carbo || '',
                meta_gordura: initialData.meta_gordura || '',
                meta_agua: initialData.meta_agua || ''
            });
        }
    }, [initialData]);

    useEffect(() => {
        calculateSuggestions();
    }, [formData.peso, formData.altura, formData.idade, formData.genero, formData.nivel_atividade, formData.objetivo]);

    const calculateSuggestions = () => {
        const p = parseFloat(formData.peso);
        const a = parseFloat(formData.altura);
        const i = parseInt(formData.idade);
        
        if (!p || !a || !i) return;

        // Harris-Benedict
        let tmb = 0;
        if (formData.genero === 'M') tmb = 88.36 + (13.4 * p) + (4.8 * a) - (5.7 * i);
        else tmb = 447.6 + (9.2 * p) + (3.1 * a) - (4.3 * i);

        const fatores = { 'sedentario': 1.2, 'leve': 1.375, 'moderado': 1.55, 'alto': 1.725, 'atleta': 1.9 };
        const get = tmb * (fatores[formData.nivel_atividade] || 1.2);

        let alvo = get;
        if (formData.objetivo === 'perda_peso') alvo -= 500;
        else if (formData.objetivo === 'ganho_massa') alvo += 300;

        // Macros Padrão
        const prot = p * 2.0;
        const gord = p * 1.0;
        const cal_restante = alvo - ((prot * 4) + (gord * 9));
        const carb = Math.max(0, cal_restante / 4);
        const agua = p * 0.045;

        setSuggestions({
            tmb: Math.round(tmb),
            gasto_total: Math.round(alvo),
            proteina: Math.round(prot),
            gordura: Math.round(gord),
            carbo: Math.round(carb),
            agua: parseFloat(agua.toFixed(1))
        });
    };

    const handleFormChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleMetaChange = (e) => { const { name, value } = e.target; setCustomMetas(prev => ({ ...prev, [name]: value })); };

    const useSuggestedValues = () => {
        setCustomMetas({
            gasto_calorico_total: suggestions.gasto_total,
            meta_proteina: suggestions.proteina,
            meta_carbo: suggestions.carbo,
            meta_gordura: suggestions.gordura,
            meta_agua: suggestions.agua
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = { 
                ...formData, 
                peso: parseFloat(formData.peso), 
                altura: parseFloat(formData.altura), 
                idade: parseInt(formData.idade), 
                bf_estimado: formData.bf_estimado ? parseFloat(formData.bf_estimado) : null,
                gasto_calorico_total: customMetas.gasto_calorico_total ? parseFloat(customMetas.gasto_calorico_total) : null,
                meta_proteina: customMetas.meta_proteina ? parseFloat(customMetas.meta_proteina) : null,
                meta_carbo: customMetas.meta_carbo ? parseFloat(customMetas.meta_carbo) : null,
                meta_gordura: customMetas.meta_gordura ? parseFloat(customMetas.meta_gordura) : null,
                meta_agua: customMetas.meta_agua ? parseFloat(customMetas.meta_agua) : null
            };

            await createBioData(payload);
            addToast({ type: 'success', title: 'Perfil Atualizado!', description: 'Metas salvas com sucesso.' });
            onSuccess(); onClose();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar dados.' });
        } finally { setLoading(false); }
    };

    // Helper para input com sugestão inteligente e tooltip
    const renderMetaInput = (label, name, suggestionVal, unit, hintText, isCalories = false) => (
        <div className="meta-input-group">
            <div className={`meta-label-row ${isCalories ? 'row-calorias' : ''}`}>
                <span className="meta-label-text">{label}</span>
                <span 
                    className="suggestion-badge" 
                    data-tooltip={`Cálculo Automático: ${suggestionVal}${unit}\nRegra: ${hintText}`}
                    onClick={() => setCustomMetas(prev => ({...prev, [name]: suggestionVal}))}
                >
                    Sugerido: {suggestionVal}{unit}
                </span>
            </div>
            <input 
                className="form-input" 
                type="number" 
                step="0.1"
                name={name} 
                value={customMetas[name] || ''} 
                onChange={handleMetaChange} 
                placeholder={suggestionVal}
            />
        </div>
    );

    return (
        <BaseModal onClose={onClose} className="ritmo-scope">
            <div className="modal-content" style={{maxWidth: '900px', width: '95%'}}>
                <div className="modal-header-flex">
                    <h2 className="modal-title">Perfil Biológico & Metas</h2>
                    <button className="close-btn-styled" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="bio-modal-grid">
                            
                            {/* COLUNA 1: DADOS CADASTRAIS */}
                            <div className="bio-data-column">
                                <div className="bio-section-title">Dados Corporais</div>
                                <div className="form-grid two-cols">
                                    <div className="form-group"><label>Peso (kg)</label><input className="form-input" type="number" step="0.1" name="peso" required value={formData.peso} onChange={handleFormChange} /></div>
                                    <div className="form-group"><label>Altura (cm)</label><input className="form-input" type="number" name="altura" required value={formData.altura} onChange={handleFormChange} /></div>
                                </div>
                                <div className="form-grid two-cols">
                                    <div className="form-group"><label>Idade</label><input className="form-input" type="number" name="idade" required value={formData.idade} onChange={handleFormChange} /></div>
                                    <div className="form-group"><CustomSelect className="form-input" label="Gênero" name="genero" value={formData.genero} options={genderOptions} onChange={handleFormChange} /></div>
                                </div>
                                <div className="form-grid"><div className="form-group"><CustomSelect className="form-input" label="Nível de Atividade" name="nivel_atividade" value={formData.nivel_atividade} options={activityOptions} onChange={handleFormChange} /></div></div>
                                <div className="form-grid"><div className="form-group"><CustomSelect className="form-input" label="Objetivo Atual" name="objetivo" value={formData.objetivo} options={objectiveOptions} onChange={handleFormChange} /></div></div>
                                <div className="form-grid"><div className="form-group"><label>BF% (Estimado/Opcional)</label><input className="form-input" type="number" step="0.1" name="bf_estimado" value={formData.bf_estimado} onChange={handleFormChange} /></div></div>
                            </div>

                            {/* COLUNA 2: METAS (DARK CARD) */}
                            <div className="bio-metas-card">
                                <div className="bio-section-title">
                                    <span>Metas Nutricionais</span>
                                    <button type="button" onClick={useSuggestedValues} className="btn-use-suggested">
                                        <i className="fa-solid fa-wand-magic-sparkles"></i> Usar Sugestões
                                    </button>
                                </div>
                                
                                <div className="calc-explanation">
                                    Valores calculados via <strong>Harris-Benedict</strong> com base no seu nível de atividade e objetivo ({formData.objetivo.replace('_', ' ')}).
                                </div>

                                {/* Passa true para isCalories para manter o layout lateral */}
                                {renderMetaInput('Meta Calórica (Kcal)', 'gasto_calorico_total', suggestions.gasto_total, '', 'TMB x Fator Ativ. +/- Objetivo', true)}
                                
                                <div className="form-grid two-cols" style={{marginBottom: 0}}>
                                    {renderMetaInput('Proteína (g)', 'meta_proteina', suggestions.proteina, 'g', '2.0g por kg corporal')}
                                    {renderMetaInput('Carboidratos (g)', 'meta_carbo', suggestions.carbo, 'g', 'Restante das calorias')}
                                </div>
                                <div className="form-grid two-cols">
                                    {renderMetaInput('Gorduras (g)', 'meta_gordura', suggestions.gordura, 'g', '1.0g por kg corporal')}
                                    {renderMetaInput('Água (L)', 'meta_agua', suggestions.agua, 'L', '45ml por kg corporal')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-modal-save" disabled={loading}>{loading ? 'Salvando...' : 'Confirmar'}</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}