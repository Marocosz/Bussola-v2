import { Component, memo } from 'react';
import { Alerta } from './Alerta';
import { Analogia } from './Analogia';
import { Codigo } from './Codigo';
import { Comparacao } from './Comparacao';
import { Conceito } from './Conceito';
import { Decisao } from './Decisao';
import { Definicao } from './Definicao';
import { Diagrama } from './Diagrama';
import { Formula } from './Formula';
import { Lista } from './Lista';
import { Passos } from './Passos';
import { QuestaoAberta } from './QuestaoAberta';
import { Quiz } from './Quiz';
import { Secao } from './Secao';
import { Texto } from './Texto';

const COMPONENTES = {
    secao: Secao,
    texto: Texto,
    conceito: Conceito,
    definicao: Definicao,
    analogia: Analogia,
    passos: Passos,
    codigo: Codigo,
    comparacao: Comparacao,
    decisao: Decisao,
    lista: Lista,
    alerta: Alerta,
    formula: Formula,
    diagrama: Diagrama,
    quiz: Quiz,
    questao_aberta: QuestaoAberta,
};

// Um bloco que quebre ao renderizar não derruba o material inteiro.
class LimiteDoBloco extends Component {
    constructor(props) {
        super(props);
        this.state = { falhou: false };
    }

    static getDerivedStateFromError() {
        return { falhou: true };
    }

    render() {
        if (this.state.falhou) {
            return (
                <div className="bloco-desconhecido">
                    <i className="fa-solid fa-triangle-exclamation"></i> Não foi possível exibir este bloco.
                </div>
            );
        }
        return this.props.children;
    }
}

export const BlocoRenderer = memo(function BlocoRenderer({ bloco, onResponder }) {
    const Componente = COMPONENTES[bloco?.tipo];
    if (!Componente) {
        return (
            <div className="bloco-desconhecido">
                <i className="fa-solid fa-puzzle-piece"></i> Este bloco (tipo “{String(bloco?.tipo)}”) ainda não é exibido
                por esta versão do site.
            </div>
        );
    }
    return (
        <LimiteDoBloco>
            <Componente bloco={bloco} onResponder={onResponder} />
        </LimiteDoBloco>
    );
});
