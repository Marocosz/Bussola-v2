import React, { useState, useEffect } from 'react';
import { createBioData } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { CustomSelect } from '../../../components/CustomSelect'; 

export function BioModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        peso: '',
        altura: '',
        idade: '',
        genero: 'M',
        nivel_atividade: 'moderado',
        objetivo: 'manutencao',
        bf_estimado: ''
    });

    // Opções para os Selects
    const genderOptions = [
        { value: 'M', label: 'Masculino' },
        { value: 'F', label: 'Feminino' }
    ];

    const activityOptions = [
        { value: 'sedentario', label: 'Sedentário (Pouco exercício)' },
        { value: 'leve', label: 'Leve (1-3 dias/semana)' },
        { value: 'moderado', label: 'Moderado (3-5 dias/semana)' },
        { value: 'alto', label: 'Alto (6-7 dias/semana)' },
        { value: 'atleta', label: 'Atleta (Muito intenso)' }
    ];

    const objectiveOptions = [
        { value: 'perda_peso', label: 'Perda de Peso (Cutting)' },
        { value: 'manutencao', label: 'Manutenção (Normo)' },
        { value: 'ganho_massa', label: 'Ganho de Massa (Bulking)' }
    ];

    // Efeito para preencher o formulário caso existam dados iniciais
    useEffect(() => {
        if (initialData) {
            setFormData({
                peso: initialData.peso || '',
                altura: initialData.altura || '',
                idade: initialData.idade || '',
                genero: initialData.genero || 'M',
                nivel_atividade: initialData.nivel_atividade || 'moderado',
                objetivo: initialData.objetivo || 'manutencao',
                bf_estimado: initialData.bf_estimado || ''
            });
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
                bf_estimado: formData.bf_estimado ? parseFloat(formData.bf_estimado) : null
            };

            await createBioData(payload);
            addToast({ type: 'success', title: 'Perfil Atualizado!', description: 'Metas recalculadas com sucesso.' });
            onSuccess();
            onClose();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar dados corporais.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ritmo-scope modal-overlay">
            <div className="modal-content" style={{maxWidth: '550px', width: '90%'}}>
                
                {/* Header limpo com classes */}
                <div className="modal-header-flex">
                    <h2 className="modal-title">Bio-Indicadores</h2>
                    <button className="close-btn-styled" onClick={onClose}>&times;</button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Linha 1: Peso e Altura */}
                        <div className="form-grid two-cols">
                            <div className="form-group">
                                <label>Peso (kg)</label>
                                <input 
                                    className="form-input" 
                                    type="number" 
                                    step="0.1" 
                                    name="peso" 
                                    required 
                                    value={formData.peso} 
                                    onChange={handleChange} 
                                />
                            </div>
                            <div className="form-group">
                                <label>Altura (cm)</label>
                                <input 
                                    className="form-input" 
                                    type="number" 
                                    name="altura" 
                                    required 
                                    value={formData.altura} 
                                    onChange={handleChange} 
                                    placeholder="Ex: 175" 
                                />
                            </div>
                        </div>

                        {/* Linha 2: Idade e Gênero */}
                        <div className="form-grid two-cols">
                            <div className="form-group">
                                <label>Idade</label>
                                <input 
                                    className="form-input" 
                                    type="number" 
                                    name="idade" 
                                    required 
                                    value={formData.idade} 
                                    onChange={handleChange} 
                                />
                            </div>
                            <div className="form-group">
                                <CustomSelect 
                                    className="form-input"
                                    label="Gênero"
                                    name="genero"
                                    value={formData.genero}
                                    options={genderOptions}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Atividade */}
                        <div className="form-grid">
                            <div className="form-group">
                                <CustomSelect
                                    className="form-input"
                                    label="Nível de Atividade"
                                    name="nivel_atividade"
                                    value={formData.nivel_atividade}
                                    options={activityOptions}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Objetivo */}
                        <div className="form-grid">
                            <div className="form-group">
                                <CustomSelect
                                    className="form-input"
                                    label="Objetivo Atual"
                                    name="objetivo"
                                    value={formData.objetivo}
                                    options={objectiveOptions}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* BF (Opcional) */}
                        <div className="form-grid">
                            <div className="form-group">
                                <label>BF% Estimado (Opcional)</label>
                                <input 
                                    className="form-input" 
                                    type="number" 
                                    step="0.1" 
                                    name="bf_estimado" 
                                    value={formData.bf_estimado} 
                                    onChange={handleChange} 
                                    placeholder="Ex: 15.5" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer com Botões Padronizados */}
                    <div className="modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-modal-save" disabled={loading}>
                            {loading ? 'Calculando...' : 'Salvar Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}