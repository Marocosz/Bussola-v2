import { useState } from 'react';
import { createCompromisso, updateCompromisso } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { BaseModal } from '../../../components/BaseModal';
import { DateTimePicker } from '../../../components/Pickers';
import { useIsMobile } from '../../../hooks/useIsMobile';

// 'AAAA-MM-DDTHH:mm' local a partir do data_hora da API (mesmo formato do DateTimePicker).
function toInputValue(dataHora) {
    const d = new Date(dataHora);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Form de compromisso. O pai monta só enquanto está aberto e troca a `key` entre
 * "novo" e cada edição, então o estado inicial vem direto das props (sem effect).
 * initialDate (opcional, 'AAAA-MM-DDTHH:mm'): data/hora já preenchida num compromisso novo.
 * No celular o BaseModal vira sheet: campos empilhados, lembrete no corpo e o
 * rodapé só com Cancelar/Salvar (50/50).
 */
export function AgendaModal({ active, closeModal, onUpdate, editingData, initialDate = '' }) {
    const { addToast } = useToast();
    const isMobile = useIsMobile();

    const [titulo, setTitulo] = useState(() => editingData?.titulo ?? '');
    const [dataHora, setDataHora] = useState(() => (editingData ? toInputValue(editingData.data_hora) : initialDate));
    const [local, setLocal] = useState(() => editingData?.local || '');
    const [descricao, setDescricao] = useState(() => editingData?.descricao || '');
    const [lembrete, setLembrete] = useState(() => !!editingData?.lembrete);

    if (!active) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { titulo, data_hora: dataHora, local, descricao, lembrete };

        try {
            if (editingData) {
                await updateCompromisso(editingData.id, payload);
                addToast({type:'success', title:'Atualizado', description:'Compromisso salvo.'});
            } else {
                await createCompromisso(payload);
                addToast({type:'success', title:'Criado', description:'Novo compromisso.'});
            }
            onUpdate();
            closeModal();
        } catch {
            addToast({type:'error', title:'Erro', description:'Falha ao salvar.'});
        }
    };

    const campoLembrete = (
        <div className="form-group-checkbox agenda-lembrete" style={isMobile ? undefined : { marginRight: 'auto' }}>
            <input
                type="checkbox"
                checked={lembrete}
                onChange={e => setLembrete(e.target.checked)}
                id="lembrete-check"
                style={{width:'18px', height:'18px', cursor:'pointer'}}
            />
            <label htmlFor="lembrete-check" style={{cursor:'pointer'}}>Ativar Lembrete</label>
        </div>
    );

    return (
        <BaseModal onClose={closeModal} className="modal agenda-modal">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{editingData ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
                    <span className="close-btn" role="button" aria-label="Fechar" onClick={closeModal}>&times;</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{flexGrow:2}}>
                                <label>Título</label>
                                <input
                                    className="form-input"
                                    value={titulo}
                                    onChange={e => setTitulo(e.target.value)}
                                    required
                                    placeholder="Ex: Reunião de Equipe"
                                />
                            </div>
                            <div className="form-group" style={{flexGrow:1}}>
                                <DateTimePicker
                                    label="Data e Hora"
                                    value={dataHora}
                                    onChange={e => setDataHora(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Local (Opcional)</label>
                            <input
                                className="form-input"
                                value={local}
                                onChange={e => setLocal(e.target.value)}
                                placeholder="Ex: Sala de Reunião 1 ou Google Meet"
                            />
                        </div>
                        <div className="form-group">
                            <label>Descrição (Opcional)</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                value={descricao}
                                onChange={e => setDescricao(e.target.value)}
                                placeholder="Detalhes adicionais..."
                            ></textarea>
                        </div>
                        {isMobile && campoLembrete}
                    </div>
                    <div className="modal-footer">
                        {!isMobile && campoLembrete}
                        <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button type="submit" className="btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
}
