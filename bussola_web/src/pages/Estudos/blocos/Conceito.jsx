import { TextoInline } from './TextoInline';

export function Conceito({ bloco }) {
    return (
        <div className="bloco-conceito">
            <div className="bloco-rotulo"><i className="fa-solid fa-shapes"></i> Conceito</div>
            <h3>{bloco.titulo}</h3>
            <p><TextoInline texto={bloco.texto} /></p>
        </div>
    );
}
