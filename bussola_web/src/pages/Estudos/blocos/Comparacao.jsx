export function Comparacao({ bloco }) {
    return (
        <div className="bloco-comparacao">
            <table>
                <thead>
                    <tr>
                        <th scope="col" className="bloco-comparacao-criterio">Critério</th>
                        {bloco.colunas.map((coluna, i) => <th key={i} scope="col">{coluna}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {bloco.linhas.map((linha, i) => (
                        <tr key={i}>
                            <th scope="row">{linha.rotulo}</th>
                            {linha.valores.map((valor, j) => (
                                <td key={j} className={linha.destaque === j ? 'destaque' : undefined}>
                                    {linha.destaque === j && <i className="fa-solid fa-trophy" title="Melhor neste critério"></i>}
                                    {valor}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
