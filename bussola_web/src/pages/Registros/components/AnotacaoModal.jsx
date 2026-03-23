import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import TurndownService from 'turndown';
import { createAnotacao, updateAnotacao } from '../../../services/api';
import { BaseModal } from '../../../components/BaseModal';
import { MarkdownViewer } from './MarkdownViewer';
import '../styles.css';
import '../styles/markdown.css';

// ─── Utilitários ────────────────────────────────────────────────────────────

const isHtmlContent = (str) => str && /<[a-z][\s\S]*>/i.test(str);

const htmlToMarkdown = (html) => {
    const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
    return td.turndown(html);
};

const getDraftKey = (editingData) =>
    `bussola_nota_draft_${editingData?.id ?? 'new'}`;

// Conta palavras (ignorando sintaxe markdown)
const countWords = (text) => {
    const clean = text.replace(/[#*`_~\[\]()>|+-]/g, ' ').trim();
    return clean ? clean.split(/\s+/).filter(Boolean).length : 0;
};

// ─── Toolbar buttons ─────────────────────────────────────────────────────────

const TOOLBAR_ACTIONS = [
    { label: 'B',      title: 'Negrito (Ctrl+B)',   wrap: ['**', '**'] },
    { label: 'I',      title: 'Itálico (Ctrl+I)',   wrap: ['*', '*'],  style: { fontStyle: 'italic' } },
    { label: 'S',      title: 'Tachado',            wrap: ['~~', '~~'], style: { textDecoration: 'line-through' } },
    null, // separator
    { label: 'H1',     title: 'Título 1',           prefix: '# ' },
    { label: 'H2',     title: 'Título 2',           prefix: '## ' },
    { label: 'H3',     title: 'Título 3',           prefix: '### ' },
    null,
    { label: '—',      title: 'Lista não ordenada', prefix: '- ' },
    { label: '1.',     title: 'Lista ordenada',     prefix: '1. ' },
    { label: '☑',      title: 'Checklist',          prefix: '- [ ] ' },
    null,
    { label: '`',      title: 'Código inline',      wrap: ['`', '`'] },
    { label: '```',    title: 'Bloco de código',    blockWrap: ['```\n', '\n```'] },
    { label: '❝',      title: 'Citação',            prefix: '> ' },
    null,
    { label: '⎯',      title: 'Linha horizontal',   insert: '\n---\n' },
    { label: '🔗',      title: 'Link',               linkTemplate: true },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export function AnotacaoModal({ active, closeModal, onUpdate, editingData, gruposDisponiveis }) {
    const [titulo, setTitulo]       = useState('');
    const [conteudo, setConteudo]   = useState('');
    const [grupoId, setGrupoId]     = useState('');
    const [fixado, setFixado]       = useState(false);
    const [links, setLinks]         = useState([]);
    const [newLink, setNewLink]     = useState('');
    const [loading, setLoading]     = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Editor state
    const [editorMode, setEditorMode]   = useState('edit'); // 'edit' | 'preview'
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [draftSaved, setDraftSaved]   = useState(false);
    const draftTimerRef = useRef(null);

    const dropdownRef = useRef(null);
    const textareaRef = useRef(null);

    // ── Word count / reading time ──────────────────────────────────
    const wordCount   = useMemo(() => countWords(conteudo), [conteudo]);
    const readingTime = useMemo(() => Math.max(1, Math.ceil(wordCount / 200)), [wordCount]);

    // ── Auto-save draft ────────────────────────────────────────────
    const saveDraft = useCallback((text) => {
        if (!text) return;
        const key = getDraftKey(editingData);
        localStorage.setItem(key, text);
        setDraftSaved(true);
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = setTimeout(() => setDraftSaved(false), 2000);
    }, [editingData]);

    const clearDraft = () => localStorage.removeItem(getDraftKey(editingData));

    // ── Init/reset on open ─────────────────────────────────────────
    useEffect(() => {
        if (!active) return;

        setEditorMode('edit');
        setIsFullscreen(false);
        setDropdownOpen(false);
        setNewLink('');

        if (editingData) {
            setTitulo(editingData.titulo);
            setGrupoId(editingData.grupo?.id || '');
            setFixado(editingData.fixado);
            setLinks(editingData.links ? editingData.links.map(l => l.url) : []);

            let content = editingData.conteudo || '';
            if (isHtmlContent(content)) content = htmlToMarkdown(content);
            setConteudo(content);
        } else {
            const draft = localStorage.getItem(getDraftKey(null));
            setTitulo('');
            setConteudo(draft || '');
            setGrupoId(gruposDisponiveis.length > 0 ? gruposDisponiveis[0].id : '');
            setFixado(false);
            setLinks([]);
        }
    }, [active, editingData]);

    // ── Fechar dropdown ao clicar fora ─────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Fechar fullscreen com Escape ───────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isFullscreen]);

    // ── Links ──────────────────────────────────────────────────────
    const handleAddLink = (e) => {
        e.preventDefault();
        if (newLink.trim()) { setLinks([...links, newLink.trim()]); setNewLink(''); }
    };

    const handleRemoveLink = (idx) => setLinks(links.filter((_, i) => i !== idx));

    // ── Salvar ─────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!titulo.trim()) return alert('O título é obrigatório');
        setLoading(true);
        const payload = {
            titulo,
            conteudo,
            grupo_id: grupoId ? Number(grupoId) : null,
            fixado,
            links,
        };
        try {
            editingData
                ? await updateAnotacao(editingData.id, payload)
                : await createAnotacao(payload);
            clearDraft();
            onUpdate();
            closeModal();
        } catch (err) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar anotação.');
        } finally {
            setLoading(false);
        }
    };

    // ── Toolbar: aplicar formatação no textarea ────────────────────
    const applyFormat = (action) => {
        const ta = textareaRef.current;
        if (!ta) return;

        const start = ta.selectionStart;
        const end   = ta.selectionEnd;
        const sel   = conteudo.substring(start, end);
        let newText = conteudo;
        let newCursor = end;

        if (action.insert) {
            newText   = conteudo.substring(0, start) + action.insert + conteudo.substring(end);
            newCursor = start + action.insert.length;

        } else if (action.linkTemplate) {
            const template = `[${sel || 'texto'}](url)`;
            newText   = conteudo.substring(0, start) + template + conteudo.substring(end);
            newCursor = start + template.length;

        } else if (action.blockWrap) {
            const [open, close] = action.blockWrap;
            newText   = conteudo.substring(0, start) + open + sel + close + conteudo.substring(end);
            newCursor = start + open.length + sel.length + close.length;

        } else if (action.wrap) {
            const [open, close] = action.wrap;
            newText   = conteudo.substring(0, start) + open + sel + close + conteudo.substring(end);
            newCursor = start + open.length + sel.length + close.length;

        } else if (action.prefix) {
            const lineStart = conteudo.lastIndexOf('\n', start - 1) + 1;
            newText   = conteudo.substring(0, lineStart) + action.prefix + conteudo.substring(lineStart);
            newCursor = end + action.prefix.length;
        }

        setConteudo(newText);
        saveDraft(newText);
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(newCursor, newCursor);
        }, 0);
    };

    // ── Keyboard shortcuts no textarea ────────────────────────────
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            applyFormat({ wrap: ['**', '**'] });
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            applyFormat({ wrap: ['*', '*'] });
        }
        // Tab = 4 espaços
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = textareaRef.current;
            const start = ta.selectionStart;
            const end   = ta.selectionEnd;
            const newText = conteudo.substring(0, start) + '    ' + conteudo.substring(end);
            setConteudo(newText);
            setTimeout(() => ta.setSelectionRange(start + 4, start + 4), 0);
        }
    };

    // ── Dropdown grupo ─────────────────────────────────────────────
    const selectedGroupObj = gruposDisponiveis.find(g => g.id == grupoId);
    const selectedLabel    = selectedGroupObj ? selectedGroupObj.nome : 'Sem Grupo';
    const selectedColor    = selectedGroupObj ? selectedGroupObj.cor : null;

    if (!active) return null;

    return (
        <BaseModal onClose={closeModal} className="registros-scope">
            <div
                className={`modal-content large-modal${isFullscreen ? ' md-modal-fullscreen' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────── */}
                <div className="modal-header">
                    <h2>{editingData ? 'Editar Anotação' : 'Nova Anotação'}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            className="md-icon-btn"
                            onClick={() => setIsFullscreen(f => !f)}
                            title={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
                            style={{ fontSize: '1rem' }}
                        >
                            <i className={`fa-solid fa-${isFullscreen ? 'compress' : 'expand'}`}></i>
                        </button>
                        <span className="close-btn" onClick={closeModal}>&times;</span>
                    </div>
                </div>

                {/* ── Body ───────────────────────────────────── */}
                <div className="modal-body">
                    {/* Título + Grupo */}
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label>Título</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Sobre o que é esta nota?"
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="form-group" style={{ flex: 1 }} ref={dropdownRef}>
                            <label>Grupo</label>
                            <div
                                className={`custom-select-trigger ${dropdownOpen ? 'open' : ''}`}
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {selectedColor && <span className="option-dot" style={{ backgroundColor: selectedColor }}></span>}
                                    <span>{selectedLabel}</span>
                                </div>
                                <i className="fa-solid fa-chevron-down arrow-icon"></i>
                            </div>
                            {dropdownOpen && (
                                <div className="custom-select-options">
                                    <div
                                        className={`custom-option ${!grupoId ? 'selected' : ''}`}
                                        onClick={() => { setGrupoId(''); setDropdownOpen(false); }}
                                    >
                                        Sem Grupo
                                    </div>
                                    {gruposDisponiveis.map(g => (
                                        <div
                                            key={g.id}
                                            className={`custom-option ${grupoId == g.id ? 'selected' : ''}`}
                                            onClick={() => { setGrupoId(g.id); setDropdownOpen(false); }}
                                        >
                                            <span className="option-dot" style={{ backgroundColor: g.cor }}></span>
                                            {g.nome}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Editor Markdown ──────────────────── */}
                    <div className="form-group editor-container" style={{ marginBottom: '0.5rem' }}>
                        <label>Conteúdo <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.8rem' }}>Markdown suportado</span></label>

                        <div className="md-editor-wrapper">
                            {/* Tabs */}
                            <div className="md-editor-tabs">
                                <div className="md-editor-tabs-left">
                                    <button
                                        className={`md-tab-btn ${editorMode === 'edit' ? 'active' : ''}`}
                                        onClick={() => { setEditorMode('edit'); setTimeout(() => textareaRef.current?.focus(), 50); }}
                                    >
                                        <i className="fa-solid fa-pen" style={{ marginRight: 5 }}></i>Escrever
                                    </button>
                                    <button
                                        className={`md-tab-btn ${editorMode === 'preview' ? 'active' : ''}`}
                                        onClick={() => setEditorMode('preview')}
                                    >
                                        <i className="fa-solid fa-eye" style={{ marginRight: 5 }}></i>Preview
                                    </button>
                                </div>
                                <div className="md-editor-tabs-right">
                                    <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-secundario)', opacity: 0.6 }}>
                                        Ctrl+B negrito · Ctrl+I itálico · Tab indenta
                                    </span>
                                </div>
                            </div>

                            {/* Toolbar de formatação (só no modo edição) */}
                            {editorMode === 'edit' && (
                                <div className="md-toolbar">
                                    {TOOLBAR_ACTIONS.map((action, i) =>
                                        action === null
                                            ? <span key={i} className="md-toolbar-sep" />
                                            : (
                                                <button
                                                    key={i}
                                                    className="md-toolbar-btn"
                                                    title={action.title}
                                                    style={action.style || {}}
                                                    onMouseDown={e => { e.preventDefault(); applyFormat(action); }}
                                                >
                                                    {action.label}
                                                </button>
                                            )
                                    )}
                                </div>
                            )}

                            {/* Textarea (edição) */}
                            {editorMode === 'edit' && (
                                <textarea
                                    ref={textareaRef}
                                    className="md-textarea"
                                    value={conteudo}
                                    placeholder={`# Título da seção\n\nDigite suas anotações em **Markdown**...\n\n- Item de lista\n- [ ] Tarefa a fazer\n\`\`\`\ncódigo aqui\n\`\`\``}
                                    onChange={e => { setConteudo(e.target.value); saveDraft(e.target.value); }}
                                    onKeyDown={handleKeyDown}
                                    spellCheck
                                />
                            )}

                            {/* Preview */}
                            {editorMode === 'preview' && (
                                <div className="md-preview-inner">
                                    {conteudo.trim()
                                        ? <MarkdownViewer content={conteudo} />
                                        : <p style={{ color: 'var(--cor-texto-secundario)', fontStyle: 'italic', opacity: 0.6 }}>Nada para visualizar ainda...</p>
                                    }
                                </div>
                            )}

                            {/* Status bar */}
                            <div className="md-status-bar">
                                <div className="md-status-bar-left">
                                    <span>{wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}</span>
                                    {wordCount > 0 && <span>~{readingTime} min de leitura</span>}
                                </div>
                                {draftSaved && (
                                    <div className="md-draft-indicator">
                                        <i className="fa-solid fa-floppy-disk"></i>
                                        <span>Rascunho salvo</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Links ─────────────────────────────── */}
                    <div className="links-manager-section">
                        <label className="section-label">
                            <i className="fa-solid fa-link"></i> Links e Referências
                        </label>
                        <div className="add-link-row">
                            <input
                                type="text"
                                className="form-input link-input"
                                placeholder="Cole uma URL aqui (ex: https://...)"
                                value={newLink}
                                onChange={e => setNewLink(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddLink(e)}
                            />
                            <button className="btn-secondary btn-add-link" onClick={handleAddLink}>
                                <i className="fa-solid fa-plus"></i> Adicionar
                            </button>
                        </div>
                        {links.length > 0 && (
                            <ul className="links-list-edit">
                                {links.map((link, idx) => (
                                    <li key={idx}>
                                        <span className="link-url-text">{link}</span>
                                        <button className="remove-link-btn" onClick={() => handleRemoveLink(idx)}>
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────── */}
                <div className="modal-footer-custom">
                    <label className="checkbox-footer">
                        <input
                            type="checkbox"
                            checked={fixado}
                            onChange={e => setFixado(e.target.checked)}
                        />
                        <span className="checkmark-footer"></span>
                        Fixar no topo
                    </label>
                    <div className="footer-buttons">
                        <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
                        <button className="btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Anotação'}
                        </button>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
}
