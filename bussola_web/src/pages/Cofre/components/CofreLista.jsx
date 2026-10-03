import { useMemo, useState } from 'react';
import { ActionSheet } from '../../../components/mobile/ActionSheet';
import { filtrarSegredos, validadeInfo } from '../cofreLista';

/**
 * Lista compacta do Cofre no celular (estilo gerenciador de senhas): uma linha por segredo,
 * o olho como ação primária e o "⋯" com as demais. A linha em si não é clicável, para
 * nenhum toque acidental revelar uma senha.
 */
export function CofreLista({ segredos, onVer, onEditar, onNotas, onExcluir }) {
    const [busca, setBusca] = useState('');
    const [acoesDe, setAcoesDe] = useState(null);
    const visiveis = useMemo(() => filtrarSegredos(segredos, busca), [segredos, busca]);

    const acoes = acoesDe ? [
        { key: 'editar', icon: 'fa-solid fa-pencil', label: 'Editar', onClick: () => onEditar(acoesDe) },
        ...(acoesDe.notas
            ? [{ key: 'notas', icon: 'fa-solid fa-note-sticky', label: 'Ver notas', onClick: () => onNotas(acoesDe) }]
            : []),
        { key: 'excluir', icon: 'fa-solid fa-trash-can', label: 'Excluir', variant: 'danger', onClick: () => onExcluir(acoesDe.id) },
    ] : [];

    return (
        <div className="cofre-m">
            <label className="cofre-m-busca">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                    type="search"
                    className="form-input"
                    placeholder="Buscar por título ou serviço"
                    aria-label="Buscar segredos"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                />
            </label>

            {segredos.length === 0 ? (
                <div className="cofre-m-vazio">
                    <i className="fa-solid fa-shield-cat"></i>
                    <p>Nenhum segredo guardado no momento.</p>
                </div>
            ) : visiveis.length === 0 ? (
                <p className="cofre-m-nada">Nenhum segredo encontrado para “{busca.trim()}”.</p>
            ) : (
                <ul className="cofre-m-lista">
                    {visiveis.map((s) => {
                        const validade = validadeInfo(s.data_expiracao);
                        return (
                            <li key={s.id} className="cofre-m-item">
                                <span className="cofre-m-icone" aria-hidden="true">
                                    <i className="fa-solid fa-key"></i>
                                </span>
                                <div className="cofre-m-textos">
                                    <strong className="cofre-m-titulo">{s.titulo}</strong>
                                    <span className="cofre-m-sub">
                                        {s.servico && <span className="service-tag">{s.servico}</span>}
                                        {s.data_expiracao && (
                                            <span className={`cofre-m-validade is-${validade.nivel}`}>{validade.texto}</span>
                                        )}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="cofre-m-ver"
                                    aria-label={`Ver senha de ${s.titulo}`}
                                    onClick={() => onVer(s)}
                                >
                                    <i className="fa-solid fa-eye"></i>
                                </button>
                                <button
                                    type="button"
                                    className="cofre-m-mais"
                                    aria-label={`Mais ações de ${s.titulo}`}
                                    aria-haspopup="dialog"
                                    onClick={() => setAcoesDe(s)}
                                >
                                    <i className="fa-solid fa-ellipsis"></i>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ActionSheet
                open={Boolean(acoesDe)}
                onClose={() => setAcoesDe(null)}
                title={acoesDe?.titulo}
                subtitle={acoesDe?.servico || undefined}
                icon="fa-solid fa-key"
                actions={acoes}
            />
        </div>
    );
}
