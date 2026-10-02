import { paragrafos } from './inline';
import { TextoInline } from './TextoInline';

export function Texto({ bloco }) {
    return (
        <div className="bloco-texto">
            {paragrafos(bloco.conteudo).map((p, i) => (
                <p key={i}><TextoInline texto={p} /></p>
            ))}
        </div>
    );
}
