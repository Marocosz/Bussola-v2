import { BaseModal } from '../../components/BaseModal';
import { Fab } from '../../components/mobile/Fab';
import { MetaCard } from './components/MetaCard';
import { useMetasController } from './useMetasController';
import { MetasHeader, MetasResumo, MetasDetailView } from './MetasParts';
import './styles.css';

/**
 * Aba Metas de Provisões no celular: resumo com explicação visível e os MetaCard atuais
 * em 1 coluna. Form, cofre (Guardar/Retirar) e histórico abrem num sheet de tela cheia
 * com as mesmas views do MetasModal.
 */
export function MetasTab({ onUpdate }) {
  const ctl = useMetasController({ onUpdate });

  return (
    <div className="metas-scope m-metas">
      <div className="m-metas-resumo">
        <MetasResumo resumo={ctl.resumo} explainVisible />
      </div>

      {ctl.loading ? (
        <p className="empty-list-msg">Carregando metas…</p>
      ) : ctl.metas.length ? (
        <div className="metas-grid">
          {ctl.metas.map((m) => (
            <MetaCard key={m.id} meta={m} onOpen={ctl.openCofre} onEdit={ctl.openEdit} onDelete={ctl.handleDelete} />
          ))}
        </div>
      ) : (
        <div className="metas-empty">
          <i className="fa-solid fa-piggy-bank"></i>
          <p>Nenhum cofrinho ainda.</p>
          <button className="btn-primary" onClick={ctl.openNew}><i className="fa-solid fa-plus"></i> Criar primeira meta</button>
        </div>
      )}

      {ctl.view === 'grid' && <Fab label="Nova meta" onClick={ctl.openNew} />}

      {ctl.view !== 'grid' && (
        <BaseModal onClose={ctl.openGrid} className="modal metas-modal-overlay" sheet="full">
          <div className="modal-content metas-modal metas-scope" onClick={(e) => e.stopPropagation()}>
            <MetasHeader ctl={ctl} onClose={ctl.openGrid} />
            <MetasDetailView ctl={ctl} />
          </div>
        </BaseModal>
      )}
    </div>
  );
}
