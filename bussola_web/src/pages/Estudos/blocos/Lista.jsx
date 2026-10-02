import { TextoInline } from './TextoInline';

export function Lista({ bloco }) {
    const checklist = bloco.estilo === 'checklist';
    return (
        <ul className={`bloco-lista ${checklist ? 'checklist' : ''}`}>
            {bloco.itens.map((item, i) => (
                <li key={i}>
                    {checklist && <i className="fa-regular fa-square-check"></i>}
                    <span><TextoInline texto={item} /></span>
                </li>
            ))}
        </ul>
    );
}
