import React, { useState } from 'react';
import { BaseModal } from '../../../components/BaseModal';
import { MarkdownViewer } from './MarkdownViewer';
import { exportAnotacaoPdf } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import '../styles.css';
import '../styles/markdown.css';
import { logger } from '../../../utils/logger';

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
    const [pdfLoading, setPdfLoading] = useState(false);
    const { addToast } = useToast();

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
            logger.error("Erro ao copiar", { error: String(e) });
        }
    };

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const blob = await exportAnotacaoPdf({
                titulo: nota.titulo || 'Sem título',
                conteudo: nota.conteudo || '',
                grupo_nome: nota.grupo?.nome || null,
                grupo_cor: nota.grupo?.cor || null,
                data_criacao: nota.data_criacao,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(nota.titulo || 'nota').toLowerCase().replace(/\s+/g, '-')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            logger.error("Erro ao gerar PDF", { error: String(e) });
            addToast('Erro ao gerar o PDF. Tente novamente.', 'error');
        } finally {
            setPdfLoading(false);
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
                                <button
                                    className="md-icon-btn"
                                    onClick={handleDownloadPdf}
                                    disabled={pdfLoading}
                                    title="Baixar como PDF"
                                    style={{
                                        fontSize: '0.78rem',
                                        padding: '3px 10px',
                                        border: '1px solid rgba(74,109,255,0.3)',
                                        borderRadius: '6px',
                                        background: 'rgba(74,109,255,0.1)',
                                        color: 'var(--cor-azul-primario)',
                                        cursor: pdfLoading ? 'wait' : 'pointer',
                                    }}
                                >
                                    {pdfLoading
                                        ? <><i className="fa-solid fa-spinner fa-spin"></i> Gerando...</>
                                        : <><i className="fa-solid fa-download"></i> Download</>
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
