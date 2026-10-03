import React from 'react';
import { BaseModal } from '../../../components/BaseModal';

export function ViewNotesModal({ notas, titulo, onClose }) {
    if (!notas) return null;

    return (
        <BaseModal onClose={onClose} className="modal">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Notas: {titulo}</h3>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar">&times;</button>
                </div>
                <div className="modal-body">
                    <div className="notes-full-view">
                        {notas}
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>
                </div>
            </div>
        </BaseModal>
    );
}