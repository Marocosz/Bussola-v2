import { TextoInline } from './TextoInline';

export function Analogia({ bloco }) {
    return (
        <div className="bloco-analogia">
            <i className="fa-solid fa-lightbulb"></i>
            <div>
                <div className="bloco-rotulo">Analogia</div>
                <p><TextoInline texto={bloco.texto} /></p>
            </div>
        </div>
    );
}
