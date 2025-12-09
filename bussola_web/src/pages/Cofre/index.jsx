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

    if (loading) return <div className="loading-screen">Carregando Cofre...</div>;

    return (
        <div className="container" style={{paddingTop: '100px'}}>
            <div className="page-header-actions">
                <h1>Meu Cofre</h1>
                <button className="btn-primary" onClick={handleNew}>
                    <i className="fa-solid fa-plus"></i> Guardar Segredo
                </button>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Serviço</th>
                            <th className="column-notas">Notas</th>
                            <th>Data de Expiração</th>
                            <th style={{width: '150px'}}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {segredos.length > 0 ? (
                            segredos.map(segredo => (
                                <tr key={segredo.id}>
                                    <td>{segredo.titulo}</td>
                                    <td>{segredo.servico || '-'}</td>
                                    <td className="column-notas">{segredo.notas || '-'}</td>
                                    <td>{fmtDate(segredo.data_expiracao)}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-action-icon btn-copy-secret" onClick={() => handleCopy(segredo.id)} title="Copiar">
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
                                <td colSpan="5" style={{textAlign: 'center', padding: '2rem'}}>Nenhum segredo guardado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
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