export function Secao({ bloco }) {
    const ancora = `secao-${bloco.id}`;
    return (
        <h2 className="bloco-secao" id={ancora}>
            <a href={`#${ancora}`} className="bloco-secao-ancora" aria-hidden="true" tabIndex={-1}>#</a>
            {bloco.titulo}
        </h2>
    );
}
