// Índice da leitura: seções do material + quizzes/questões (com ✓/✗ quando respondidos) + Fontes.
// Usado na coluna lateral (desktop largo) e dentro do Sheet "Índice" (tablet/celular).

import { RESPONDIVEIS } from './indice';

export function IndiceLeitura({ itens, ativo, respondidos, progresso, onIr }) {
    const perguntas = itens.filter((i) => RESPONDIVEIS[i.tipo]);
    const feitas = perguntas.filter((i) => respondidos[i.bloco] !== undefined);
    const acertos = feitas.filter((i) => respondidos[i.bloco]).length;

    return (
        <nav className="estudo-indice" aria-label="Índice do material">
            <div className="estudo-indice-topo">
                <span className="estudo-indice-titulo">Neste material</span>
                <span className="estudo-indice-pct">{progresso}%</span>
            </div>
            <div className="estudo-indice-trilho" aria-hidden="true">
                <span style={{ width: `${progresso}%` }}></span>
            </div>

            <ol className="estudo-indice-lista">
                {itens.map((item) => {
                    const resposta = respondidos[item.bloco];
                    const icone = item.tipo === 'fontes' ? 'fa-book-bookmark' : RESPONDIVEIS[item.tipo];
                    return (
                        <li key={item.id}>
                            <a
                                href={`#${item.id}`}
                                className={`estudo-indice-item tipo-${item.tipo} ${ativo === item.id ? 'ativo' : ''}`}
                                aria-current={ativo === item.id ? 'location' : undefined}
                                onClick={(e) => { e.preventDefault(); onIr(item.id); }}
                            >
                                {icone && <i className={`fa-solid ${icone}`} aria-hidden="true"></i>}
                                <span className="estudo-indice-texto">{item.titulo}</span>
                                {resposta !== undefined && (
                                    <i
                                        className={`fa-solid ${resposta ? 'fa-circle-check acerto' : 'fa-circle-xmark erro'} estudo-indice-status`}
                                        aria-label={resposta ? 'Acertou' : 'Errou'}
                                    ></i>
                                )}
                            </a>
                        </li>
                    );
                })}
            </ol>

            {perguntas.length > 0 && (
                <p className="estudo-indice-resumo">
                    <i className="fa-solid fa-list-check"></i>
                    {feitas.length}/{perguntas.length} respondidas
                    {feitas.length > 0 && <> · {acertos} {acertos === 1 ? 'acerto' : 'acertos'}</>}
                </p>
            )}
        </nav>
    );
}
