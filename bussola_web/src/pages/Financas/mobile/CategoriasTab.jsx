import { Segmented } from '../../../components/mobile/Segmented';
import { Fab } from '../../../components/mobile/Fab';
import { CategoryCard } from '../components/CategoryCard';

const VISOES = [
    { value: 'despesa', label: 'Despesas', icon: 'fa-solid fa-arrow-trend-down' },
    { value: 'receita', label: 'Receitas', icon: 'fa-solid fa-arrow-trend-up' },
];

/** Aba Categorias: os CategoryCard atuais em lista + alternância Despesas/Receitas. */
export function CategoriasTab({ data, catView, onCatView, onNew, onEdit, onDelete }) {
    const lista = catView === 'receita' ? (data?.categorias_receita || []) : (data?.categorias_despesa || []);
    return (
        <div className="m-cats">
            <Segmented label="Tipo de categoria" options={VISOES} value={catView} onChange={onCatView} className="m-cats-switch" />
            <div className="categoria-list">
                {lista.map((cat) => (
                    <CategoryCard key={cat.id} categoria={cat} onEdit={onEdit} onDelete={onDelete} />
                ))}
                {!lista.length && (
                    <p className="empty-list-msg">Nenhuma categoria de {catView === 'receita' ? 'receita' : 'despesa'}.</p>
                )}
            </div>
            <Fab label="Nova categoria" onClick={onNew} />
        </div>
    );
}
