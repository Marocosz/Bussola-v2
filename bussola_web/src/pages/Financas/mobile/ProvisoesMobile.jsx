import { useState } from 'react';
import { Segmented } from '../../../components/mobile/Segmented';
import { segmentedPanelProps } from '../../../components/mobile/segmentedIds';
import { Fab } from '../../../components/mobile/Fab';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { MetasTab } from '../../Metas/MetasTab';
import { KpiStrip } from './KpiStrip';
import { TransacoesTab } from './TransacoesTab';
import { CategoriasTab } from './CategoriasTab';

const ABAS = [
    { value: 'transacoes', label: 'Transações' },
    { value: 'metas', label: 'Metas' },
    { value: 'categorias', label: 'Categorias' },
];

const NOVA_TRANSACAO = [
    { key: 'pontual', icon: 'fa-solid fa-circle-dot', label: 'Pontual' },
    { key: 'parcelada', icon: 'fa-solid fa-layer-group', label: 'Parcelada' },
    { key: 'recorrente', icon: 'fa-solid fa-rotate', label: 'Recorrente' },
];

/** Provisões no celular (≤768): KPIs, abas e o Fab da aba ativa. Estado e handlers vêm da página. */
export function ProvisoesMobile({
    data, loading, transactions, filters, sortConfig, onSearch, onApplyFilters, onClearFilter,
    kpis, onOpenCaixa, onNewTransaction, onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre,
    catView, onCatView, onNewCategory, onEditCategory, onDeleteCategory,
}) {
    const [aba, setAba] = useState('transacoes');
    const [novaAberta, setNovaAberta] = useState(false);
    const rowProps = { onUpdate, onEdit, onEditCofre, onToggleCofre, onDeleteCofre };

    return (
        <div className="m-prov">
            <KpiStrip {...kpis} onOpenCaixa={onOpenCaixa} />

            <Segmented label="Seções de Provisões" options={ABAS} value={aba} onChange={setAba} className="m-prov-tabs" idBase="m-prov" />

            <div className="m-prov-panel" {...segmentedPanelProps('m-prov', aba)}>
                {aba === 'transacoes' && (
                    <>
                        <TransacoesTab
                            data={data}
                            loading={loading}
                            transactions={transactions}
                            filters={filters}
                            sortConfig={sortConfig}
                            onSearch={onSearch}
                            onApplyFilters={onApplyFilters}
                            onClearFilter={onClearFilter}
                            rowProps={rowProps}
                        />
                        <Fab label="Nova transação" onClick={() => setNovaAberta(true)} />
                    </>
                )}
                {aba === 'metas' && <MetasTab onUpdate={onUpdate} />}
                {aba === 'categorias' && (
                    <CategoriasTab
                        data={data}
                        catView={catView}
                        onCatView={onCatView}
                        onNew={onNewCategory}
                        onEdit={onEditCategory}
                        onDelete={onDeleteCategory}
                    />
                )}
            </div>

            <ActionSheet
                open={novaAberta}
                onClose={() => setNovaAberta(false)}
                title="Nova transação"
                icon="fa-solid fa-plus"
                actions={NOVA_TRANSACAO.map((o) => ({ ...o, onClick: () => onNewTransaction(o.key) }))}
            />
        </div>
    );
}
