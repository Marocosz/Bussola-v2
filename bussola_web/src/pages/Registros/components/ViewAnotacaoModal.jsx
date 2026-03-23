import React, { useState } from 'react';
import { BaseModal } from '../../../components/BaseModal';
import { MarkdownViewer } from './MarkdownViewer';
import '../styles.css';
import '../styles/markdown.css';

const isHtmlContent = (str) => str && /<[a-z][\s\S]*>/i.test(str);

// Converte markdown para texto puro removendo sintaxe
const markdownToPlainText = (md) =>
    md
        .replace(/#{1,6}\s+/g, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/`{1,3}[^`]*`{1,3}/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[>-]\s+/gm, '')
        .replace(/\n{2,}/g, '\n')
        .trim();

export function ViewAnotacaoModal({ active, closeModal, nota, onEdit }) {
    const [copyState, setCopyState] = useState(null); // null | 'md' | 'text'

    if (!active || !nota) return null;

    const grupoCor  = nota.grupo?.cor || '#ccc';
    const grupoNome = nota.grupo?.nome || null;

    const dataFormatada = new Date(nota.data_criacao).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const conteudoIsHtml = isHtmlContent(nota.conteudo);

    const handleCopy = async (type) => {
        const text = type === 'md'
            ? nota.conteudo
            : conteudoIsHtml
                ? nota.conteudo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                : markdownToPlainText(nota.conteudo || '');

        try {
            await navigator.clipboard.writeText(text);
            setCopyState(type);
            setTimeout(() => setCopyState(null), 2000);
        } catch (e) {
            console.error('Erro ao copiar:', e);
        }
    };

    return (
        <BaseModal onClose={closeModal} className="registros-scope">
            <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ──────────────────────────────────────── */}
                <div className="view-modal-header" style={{ borderLeft: `6px solid ${grupoCor}` }}>
                    <div className="view-header-top-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {grupoNome && (
                                <span className="view-group-badge" style={{ backgroundColor: grupoCor }}>
                                    {grupoNome}
                                </span>
                            )}
                            {nota.fixado && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '0.72rem', color: 'var(--cor-azul-primario)',
                                    background: 'rgba(74,109,255,0.1)', borderRadius: '12px',
                                    padding: '2px 8px', fontWeight: 600,
                                }}>
                                    <i className="fa-solid fa-thumbtack"></i> Fixado
                                </span>
                            )}
                        </div>
                        <span className="close-btn" onClick={closeModal} title="Fechar">&times;</span>
                    </div>
                    <div className="view-header-main">
                        <h2 className="view-title">{nota.titulo}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span className="view-date">
                                <i className="fa-regular fa-clock"></i> {dataFormatada}
                            </span>
                            {/* Botões de cópia */}
                            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                                {!conteudoIsHtml && (
                                    <button
                                        className="md-icon-btn"
                                        onClick={() => handleCopy('md')}
                                        title="Copiar Markdown"
                                        style={{ fontSize: '0.78rem', padding: '3px 10px', border: '1px solid var(--cor-borda)', borderRadius: '6px' }}
                                    >
                                        {copyState === 'md'
                                            ? <><i className="fa-solid fa-check"></i> Copiado!</>
                                            : <><i className="fa-brands fa-markdown"></i> Copiar MD</>
                                        }
                                    </button>
                                )}
                                <button
                                    className="md-icon-btn"
                                    onClick={() => handleCopy('text')}
                                    title="Copiar como texto simples"
                                    style={{ fontSize: '0.78rem', padding: '3px 10px', border: '1px solid var(--cor-borda)', borderRadius: '6px' }}
                                >
                                    {copyState === 'text'
                                        ? <><i className="fa-solid fa-check"></i> Copiado!</>
                                        : <><i className="fa-regular fa-copy"></i> Copiar texto</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Conteúdo ─────────────────────────────────────── */}
                <div className="modal-body view-body">
                    {nota.conteudo?.trim() ? (
                        <MarkdownViewer content={nota.conteudo} />
                    ) : (
                        <p style={{ color: 'var(--cor-texto-secundario)', fontStyle: 'italic', opacity: 0.6 }}>
                            Esta nota não tem conteúdo.
                        </p>
                    )}

                    {/* Links anexados */}
                    {nota.links && nota.links.length > 0 && (
                        <div className="view-links-container">
                            <h4 className="links-title">
                                <i className="fa-solid fa-link"></i> Links Anexados
                            </h4>
                            <div className="links-list-view">
                                {nota.links.map(link => (
                                    <a
                                        key={link.id}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="link-item-view"
                                    >
                                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                        <span>{link.url}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────── */}
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={closeModal}>Fechar</button>
                    <button
                        className="btn-primary"
                        onClick={() => { onEdit(nota); closeModal(); }}
                    >
                        <i className="fa-solid fa-pen-to-square"></i> Editar Nota
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
