// Aviso discreto quando a lib não consegue renderizar o bloco (Mermaid/LaTeX inválido).
// Mostra o código-fonte como texto (nunca HTML) e não afeta os outros blocos.
export function AvisoRender({ titulo, detalhe, fonte }) {
    return (
        <div className="bloco-aviso-render" role="note">
            <div className="bloco-aviso-render-titulo">
                <i className="fa-solid fa-triangle-exclamation"></i> {titulo}
            </div>
            {detalhe && <p>{detalhe}</p>}
            <pre>{fonte}</pre>
        </div>
    );
}
