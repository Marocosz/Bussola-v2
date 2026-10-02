import { TextoInline } from './TextoInline';

export function Definicao({ bloco }) {
    return (
        <dl className="bloco-definicao">
            <dt>{bloco.termo}</dt>
            <dd><TextoInline texto={bloco.definicao} /></dd>
        </dl>
    );
}
