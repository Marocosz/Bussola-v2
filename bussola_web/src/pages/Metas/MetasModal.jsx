import { BaseModal } from '../../components/BaseModal';
import { MetaCard } from './components/MetaCard';
import { useMetasController } from './useMetasController';
import { MetasHeader, MetasResumo, MetasDetailView } from './MetasParts';
import './styles.css';

/**
 * Modal grande de Metas & Cofrinhos, aberto a partir da página de Provisões (desktop/tablet).
 * Navega por "views" internas (grade / cofre / form / histórico) — sem modais aninhados.
 * No celular a mesma lógica vive na aba Metas (MetasTab).
 */
export function MetasModal({ onClose, onUpdate }) {
  const ctl = useMetasController({ onUpdate });

  return (
    <BaseModal onClose={onClose} className="modal metas-modal-overlay">
      <div className="modal-content metas-modal metas-scope" onClick={(e) => e.stopPropagation()}>
        <MetasHeader ctl={ctl} onClose={onClose} />

        {ctl.view === 'grid' && (
          <div className="modal-body metas-grid-body">
            <MetasResumo resumo={ctl.resumo} />

            <div className="metas-toolbar">
              <button className="btn-primary" onClick={ctl.openNew}><i className="fa-solid fa-plus"></i> Nova meta</button>
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
          </div>
        )}

        <MetasDetailView ctl={ctl} />
      </div>
    </BaseModal>
  );
}
