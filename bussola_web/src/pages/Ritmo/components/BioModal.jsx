import React, { useState, useEffect } from 'react';
import { createBioData } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { CustomSelect } from '../../../components/CustomSelect'; 
import { BaseModal } from '../../../components/BaseModal';

export function BioModal({ onClose, onSuccess, initialData }) {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ peso: '', altura: '', idade: '', genero: 'M', nivel_atividade: 'moderado', objetivo: 'manutencao', bf_estimado: '' });

    const genderOptions = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }];
    const activityOptions = [{ value: 'sedentario', label: 'Sedentário' }, { value: 'leve', label: 'Leve' }, { value: 'moderado', label: 'Moderado' }, { value: 'alto', label: 'Alto' }, { value: 'atleta', label: 'Atleta' }];
    const objectiveOptions = [{ value: 'perda_peso', label: 'Perda de Peso' }, { value: 'manutencao', label: 'Manutenção' }, { value: 'ganho_massa', label: 'Ganho de Massa' }];

    useEffect(() => {
        if (initialData) {
            setFormData({
                peso: initialData.peso || '', altura: initialData.altura || '', idade: initialData.idade || '',
                genero: initialData.genero || 'M', nivel_atividade: initialData.nivel_atividade || 'moderado',
                objetivo: initialData.objetivo || 'manutencao', bf_estimado: initialData.bf_estimado || ''
            });
        }
    }, [initialData]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = { ...formData, peso: parseFloat(formData.peso), altura: parseFloat(formData.altura), idade: parseInt(formData.idade), bf_estimado: formData.bf_estimado ? parseFloat(formData.bf_estimado) : null };
            await createBioData(payload);
            addToast({ type: 'success', title: 'Perfil Atualizado!', description: 'Metas recalculadas.' });
            onSuccess(); onClose();
        } catch (error) {
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar dados.' });
        } finally { setLoading(false); }
    };

    return (
        <BaseModal onClose={onClose} className="ritmo-scope">
            <div className="modal-content" style={{maxWidth: '550px', width: '90%'}}>
                <div className="modal-header-flex">
                    <h2 className="modal-title">Bio-Indicadores</h2>
                    <button className="close-btn-styled" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-grid two-cols">
                            <div className="form-group"><label>Peso (kg)</label><input className="form-input" type="number" step="0.1" name="peso" required value={formData.peso} onChange={handleChange} /></div>
                            <div className="form-group"><label>Altura (cm)</label><input className="form-input" type="number" name="altura" required value={formData.altura} onChange={handleChange} /></div>
                        </div>
                        <div className="form-grid two-cols">
                            <div className="form-group"><label>Idade</label><input className="form-input" type="number" name="idade" required value={formData.idade} onChange={handleChange} /></div>
                            <div className="form-group"><CustomSelect className="form-input" label="Gênero" name="genero" value={formData.genero} options={genderOptions} onChange={handleChange} /></div>
                        </div>
                        <div className="form-grid"><div className="form-group"><CustomSelect className="form-input" label="Nível de Atividade" name="nivel_atividade" value={formData.nivel_atividade} options={activityOptions} onChange={handleChange} /></div></div>
                        <div className="form-grid"><div className="form-group"><CustomSelect className="form-input" label="Objetivo" name="objetivo" value={formData.objetivo} options={objectiveOptions} onChange={handleChange} /></div></div>
                        <div className="form-grid"><div className="form-group"><label>BF% (Opcional)</label><input className="form-input" type="number" step="0.1" name="bf_estimado" value={formData.bf_estimado} onChange={handleChange} /></div></div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-modal-save" disabled={loading}>{loading ? 'Calculando...' : 'Salvar Perfil'}</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}