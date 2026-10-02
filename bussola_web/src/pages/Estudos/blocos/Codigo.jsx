import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark-dimmed.css';
import { useToast } from '../../../context/ToastContext';
import { copiarTexto } from '../comandos';

const LINGUAGEM_OK = /^[A-Za-z0-9+#._-]{1,30}$/;

// Cerca de crases maior que qualquer sequência de crases do próprio código (o conteúdo nunca
// "fecha" o bloco). O realce sai como árvore React (react-markdown + rehype-highlight), sem innerHTML.
function cercaPara(codigo) {
    const maior = Math.max(0, ...(codigo.match(/`+/g) || []).map((s) => s.length));
    return '`'.repeat(Math.max(3, maior + 1));
}

export function Codigo({ bloco }) {
    const { addToast } = useToast();
    const linguagem = LINGUAGEM_OK.test(bloco.linguagem || '') ? bloco.linguagem.toLowerCase() : '';
    const cerca = cercaPara(bloco.codigo);
    const fonte = `${cerca}${linguagem}\n${bloco.codigo.replace(/\n$/, '')}\n${cerca}`;

    const copiar = async () => {
        const ok = await copiarTexto(bloco.codigo);
        addToast(ok
            ? { type: 'success', title: 'Código copiado' }
            : { type: 'error', title: 'Não foi possível copiar' });
    };

    return (
        <figure className="bloco-codigo">
            <div className="bloco-codigo-topo">
                <span>{bloco.linguagem}</span>
                <button type="button" className="bloco-codigo-copiar" onClick={copiar}>
                    <i className="fa-regular fa-copy"></i> Copiar
                </button>
            </div>
            <div className="bloco-codigo-corpo">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{fonte}</ReactMarkdown>
            </div>
            {bloco.legenda && <figcaption>{bloco.legenda}</figcaption>}
        </figure>
    );
}
