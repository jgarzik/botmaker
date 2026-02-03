import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('should not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => { /* noop */ }}>
        Content
      </Modal>
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => { /* noop */ }}>
        Modal Content
      </Modal>
    );

    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(
      <Modal isOpen={true} onClose={() => { /* noop */ }} title="Modal Title">
        Content
      </Modal>
    );

    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    render(
      <Modal isOpen={true} onClose={() => { /* noop */ }} footer={<button>Save</button>}>
        Content
      </Modal>
    );

    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Title">
        Content
      </Modal>
    );

    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );

    // Click on the backdrop (the outer element with modal-backdrop class)
    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when modal content is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div data-testid="content">Content</div>
      </Modal>
    );

    fireEvent.click(screen.getByTestId('content'));

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should lock body scroll when open', () => {
    render(
      <Modal isOpen={true} onClose={() => { /* noop */ }}>
        Content
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should unlock body scroll when closed', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => { /* noop */ }}>
        Content
      </Modal>
    );

    rerender(
      <Modal isOpen={false} onClose={() => { /* noop */ }}>
        Content
      </Modal>
    );

    expect(document.body.style.overflow).toBe('');
  });

  it('should apply size classes', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => { /* noop */ }} size="sm">
        Content
      </Modal>
    );

    expect(screen.getByRole('dialog')).toHaveClass('modal--sm');

    rerender(
      <Modal isOpen={true} onClose={() => { /* noop */ }} size="md">
        Content
      </Modal>
    );

    expect(screen.getByRole('dialog')).toHaveClass('modal--md');

    rerender(
      <Modal isOpen={true} onClose={() => { /* noop */ }} size="lg">
        Content
      </Modal>
    );

    expect(screen.getByRole('dialog')).toHaveClass('modal--lg');
  });

  it('should have proper accessibility attributes', () => {
    render(
      <Modal isOpen={true} onClose={() => { /* noop */ }} title="Accessible Modal">
        Content
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });
});
