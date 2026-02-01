import { Modal } from '../ui/Modal';
import { AddKeyForm } from './AddKeyForm';
import type { AddKeyInput } from '../types';

interface AddKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: AddKeyInput) => Promise<void>;
  loading: boolean;
}

export function AddKeyModal({ isOpen, onClose, onSubmit, loading }: AddKeyModalProps) {
  const handleSubmit = async (input: AddKeyInput) => {
    await onSubmit(input);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add API Key"
      size="sm"
    >
      <AddKeyForm onSubmit={handleSubmit} onCancel={onClose} loading={loading} />
    </Modal>
  );
}
