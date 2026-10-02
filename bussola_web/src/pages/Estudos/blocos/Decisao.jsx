import { TextoInline } from './TextoInline';

export function Decisao({ bloco }) {
    return (
        <div className="bloco-decisao">
            <div className="bloco-rotulo"><i className="fa-solid fa-signs-post"></i> Quando usar o quê</div>
            {bloco.regras.map((regra, i) => (
                <div key={i} className="bloco-decisao-regra">
                    <span className="bloco-decisao-se">{regra.se}</span>
                    <i className="fa-solid fa-arrow-right"></i>
                    <span className="bloco-decisao-entao"><TextoInline texto={regra.entao} /></span>
                </div>
            ))}
        </div>
    );
}
