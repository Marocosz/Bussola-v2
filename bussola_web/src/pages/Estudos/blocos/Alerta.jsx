import { TextoInline } from './TextoInline';

const ICONES = { dica: 'fa-circle-info', atencao: 'fa-triangle-exclamation', erro: 'fa-circle-xmark' };
const ROTULOS = { dica: 'Dica', atencao: 'Atenção', erro: 'Erro comum' };

export function Alerta({ bloco }) {
    const nivel = ICONES[bloco.nivel] ? bloco.nivel : 'dica';
    return (
        <aside className={`bloco-alerta ${nivel}`}>
            <i className={`fa-solid ${ICONES[nivel]}`}></i>
            <div>
                <strong>{bloco.titulo || ROTULOS[nivel]}</strong>
                <p><TextoInline texto={bloco.texto} /></p>
            </div>
        </aside>
    );
}
