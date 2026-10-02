import { MetaForm } from './components/MetaForm';
import { CofreScene } from './CofreScene';
import { MetaHistorico } from './components/MetaHistorico';
import { fmtBRL } from './useMetasController';

const EXPLICACAO = 'Guardar em metas é uma transferência: sai do Disponível e vai pro Guardado, mas o Total (patrimônio) não muda e não conta como gasto. O patrimônio só diminui quando você realmente gastar o objetivo.';

/** Cabeçalho do modal/sheet de Metas: voltar (fora da grade), título e fechar. */
export function MetasHeader({ ctl, onClose }) {
  return (
    <div className="modal-header metas-modal-header">
      {ctl.view !== 'grid' && (
        <button type="button" className="metas-back-btn" onClick={ctl.goBack} title="Voltar" aria-label="Voltar">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
      )}
      <h3>
        {ctl.view === 'grid' && <i className="fa-solid fa-piggy-bank" style={{ marginRight: 8, color: 'var(--cor-azul-primario)' }}></i>}
        {ctl.title}
      </h3>
      <span className="close-btn" role="button" tabIndex={0} aria-label="Fechar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}>&times;</span>
    </div>
  );
}

/** Disponível / Guardado / Total. No celular a explicação fica visível (sem tooltip). */
export function MetasResumo({ resumo, explainVisible = false }) {
  return (
    <>
      <div className="metas-kpis">
        <span className="ph-kpi positivo" title="Dinheiro livre pra gastar (Total − Guardado). Guardar numa meta reduz o disponível, mas não é gasto.">
          <i className="fa-solid fa-wallet"></i> Disponível {fmtBRL(resumo.disponivel)}
        </span>
        <span className="ph-kpi guardado" title="Reservado nas suas metas/cofrinhos. Continua sendo seu — só saiu do disponível.">
          <i className="fa-solid fa-piggy-bank"></i> Guardado {fmtBRL(resumo.guardado)}
        </span>
        <span className="ph-kpi" title="Seu patrimônio (receitas − despesas). Guardar NÃO muda o total; só move do disponível pro guardado.">
          <i className="fa-solid fa-scale-balanced"></i> Total {fmtBRL(resumo.total)}
        </span>
        {!explainVisible && (
          <span className="metas-kpis-info" title={EXPLICACAO}>
            <i className="fa-solid fa-circle-info"></i>
          </span>
        )}
      </div>
      {explainVisible && (
        <p className="metas-explain">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>{EXPLICACAO}</span>
        </p>
      )}
    </>
  );
}

/** Views fora da grade: formulário, cena do cofre e histórico. */
export function MetasDetailView({ ctl }) {
  return (
    <>
      {ctl.view === 'form' && (
        <MetaForm
          editingData={ctl.editingData}
          iconesDisponiveis={ctl.data?.icones_disponiveis || []}
          coresDisponiveis={ctl.data?.cores_disponiveis || []}
          onSaved={ctl.handleSaved}
          onCancel={ctl.openGrid}
        />
      )}

      {ctl.view === 'cofre' && ctl.selectedMeta && (
        <CofreScene
          meta={ctl.selectedMeta}
          onUpdate={ctl.fetchData}
          onOpenHistorico={ctl.openHistorico}
        />
      )}

      {ctl.view === 'historico' && ctl.selectedMeta && (
        <div className="modal-body metas-historico-body">
          <MetaHistorico meta={ctl.selectedMeta} onChange={ctl.fetchData} />
        </div>
      )}
    </>
  );
}
