/** Barra do Caderno no celular: busca de largura total e chips de grupo (rolagem horizontal). */
export function CadernoToolbar({ searchTerm, onSearch, grupos, filtroGrupo, onFiltro, temIndefinido, onOpenGrupos }) {
    const chip = (valor, rotulo, cor) => (
        <button
            key={valor}
            type="button"
            className={`reg-chip ${filtroGrupo === valor ? 'active' : ''}`}
            aria-pressed={filtroGrupo === valor}
            onClick={() => onFiltro(valor)}
        >
            {cor && <span className="reg-chip-dot" style={{ backgroundColor: cor }}></span>}
            <span>{rotulo}</span>
        </button>
    );

    return (
        <div className="reg-m-toolbar">
            <label className="reg-m-search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Buscar anotações..."
                    aria-label="Buscar anotações"
                    enterKeyHint="search"
                />
            </label>
            <div className="reg-m-chips" role="group" aria-label="Filtrar por grupo" data-offscreen-ok>
                {chip('Todos', 'Todos')}
                {grupos.map((g) => chip(g.nome, g.nome, g.cor))}
                {temIndefinido && chip('Indefinido', 'Indefinido', '#ccc')}
                <button type="button" className="reg-chip reg-chip-ghost" onClick={onOpenGrupos} aria-haspopup="dialog">
                    <i className="fa-regular fa-folder-open" aria-hidden="true"></i>
                    <span>Grupos</span>
                </button>
            </div>
        </div>
    );
}
