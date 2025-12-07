import React, { useEffect, useState } from 'react';
import { getRegistrosDashboard } from '../../services/api';
import { RegistroCard } from './components/RegistroCard';
import { RegistroModal } from './components/RegistroModal';
import './styles.css';

export function Registros() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Controle de UI
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [openMonths, setOpenMonths] = useState({'fixados': true});

    const fetchData = async () => {
        try {
            const result = await getRegistrosDashboard();
            setData(result);
            
            if(Object.keys(result.anotacoes_por_mes).length > 0){
                const firstMonth = Object.keys(result.anotacoes_por_mes)[0];
                setOpenMonths(prev => ({...prev, [firstMonth]: true}));
            }
        } catch(err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleAccordion = (key) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));

    const handleNew = () => { setEditingItem(null); setModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setModalOpen(true); };

    if (loading) return <div className="loading-screen">Carregando Registros...</div>;
    if (!data) return <div className="container" style={{paddingTop: '100px'}}>Erro ao carregar dados.</div>;

    return (
        <div className="container" style={{paddingTop: '100px'}}>
            <div className="page-header-actions">
                <h1>Meus Registros</h1>
                <button className="btn-primary" onClick={handleNew}>
                    <i className="fa-solid fa-plus"></i> Novo Registro
                </button>
            </div>

            <div className="monthly-groups-container">
                {/* Seção de Fixados */}
                {data.anotacoes_fixadas.length > 0 && (
                    <div className="month-group">
                        <h3 className={`month-header ${openMonths['fixados'] ? 'active' : ''}`} onClick={() => toggleAccordion('fixados')}>
                            <span><i className="fa-solid fa-thumbtack"></i> Fixados</span>
                            <i className={`fa-solid fa-chevron-down ${openMonths['fixados'] ? 'rotate' : ''}`}></i>
                        </h3>
                        {openMonths['fixados'] && (
                            <div className="month-content">
                                <div className="registros-grid">
                                    {data.anotacoes_fixadas.map(nota => (
                                        <RegistroCard key={nota.id} anotacao={nota} onUpdate={fetchData} onEdit={handleEdit} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Seção por Mês */}
                {Object.entries(data.anotacoes_por_mes).map(([mes, notas]) => (
                    <div className="month-group" key={mes}>
                        <h3 className={`month-header ${openMonths[mes] ? 'active' : ''}`} onClick={() => toggleAccordion(mes)}>
                            <span>{mes}</span>
                            <i className={`fa-solid fa-chevron-down ${openMonths[mes] ? 'rotate' : ''}`}></i>
                        </h3>
                        {openMonths[mes] && (
                            <div className="month-content">
                                <div className="registros-grid">
                                    {notas.map(nota => (
                                        <RegistroCard key={nota.id} anotacao={nota} onUpdate={fetchData} onEdit={handleEdit} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {data.anotacoes_fixadas.length === 0 && Object.keys(data.anotacoes_por_mes).length === 0 && (
                    <div className="empty-state">
                        <p>Nenhum registro encontrado.</p>
                        <p>Clique em "Novo Registro" para começar.</p>
                    </div>
                )}
            </div>

            <RegistroModal 
                active={modalOpen} 
                closeModal={() => setModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingItem} 
            />
        </div>
    );
}