import React, { useState, useEffect } from 'react';
import { getProvisoesData, getRoteiroData, getRegistrosResumoData } from '../../../services/api';

// --- MODAL GENÉRICO ---
const BaseModal = ({ title, onClose, children, loading }) => {
    
    // Efeito para travar/destravar o scroll do body
    useEffect(() => {
        // Ao montar (abrir): Trava o scroll
        document.body.style.overflow = 'hidden';
        
        // Ao desmontar (fechar): Restaura o scroll
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
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
};

// --- 1. MODAL PROVISÕES ---
export function ProvisoesModal({ onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados de Controle
    const [filtro, setFiltro] = useState('Todos'); 
    const [ordenacao, setOrdenacao] = useState('data_asc'); 

    useEffect(() => {
        getProvisoesData().then(setData).finally(() => setLoading(false));
    }, []);

    // Lógica de Processamento
    const processData = () => {
        let result = data.filter(item => {
            if (filtro === 'Todos') return true;
            const tipoLower = item.tipo_recorrencia.toLowerCase();
            const filtroLower = filtro.toLowerCase();
            if (filtro === 'Parcelada') return tipoLower.includes('parcela');
            return tipoLower.includes(filtroLower);
        });

        result.sort((a, b) => {
            const dateA = new Date(a.data_vencimento);
            const dateB = new Date(b.data_vencimento);
            const valA = a.valor;
            const valB = b.valor;

            switch (ordenacao) {
                case 'data_asc': return dateA - dateB;
                case 'data_desc': return dateB - dateA;
                case 'valor_asc': return valA - valB;
                case 'valor_desc': return valB - valA;
                default: return 0;
            }
        });

        return result;
    };

    const filteredData = processData();
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');
    const isPontual = (tipo) => tipo.toLowerCase().includes('pontual');

    return (
        <BaseModal title="Provisões e Contas Futuras" onClose={onClose} loading={loading}>
            <div className="table-filter-bar">
                <div className="filter-group">
                    <button className={`filter-pill ${filtro==='Todos'?'active':''}`} onClick={()=>setFiltro('Todos')}>Todos</button>
                    <button className={`filter-pill ${filtro==='Pontual'?'active':''}`} onClick={()=>setFiltro('Pontual')}>Pontuais</button>
                    <button className={`filter-pill ${filtro==='Recorrente'?'active':''}`} onClick={()=>setFiltro('Recorrente')}>Recorrentes</button>
                    <button className={`filter-pill ${filtro==='Parcelada'?'active':''}`} onClick={()=>setFiltro('Parcelada')}>Parceladas</button>
                </div>

                <div className="sort-group">
                    <label>Ordenar por:</label>
                    <select className="sort-select" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
                        <option value="data_asc">Data (Antiga → Nova)</option>
                        <option value="data_desc">Data (Nova → Antiga)</option>
                        <option value="valor_asc">Valor (Menor → Maior)</option>
                        <option value="valor_desc">Valor (Maior → Menor)</option>
                    </select>
                </div>
            </div>

            <table className="panorama-table">
                <thead>
                    <tr>
                        <th style={{width: '15%'}}>Data</th>
                        <th style={{width: '15%'}} className="text-center">Vencimento</th>
                        <th style={{width: '30%'}}>Descrição</th>
                        <th style={{width: '15%'}}>Categoria</th>
                        <th style={{width: '15%'}}>Tipo</th>
                        <th style={{width: '10%'}}>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.length === 0 && <tr><td colSpan="6" className="empty-cell">Nenhum registro encontrado.</td></tr>}
                    {filteredData.map(item => (
                        <tr key={item.id}>
                            <td style={{width: '15%'}}>{fmtDate(item.data_vencimento)}</td> 
                            <td style={{width: '15%'}} className="text-center">
                                {isPontual(item.tipo_recorrencia) ? '-' : <span className="due-date">{fmtDate(item.data_vencimento)}</span>}
                            </td>
                            <td style={{width: '30%'}}>{item.descricao}</td>
                            <td style={{width: '15%'}}><span className="badge-cat" style={{backgroundColor: item.categoria_cor}}>{item.categoria_nome}</span></td>
                            <td style={{width: '15%'}}>{item.tipo_recorrencia}</td>
                            <td style={{width: '10%', fontWeight:'bold', color: '#e74c3c'}}>{fmt(item.valor)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseModal>
    );
}

// --- 2. MODAL ROTEIRO (AGENDA COMPLETA) ---
export function RoteiroModal({ onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros e Ordenação
    const [filtro, setFiltro] = useState('Todos'); // Todos, Pendente, Realizado, Perdido
    const [ordenacao, setOrdenacao] = useState('data_asc'); // data_asc, data_desc

    useEffect(() => {
        getRoteiroData().then(setData).finally(() => setLoading(false));
    }, []);

    // Lógica de Processamento
    const processData = () => {
        // 1. Filtrar
        let result = data.filter(item => {
            if (filtro === 'Todos') return true;
            return item.status === filtro;
        });

        // 2. Ordenar por DATA DO COMPROMISSO (data_inicio)
        result.sort((a, b) => {
            const dateA = new Date(a.data_inicio);
            const dateB = new Date(b.data_inicio);

            if (ordenacao === 'data_asc') return dateA - dateB; // Antiga -> Nova
            if (ordenacao === 'data_desc') return dateB - dateA; // Nova -> Antiga
            return 0;
        });

        return result;
    };

    const filteredData = processData();
    const fmtDateFull = (d) => new Date(d).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});

    const getStatusColor = (status) => {
        if(status === 'Realizado') return '#10b981';
        if(status === 'Perdido') return '#ef4444';
        return '#3b82f6';
    };

    return (
        <BaseModal title="Agenda Completa" onClose={onClose} loading={loading}>
            
            <div className="table-filter-bar">
                <div className="filter-group">
                    <button className={`filter-pill ${filtro==='Todos'?'active':''}`} onClick={()=>setFiltro('Todos')}>Todos</button>
                    <button className={`filter-pill ${filtro==='Pendente'?'active':''}`} onClick={()=>setFiltro('Pendente')}>Pendentes</button>
                    <button className={`filter-pill ${filtro==='Realizado'?'active':''}`} onClick={()=>setFiltro('Realizado')}>Realizados</button>
                    <button className={`filter-pill ${filtro==='Perdido'?'active':''}`} onClick={()=>setFiltro('Perdido')}>Perdidos</button>
                </div>

                <div className="sort-group">
                    <label>Ordenar por:</label>
                    <select className="sort-select" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
                        <option value="data_asc">Data (Antiga → Nova)</option>
                        <option value="data_desc">Data (Nova → Antiga)</option>
                    </select>
                </div>
            </div>

            <table className="panorama-table">
                <thead>
                    <tr>
                        <th style={{width: '25%'}}>Data/Hora</th>
                        <th style={{width: '55%'}}>Título</th>
                        <th style={{width: '20%'}}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.length === 0 && <tr><td colSpan="3" className="empty-cell">Nenhum compromisso encontrado.</td></tr>}
                    {filteredData.map(item => (
                        <tr key={item.id}>
                            <td style={{width: '25%'}}>{fmtDateFull(item.data_inicio)}</td>
                            <td style={{width: '55%'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                    <div style={{width:10, height:10, borderRadius:'50%', backgroundColor: item.cor}}></div>
                                    {item.titulo}
                                </div>
                            </td>
                            <td style={{width: '20%'}}>
                                <span style={{
                                    fontWeight: '600', 
                                    color: getStatusColor(item.status),
                                    backgroundColor: getStatusColor(item.status) + '20',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem'
                                }}>
                                    {item.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseModal>
    );
}

// --- 3. MODAL REGISTROS (APENAS TAREFAS) ---
export function RegistrosModal({ onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados de Controle
    const [filtroPrio, setFiltroPrio] = useState('Todas'); // Todas, Crítica, Alta, Média, Baixa
    const [ordenacao, setOrdenacao] = useState('data_desc'); // data_desc (Nova), data_asc (Antiga)

    useEffect(() => {
        getRegistrosResumoData().then(result => {
            // Filtra APENAS Tarefas assim que os dados chegam
            const apenasTarefas = result.filter(item => item.tipo === 'Tarefa');
            setData(apenasTarefas);
        }).finally(() => setLoading(false));
    }, []);

    // Lógica de Processamento
    const processData = () => {
        // 1. Filtrar por Prioridade
        let result = data.filter(item => {
            if (filtroPrio === 'Todas') return true;
            return item.grupo_ou_prioridade === filtroPrio;
        });

        // 2. Ordenar por Data de Criação (Fallback para Entrega se o back mandar)
        result.sort((a, b) => {
            // Nota: Se o backend enviar 'prazo' ou 'data_conclusao', altere aqui.
            // Por enquanto usamos data_criacao para garantir ordenação funcional.
            const dateA = new Date(a.data_criacao);
            const dateB = new Date(b.data_criacao);

            if (ordenacao === 'data_asc') return dateA - dateB;  // Antiga -> Nova
            if (ordenacao === 'data_desc') return dateB - dateA; // Nova -> Antiga
            return 0;
        });

        return result;
    };

    const filteredData = processData();
    const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');

    // Helper para mapear classes CSS de prioridade
    const getPrioClass = (prio) => {
        switch(prio) {
            case 'Crítica': return 'critica';
            case 'Alta': return 'alta';
            case 'Média': return 'media';
            case 'Baixa': return 'baixa';
            default: return '';
        }
    };

    return (
        <BaseModal title="Gerenciamento de Tarefas" onClose={onClose} loading={loading}>
            <div className="table-filter-bar">
                <div className="filter-group">
                    <button className={`filter-pill ${filtroPrio==='Todas'?'active':''}`} onClick={()=>setFiltroPrio('Todas')}>Todas</button>
                    <button className={`filter-pill ${filtroPrio==='Crítica'?'active':''}`} onClick={()=>setFiltroPrio('Crítica')}>Crítica</button>
                    <button className={`filter-pill ${filtroPrio==='Alta'?'active':''}`} onClick={()=>setFiltroPrio('Alta')}>Alta</button>
                    <button className={`filter-pill ${filtroPrio==='Média'?'active':''}`} onClick={()=>setFiltroPrio('Média')}>Média</button>
                    <button className={`filter-pill ${filtroPrio==='Baixa'?'active':''}`} onClick={()=>setFiltroPrio('Baixa')}>Baixa</button>
                </div>

                <div className="sort-group">
                    <label>Ordenar por:</label>
                    <select className="sort-select" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
                        <option value="data_desc">Data (Mais Nova)</option>
                        <option value="data_asc">Data (Mais Antiga)</option>
                    </select>
                </div>
            </div>

            <table className="panorama-table">
                <thead>
                    <tr>
                        <th style={{width: '15%'}}>Data</th>
                        <th style={{width: '55%'}}>Título</th>
                        <th style={{width: '15%'}}>Prioridade</th>
                        <th style={{width: '15%'}}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.length === 0 && <tr><td colSpan="4" className="empty-cell">Nenhuma tarefa encontrada.</td></tr>}
                    {filteredData.map(item => (
                        <tr key={item.id}>
                            <td style={{width: '15%'}}>{fmtDate(item.data_criacao)}</td>
                            <td style={{width: '55%'}}>{item.titulo}</td>
                            <td style={{width: '15%'}}>
                                <span className={`prio-tag ${getPrioClass(item.grupo_ou_prioridade)}`}>
                                    {item.grupo_ou_prioridade}
                                </span>
                            </td>
                            <td style={{width: '15%'}}>
                                {item.status === 'Concluído' 
                                    ? <span style={{color: '#10b981', fontWeight: '600'}}><i className="fa-solid fa-check"></i> Feito</span>
                                    : <span style={{color: '#f59e0b', fontWeight: '500'}}>{item.status}</span>
                                }
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseModal>
    );
}