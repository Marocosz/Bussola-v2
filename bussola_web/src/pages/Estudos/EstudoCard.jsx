import React from 'react';
import { Link } from 'react-router-dom';
import { NIVEIS, tipoDe } from './constantes';

// Card de material no formato "selo" do Caderno (Registros/AnotacaoCard):
// selo na cor do tema com o ícone do tipo, título + data, prévia e rodapé.
export const EstudoCard = React.memo(function EstudoCard({ material: m }) {
    const t = tipoDe(m.tipo);
    const cor = m.tema_cor || 'var(--cor-azul-primario)';
    const data = m.atualizado_em || m.criado_em;
    const dataStr = data ? new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';

    return (
        <Link
            to={`/estudos/${m.id}`}
            className={`estudo-card selo-card ${m.estudado ? 'estudado' : ''}`}
            style={{ '--card-accent': cor }}
        >
            <span className="selo-badge" style={{ '--selo-cor': cor }}>
                <i className={`fa-solid ${t.icone}`}></i>
            </span>

            <div className="estudo-card-header">
                <div className="estudo-card-titulo-grupo">
                    <h3 className="estudo-card-titulo">{m.titulo}</h3>
                    <span className="estudo-card-data">
                        {m.tema_nome || 'Sem tema'}{dataStr && ` · ${dataStr}`}
                    </span>
                </div>
                {m.estudado && (
                    <span className="estudo-card-estudado" title="Estudado">
                        <i className="fa-solid fa-circle-check"></i>
                    </span>
                )}
            </div>

            <div className="estudo-card-conteudo">
                {m.subtitulo || <span className="estudo-card-vazio">Sem descrição...</span>}
            </div>

            <div className="estudo-card-rodape">
                <span className={`estudo-etiqueta ${t.classe}`}>
                    <i className={`fa-solid ${t.icone}`}></i> {t.rotulo}
                </span>
                <span className="estudo-card-nivel">{NIVEIS[m.nivel] || m.nivel}</span>
                {m.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="estudo-tag">#{tag}</span>
                ))}
            </div>
        </Link>
    );
});
