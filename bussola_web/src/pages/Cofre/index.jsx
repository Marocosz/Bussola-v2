import React, { useEffect, useState } from 'react';
import { getSegredos, getSegredoValor, deleteSegredo } from '../../services/api';
import { SegredoModal } from './components/SegredoModal';
import { useToast } from '../../context/ToastContext';
import './styles.css';

export function Cofre() {
    const [segredos, setSegredos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const { addToast } = useToast();

    const fetchData = async () => {
        try {
            const data = await getSegredos();
            setSegredos(data);
        } catch(err) {
            console.error(err);
            addToast({type:'error', title:'Erro', description:'Falha ao carregar segredos.'});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCopy = async (id) => {
        try {
            const res = await getSegredoValor(id);
            if (res.valor) {
                await navigator.clipboard.writeText(res.valor);
                addToast({type:'success', title:'Copiado!', description:'Chave copiada para a área de transferência.'});
            }
        } catch {
            addToast({type:'error', title:'Erro', description:'Não foi possível obter a chave.'});
        }
    };

    const handleDelete = async (id) => {
        if(!confirm('Excluir este segredo?')) return;
        try {
            await deleteSegredo(id);
            addToast({type:'success', title:'Excluído', description:'Segredo removido.'});
            fetchData();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao excluir.'});
        }
    };

    const handleNew = () => { setEditingItem(null); setModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setModalOpen(true); };

    // Formatação de data
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : 'Não expira';

    // Componente de Loading interno (Skeleton simples)
    const LoadingState = () => (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '15px', color: 'var(--cor-azul-primario)' }}></i>
            <p>Decifrando cofre...</p>
        </div>
    );

    return (
        <div className="container main-container cofre-scope">
            
            {/* 1. HERO SECTION */}
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Meu Cofre</h1>
                    <p>Gerencie seus tokens e informações sensíveis com segurança.</p>
                </div>
            </div>

            <div className="cofre-content-wrapper">
                
                {/* Header da Tabela (Título + Botão) */}
                <div className="section-header-flex">
                    <h2>Lista de Segredos</h2>
                    <button className="btn-primary" onClick={handleNew}>
                        <i className="fa-solid fa-plus"></i> Guardar Segredo
                    </button>
                </div>

                {/* Container da Tabela */}
                <div className="table-container">
                    {loading ? (
                        <LoadingState />
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Título</th>
                                    <th>Serviço</th>
                                    <th className="column-notas">Notas</th>
                                    <th>Data de Expiração</th>
                                    <th style={{width: '150px', textAlign: 'right'}}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {segredos.length > 0 ? (
                                    segredos.map(segredo => (
                                        <tr key={segredo.id}>
                                            <td style={{fontWeight: '500'}}>{segredo.titulo}</td>
                                            <td>
                                                {segredo.servico ? (
                                                    <span className="service-tag">{segredo.servico}</span>
                                                ) : '-'}
                                            </td>
                                            <td className="column-notas">{segredo.notas || '-'}</td>
                                            <td style={{ color: segredo.data_expiracao ? 'var(--cor-laranja-aviso)' : 'inherit' }}>
                                                {fmtDate(segredo.data_expiracao)}
                                            </td>
                                            <td>
                                                <div className="action-buttons" style={{justifyContent: 'flex-end'}}>
                                                    <button className="btn-action-icon btn-copy-secret" onClick={() => handleCopy(segredo.id)} title="Copiar Chave">
                                                        <i className="fa-regular fa-copy"></i>
                                                    </button>
                                                    <button className="btn-action-icon btn-edit-segredo" onClick={() => handleEdit(segredo)} title="Editar">
                                                        <i className="fa-solid fa-pencil"></i>
                                                    </button>
                                                    <button className="btn-action-icon btn-delete" onClick={() => handleDelete(segredo.id)} title="Excluir">
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="empty-state-cell">
                                            <i className="fa-solid fa-shield-cat" style={{fontSize: '2rem', marginBottom: '1rem', opacity: 0.5}}></i>
                                            <p>Nenhum segredo guardado no momento.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <SegredoModal 
                active={modalOpen} 
                closeModal={() => setModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingItem} 
            />
        </div>
    );
}