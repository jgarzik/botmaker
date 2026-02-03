import { useState } from 'react';
import { Modal } from '../ui/Modal';
import type { ProxyKey } from '../types';
import { getProvider } from '../config/providers';

interface DeleteKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  keyToDelete: ProxyKey | null;
}

export function DeleteKeyModal({ isOpen, onClose, onConfirm, keyToDelete }: DeleteKeyModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!keyToDelete) return null;

  const vendorName = getProvider(keyToDelete.vendor)?.label ?? keyToDelete.vendor;
  const keyLabel = keyToDelete.label ?? 'Unnamed Key';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete API Key"
      size="sm"
      footer={
        <>
          <button
            className="btn btn--md btn--ghost"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="btn btn--md btn--danger"
            onClick={() => { void handleConfirm(); }}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.6 }}>
        Are you sure you want to delete the <strong>{vendorName}</strong> key "{keyLabel}"?
        This action cannot be undone.
      </p>
    </Modal>
  );
}
