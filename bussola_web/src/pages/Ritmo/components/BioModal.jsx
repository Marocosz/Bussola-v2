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
                <div className="modal-header">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%'}}>
                        <h2 style={{margin:0, fontSize:'1.2rem'}}>Bio-Indicadores</h2>
                        <button className="close-btn" onClick={onClose} style={{background:'none', border:'none', color:'var(--cor-texto-secundario)', cursor:'pointer', fontSize:'1.5rem'}}>&times;</button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row grid-50-50" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.2rem'}}>
                            <div className="form-group">
                                <label>Peso (kg)</label>
                                <input className="form-input" type="number" step="0.1" name="peso" required value={formData.peso} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Altura (cm)</label>
                                <input className="form-input" type="number" name="altura" required value={formData.altura} onChange={handleChange} placeholder="Ex: 175" />
                            </div>
                        </div>

                        <div className="form-row grid-50-50" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.2rem'}}>
                            <div className="form-group">
                                <label>Idade</label>
                                <input className="form-input" type="number" name="idade" required value={formData.idade} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Gênero</label>
                                <select className="form-input" name="genero" value={formData.genero} onChange={handleChange}>
                                    <option value="M">Masculino</option>
                                    <option value="F">Feminino</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{marginBottom:'1.2rem'}}>
                            <label>Nível de Atividade</label>
                            <select className="form-input" name="nivel_atividade" value={formData.nivel_atividade} onChange={handleChange}>
                                <option value="sedentario">Sedentário (Pouco exercício)</option>
                                <option value="leve">Leve (1-3 dias/semana)</option>
                                <option value="moderado">Moderado (3-5 dias/semana)</option>
                                <option value="alto">Alto (6-7 dias/semana)</option>
                                <option value="atleta">Atleta (Muito intenso)</option>
                            </select>
                        </div>

                        <div className="form-group" style={{marginBottom:'1.2rem'}}>
                            <label>Objetivo Atual</label>
                            <select className="form-input" name="objetivo" value={formData.objetivo} onChange={handleChange}>
                                <option value="perda_peso">Perda de Peso (Cutting)</option>
                                <option value="manutencao">Manutenção (Normo)</option>
                                <option value="ganho_massa">Ganho de Massa (Bulking)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>BF% Estimado (Opcional)</label>
                            <input className="form-input" type="number" step="0.1" name="bf_estimado" value={formData.bf_estimado} onChange={handleChange} placeholder="Ex: 15.5" />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} style={{background:'transparent', border:'1px solid var(--cor-borda)', color:'var(--cor-texto-secundario)', padding:'8px 16px', borderRadius:'8px', cursor:'pointer'}}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Calculando...' : 'Salvar Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}