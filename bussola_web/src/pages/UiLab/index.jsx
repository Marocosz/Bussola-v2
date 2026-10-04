import { useState } from 'react';
import { BaseModal } from '../../components/BaseModal';
import { Sheet } from '../../components/mobile/Sheet';
import { ActionSheet } from '../../components/mobile/ActionSheet';
import { Fab } from '../../components/mobile/Fab';
import { DatePicker, TimePicker } from '../../components/Pickers';
import { CustomSelect } from '../../components/CustomSelect';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { useConfirm } from '../../context/ConfirmDialogContext';

/** Bancada DEV-only (/__ui) para testar os primitivos mobile isoladamente. */
export function UiLab() {
    const [modal, setModal] = useState(false);
    const [formModal, setFormModal] = useState(false);
    const [aninhado, setAninhado] = useState(false);
    const [full, setFull] = useState(false);
    const [actions, setActions] = useState(false);
    const [ultima, setUltima] = useState('');
    const [data, setData] = useState('');
    const [hora, setHora] = useState('');
    const [cat, setCat] = useState('');
    const [periodo, setPeriodo] = useState('');
    const confirm = useConfirm();

    return (
        <div className="container" style={{ paddingTop: 24, paddingBottom: 1200 }}>
            <h2>UI Lab</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="btn-primary" onClick={() => setModal(true)}>Abrir modal longo</button>
                <button className="btn-primary" onClick={() => setFormModal(true)}>Abrir modal com form</button>
                <button className="btn-primary" onClick={() => setFull(true)}>Abrir sheet cheio</button>
                <button className="btn-primary" onClick={() => setActions(true)}>Abrir ações</button>
            </div>
            <p data-testid="ultima-acao">{ultima}</p>
            <div style={{ display: 'grid', gap: 12, maxWidth: 360, marginTop: 16 }}>
                <DatePicker label="Data" value={data} onChange={(e) => setData(e.target.value)} />
                <TimePicker label="Hora" value={hora} onChange={(e) => setHora(e.target.value)} />
                <CustomSelect label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}
                    options={[{ value: '1', label: 'Alimentação' }, { value: '2', label: 'Casa' }, { value: '3', label: 'Lazer' }]} />
                <DateRangeFilter onChange={(r) => setPeriodo(`${r.start}|${r.end}`)} />
                <p data-testid="valores">{`${data}|${hora}|${cat}|${periodo}`}</p>
            </div>

            {modal && (
                <BaseModal onClose={() => setModal(false)} className="modal">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Modal longo</h3>
                            <button type="button" className="app-sheet-close" aria-label="Fechar" onClick={() => setModal(false)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            {Array.from({ length: 14 }, (_, i) => (
                                <div className="form-group" key={i}>
                                    <label>Campo {i + 1}</label>
                                    <input className="form-input" />
                                </div>
                            ))}
                            <DatePicker label="Data no modal" value={data} onChange={(e) => setData(e.target.value)} />
                            <p>Fim do conteúdo</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => confirm({ title: 'Confirmar?', description: 'Teste aninhado' })}>
                                Abrir confirmação
                            </button>
                            <button className="btn-secondary" onClick={() => setAninhado(true)}>Abrir sheet aninhado</button>
                            <button className="btn-primary">Salvar</button>
                        </div>
                    </div>
                </BaseModal>
            )}

            {formModal && (
                <BaseModal onClose={() => setFormModal(false)} className="modal">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Modal com form</h3>
                            <button type="button" className="app-sheet-close" aria-label="Fechar" onClick={() => setFormModal(false)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={(e) => e.preventDefault()}>
                            <div className="modal-body">
                                {Array.from({ length: 14 }, (_, i) => (
                                    <div className="form-group" key={i}>
                                        <label>Campo form {i + 1}</label>
                                        <input className="form-input" />
                                    </div>
                                ))}
                                <p>Fim do form</p>
                            </div>
                            <div className="modal-footer">
                                <button type="submit" className="btn-primary">Salvar form</button>
                            </div>
                        </form>
                    </div>
                </BaseModal>
            )}

            <Sheet open={aninhado} onClose={() => setAninhado(false)} title="Aninhado">
                <p>Sheet por cima do modal.</p>
            </Sheet>

            <Sheet open={full} onClose={() => setFull(false)} full title="Sheet cheio">
                <p>Conteúdo em tela cheia.</p>
            </Sheet>

            <ActionSheet
                open={actions}
                onClose={() => setActions(false)}
                title="Aluguel · parcela 10/12"
                subtitle="05/10 · Casa · pendente"
                icon="fa-solid fa-house"
                actions={[
                    { key: 'efetivar', icon: 'fa-solid fa-check', label: 'Efetivar pagamento', variant: 'primary', onClick: () => setUltima('efetivar') },
                    { key: 'editar', icon: 'fa-solid fa-pen-to-square', label: 'Editar', onClick: () => setUltima('editar') },
                    { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => setUltima('excluir') },
                ]}
            />

            <Fab label="Novo item" onClick={() => setUltima('fab')} />
        </div>
    );
}