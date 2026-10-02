import { TextoInline } from './TextoInline';

export function Passos({ bloco }) {
    return (
        <ol className="bloco-passos">
            {bloco.passos.map((passo, i) => (
                <li key={i}>
                    <strong>{passo.titulo}</strong>
                    <p><TextoInline texto={passo.texto} /></p>
                </li>
            ))}
        </ol>
    );
}
