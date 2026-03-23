import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark-dimmed.css';
import '../styles/markdown.css';

// Detecta se o conteúdo é HTML legado
const isHtmlContent = (str) => str && /<[a-z][\s\S]*>/i.test(str);

export function MarkdownViewer({ content = '' }) {
    // Conteúdo legado (HTML) — renderiza diretamente com aviso discreto
    if (isHtmlContent(content)) {
        return (
            <div className="md-viewer">
                <div
                    className="md-legacy-html"
                    dangerouslySetInnerHTML={{ __html: content }}
                />
                <span className="md-legacy-badge" title="Esta nota usa o formato antigo. Edite-a para converter para Markdown.">
                    <i className="fa-solid fa-triangle-exclamation"></i> Formato legado
                </span>
            </div>
        );
    }

    return (
        <div className="md-viewer">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Checkboxes interativos (visuais)
                    input: ({ node, ...props }) => (
                        <input {...props} readOnly className="md-task-checkbox" />
                    ),
                    // Links sempre abrem em nova aba
                    a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                    // Tabelas com wrapper para scroll horizontal
                    table: ({ node, ...props }) => (
                        <div className="md-table-wrapper">
                            <table {...props} />
                        </div>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
