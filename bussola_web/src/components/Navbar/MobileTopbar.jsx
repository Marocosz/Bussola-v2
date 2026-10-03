/** Topbar fina do celular: título do módulo (ou da sub-rota, com Voltar), ações da página, IA e conta. */
export function MobileTopbar({ title, onBack, aiContext, user, onOpenAccount, slotRef, onOpenAi }) {
    return (
        <header className="m-topbar">
            <div className="m-topbar-lead">
                {onBack && (
                    <button type="button" className="m-topbar-btn m-topbar-back" aria-label="Voltar" onClick={onBack}>
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                )}
                <h1 className="m-topbar-title">{title}</h1>
            </div>
            <div className="m-topbar-actions">
                <div className="m-topbar-slot" ref={slotRef} />
                {aiContext && (
                    <button type="button" className="m-topbar-btn is-ai" aria-label="Assistente de IA" onClick={onOpenAi}>
                        <i className="fa-solid fa-robot"></i>
                    </button>
                )}
                <button type="button" className="m-topbar-avatar" aria-label="Minha conta" onClick={onOpenAccount}>
                    {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <i className="fa-solid fa-user"></i>}
                </button>
            </div>
        </header>
    );
}
