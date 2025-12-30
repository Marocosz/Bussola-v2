import React, { useEffect, useState } from 'react';
import { getSegredos, deleteSegredo } from '../../services/api'; // Removemos getSegredoValor daqui
import { SegredoModal } from './components/SegredoModal';
import { ViewSecretModal } from './components/ViewSecretModal'; // Novo Import
import { ViewNotesModal } from './components/ViewNotesModal';   // Novo Import
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmDialogContext';
import './styles.css';

export function Cofre() {
    const [segredos, setSegredos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados dos Modais
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    
    const [viewSecretItem, setViewSecretItem] = useState(null); // Para modal de ver senha
    const [viewNotesItem, setViewNotesItem] = useState(null);   // Para modal de ver notas
    
    const { addToast } = useToast();
    const dialogConfirm = useConfirm();

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

    // Handler para abrir visualização de senha (com confirmação de segurança)
    const handleViewSecret = async (segredo) => {
        // Camada de Segurança Extra: Confirmação antes de chamar API
        const isConfirmed = await dialogConfirm({
            title: 'Visualizar Credencial?',
            description: 'Você está prestes a acessar uma informação sensível. Certifique-se de que ninguém está olhando.',
            confirmLabel: 'Visualizar',
            variant: 'info' // Azul para informação/acesso
        });

        if (isConfirmed) {
            setViewSecretItem(segredo);
        }
    };

    const handleDelete = async (id) => {
        const isConfirmed = await dialogConfirm({
            title: 'Excluir Segredo?',
            description: 'Esta ação removerá permanentemente a chave. Deseja continuar?',
            confirmLabel: 'Sim, Excluir',
            variant: 'danger'
        });

        if (!isConfirmed) return;

        try {
            await deleteSegredo(id);
            addToast({type:'success', title:'Excluído', description:'Segredo removido.'});
            fetchData();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao excluir.'});
        }
    };

    const handleNew = () => { setEditingItem(null); setCreateModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setCreateModalOpen(true); };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : 'Não expira';

    const LoadingState = () => (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--cor-texto-secundario)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '15px', color: 'var(--cor-azul-primario)' }}></i>
            <p>Decifrando cofre...</p>
        </div>
    );

    return (
        <div className="container main-container cofre-scope">
            <div className="internal-hero">
                <div className="hero-bg-effect"></div>
                <div className="internal-hero-content">
                    <h1>Meu Cofre</h1>
                    <p>Gerencie seus tokens e informações sensíveis com segurança.</p>
                </div>
            </div>

            <div className="cofre-content-wrapper">
                <div className="section-header-flex">
                    <h2>Lista de Segredos</h2>
                    <button className="btn-primary" onClick={handleNew}>
                        <i className="fa-solid fa-plus"></i> Guardar Segredo
                    </button>
                </div>

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
                                                {segredo.servico ? <span className="service-tag">{segredo.servico}</span> : '-'}
                                            </td>
                                            
                                            {/* Coluna Notas Clicável */}
                                            <td className="column-notas" onClick={() => { if(segredo.notas) setViewNotesItem(segredo); }}>
                                                {segredo.notas ? (
                                                    <div className="notes-preview">
                                                        {segredo.notas}
                                                        <i className="fa-solid fa-expand notes-expand-icon"></i>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            
                                            <td style={{ color: segredo.data_expiracao ? 'var(--cor-laranja-aviso)' : 'inherit' }}>
                                                {fmtDate(segredo.data_expiracao)}
                                            </td>
                                            <td>
                                                <div className="action-buttons" style={{justifyContent: 'flex-end'}}>
                                                    {/* Botão Ver Senha (Eye) substitui Copiar */}
                                                    <button className="btn-action-icon btn-view-secret" onClick={() => handleViewSecret(segredo)} title="Ver/Copiar Senha">
                                                        <i className="fa-solid fa-eye"></i>
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

            {/* Modais */}
            <SegredoModal 
                active={createModalOpen} 
                closeModal={() => setCreateModalOpen(false)} 
                onUpdate={fetchData} 
                editingData={editingItem} 
            />

            {viewSecretItem && (
                <ViewSecretModal 
                    segredoId={viewSecretItem.id} 
                    titulo={viewSecretItem.titulo} 
                    onClose={() => setViewSecretItem(null)} 
                />
            )}

            {viewNotesItem && (
                <ViewNotesModal 
                    notas={viewNotesItem.notas} 
                    titulo={viewNotesItem.titulo}
                    onClose={() => setViewNotesItem(null)} 
                />
            )}
        </div>
    );
}