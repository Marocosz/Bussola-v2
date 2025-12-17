import React, { useState } from 'react';
import { createBioData } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export function BioModal({ onClose, onSuccess }) {
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            // Conversão de tipos
            const payload = {
                ...formData,
                peso: parseFloat(formData.peso),
                altura: parseFloat(formData.altura),
                idade: parseInt(formData.idade),
                bf_estimado: formData.bf_estimado ? parseFloat(formData.bf_estimado) : null
            };

            await createBioData(payload);
            
            addToast({ type: 'success', title: 'Perfil Atualizado!', description: 'Metas e TMB recalculadas com sucesso.' });
            onSuccess(); // Recarrega os dados na tela principal
            onClose();
        } catch (error) {
            console.error(error);
            addToast({ type: 'error', title: 'Erro', description: 'Falha ao salvar dados corporais.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '500px'}}>
                <div className="modal-header">
                    <h2>Atualizar Bio-Dados</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group-row">
                        <div className="form-group">
                            <label>Peso (kg)</label>
                            <input type="number" step="0.1" name="peso" required value={formData.peso} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Altura (cm)</label>
                            <input type="number" name="altura" required value={formData.altura} onChange={handleChange} placeholder="Ex: 175" />
                        </div>
                    </div>

                    <div className="form-group-row">
                        <div className="form-group">
                            <label>Idade</label>
                            <input type="number" name="idade" required value={formData.idade} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Gênero</label>
                            <select name="genero" value={formData.genero} onChange={handleChange}>
                                <option value="M">Masculino</option>
                                <option value="F">Feminino</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Nível de Atividade</label>
                        <select name="nivel_atividade" value={formData.nivel_atividade} onChange={handleChange}>
                            <option value="sedentario">Sedentário (Pouco ou nenhum exercício)</option>
                            <option value="leve">Leve (1-3 dias/semana)</option>
                            <option value="moderado">Moderado (3-5 dias/semana)</option>
                            <option value="alto">Alto (6-7 dias/semana)</option>
                            <option value="atleta">Atleta (2x por dia / muito intenso)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Objetivo Atual</label>
                        <select name="objetivo" value={formData.objetivo} onChange={handleChange}>
                            <option value="perda_peso">Perder Peso (Déficit Calórico)</option>
                            <option value="manutencao">Manter Peso (Normocalórica)</option>
                            <option value="ganho_massa">Ganhar Massa (Superávit Calórico)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>BF% Estimado (Opcional)</label>
                        <input type="number" step="0.1" name="bf_estimado" value={formData.bf_estimado} onChange={handleChange} placeholder="Ex: 15.5" />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Calculando...' : 'Salvar e Calcular'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}