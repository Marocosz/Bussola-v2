import React, { useState, useEffect } from 'react';
import { getProvisoesData, getRoteiroData, getRegistrosResumoData } from '../../../services/api';

// --- MODAL GENÉRICO ---
const BaseModal = ({ title, onClose, children, loading }) => (
    <div className="modal-overlay panorama-scope" onClick={onClose}>
        <div className="modal-content large-table-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h2>{title}</h2>
                <span className="close-btn" onClick={onClose}>&times;</span>
            </div>
            <div className="modal-body table-body">
                {loading ? (
                    <div className="loading-state"><i className="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>
                ) : children}
            </div>
            <div className="modal-footer">
                <button className="btn-secondary" onClick={onClose}>Fechar</button>
            </div>
        </div>
    </div>
);

// --- 1. MODAL PROVISÕES ---
export function ProvisoesModal({ onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('Todos'); // Todos, Pontual, Recorrente

    useEffect(() => {
        getProvisoesData().then(setData).finally(() => setLoading(false));
    }, []);

    const filteredData = data.filter(item => filtro === 'Todos' || item.tipo_recorrencia.includes(filtro));

    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');

    return (
        <BaseModal title="Provisões e Contas Futuras" onClose={onClose} loading={loading}>
            <div className="table-filter-bar">
                <button className={`filter-pill ${filtro==='Todos'?'active':''}`} onClick={()=>setFiltro('Todos')}>Todos</button>
                <button className={`filter-pill ${filtro==='Pontual'?'active':''}`} onClick={()=>setFiltro('Pontual')}>Pontuais</button>
                <button className={`filter-pill ${filtro==='Recorrente'?'active':''}`} onClick={()=>setFiltro('Recorrente')}>Recorrentes</button>
            </div>
            <table className="panorama-table">
                <thead>
                    <tr>
                        <th>Vencimento</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th>Tipo</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.length === 0 && <tr><td colSpan="5" className="empty-cell">Nenhum registro encontrado.</td></tr>}
                    {filteredData.map(item => (
                        <tr key={item.id}>
                            <td>{fmtDate(item.data_vencimento)}</td>
                            <td>{item.descricao}</td>
                            <td><span className="badge-cat" style={{backgroundColor: item.categoria_cor}}>{item.categoria_nome}</span></td>
                            <td>{item.tipo_recorrencia}</td>
                            <td style={{fontWeight:'bold', color: '#e74c3c'}}>{fmt(item.valor)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseModal>
    );
}

// --- 2. MODAL ROTEIRO ---
export function RoteiroModal({ onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getRoteiroData().then(setData).finally(() => setLoading(false));
    }, []);

    const fmtDateFull = (d) => new Date(d).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});

    return (
        <BaseModal title="Roteiro (Agenda Futura)" onClose={onClose} loading={loading}>
            <table className="panorama-table">
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Título</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 && <tr><td colSpan="3" className="empty-cell">Nenhum compromisso futuro.</td></tr>}
                    {data.map(item => (
                        <tr key={item.id}>
                            <td>{fmtDateFull(item.data_inicio)}</td>
                            <td>
                                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                    <div style={{width:10, height:10, borderRadius:'50%', backgroundColor: item.cor}}></div>
                                    {item.titulo}
                                </div>
                            </td>
                            <td>{item.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseModal>
    );
}

// --- 3. MODAL REGISTROS ---
export function RegistrosModal({ onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tipoFiltro, setTipoFiltro] = useState('Todos');

    useEffect(() => {
        getRegistrosResumoData().then(setData).finally(() => setLoading(false));
    }, []);

    const filtered = data.filter(d => tipoFiltro === 'Todos' || d.tipo === tipoFiltro);

    return (
        <BaseModal title="Resumo de Registros" onClose={onClose} loading={loading}>
            <div className="table-filter-bar">
                <button className={`filter-pill ${tipoFiltro==='Todos'?'active':''}`} onClick={()=>setTipoFiltro('Todos')}>Todos</button>
                <button className={`filter-pill ${tipoFiltro==='Tarefa'?'active':''}`} onClick={()=>setTipoFiltro('Tarefa')}>Tarefas</button>
                <button className={`filter-pill ${tipoFiltro==='Anotação'?'active':''}`} onClick={()=>setTipoFiltro('Anotação')}>Anotações</button>
            </div>
            <table className="panorama-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Título</th>
                        <th>Prioridade / Grupo</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.length === 0 && <tr><td colSpan="4" className="empty-cell">Nada encontrado.</td></tr>}
                    {filtered.map(item => (
                        <tr key={`${item.tipo}-${item.id}`}>
                            <td>
                                {item.tipo === 'Tarefa' 
                                    ? <i className="fa-solid fa-check-square" style={{color:'#3b82f6'}}></i> 
                                    : <i className="fa-solid fa-sticky-note" style={{color:'#f59e0b'}}></i>
                                } {item.tipo}
                            </td>
                            <td>{item.titulo}</td>
                            <td>
                                {item.tipo === 'Tarefa' ? (
                                    <span className={`badge-prio ${item.grupo_ou_prioridade?.toLowerCase()}`}>{item.grupo_ou_prioridade}</span>
                                ) : (
                                    <span className="badge-grupo">{item.grupo_ou_prioridade}</span>
                                )}
                            </td>
                            <td>{item.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseModal>
    );
}