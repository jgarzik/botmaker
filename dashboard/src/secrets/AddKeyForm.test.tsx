import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddKeyForm } from './AddKeyForm';

describe('AddKeyForm', () => {
  const defaultProps = {
    onSubmit: () => Promise.resolve(),
    onCancel: () => { /* noop */ },
    loading: false,
  };

  it('should render form fields', () => {
    render(<AddKeyForm {...defaultProps} />);

    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key *')).toBeInTheDocument();
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Key' })).toBeInTheDocument();
  });

  it('should have vendor options', () => {
    render(<AddKeyForm {...defaultProps} />);

    const select = screen.getByLabelText('Provider');
    expect(select).toContainHTML('OpenAI');
    expect(select).toContainHTML('Anthropic');
    expect(select).toContainHTML('Venice');
    expect(select).toContainHTML('Google');
  });

  it('should default vendor to openai', () => {
    render(<AddKeyForm {...defaultProps} />);

    const select = screen.getByLabelText<HTMLSelectElement>('Provider');
    expect(select.value).toBe('openai');
  });

  it('should submit with correct values', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'anthropic' } });
    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: 'sk-ant-123' } });
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Test Key' } });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'prod' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Key' }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        vendor: 'anthropic',
        secret: 'sk-ant-123',
        label: 'Test Key',
        tag: 'prod',
      });
    });
  });

  it('should show error when API key is empty', () => {
    const handleSubmit = vi.fn();
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    // Button is disabled when secret is empty, so form shouldn't submit
    expect(screen.getByRole('button', { name: 'Add Key' })).toBeDisabled();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should show error when API key is whitespace', () => {
    const handleSubmit = vi.fn();
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: '   ' } });
    // Button is disabled when secret is only whitespace (after trim check)
    expect(screen.getByRole('button', { name: 'Add Key' })).toBeDisabled();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should disable form when loading', () => {
    render(<AddKeyForm {...defaultProps} loading={true} />);

    expect(screen.getByLabelText('Provider')).toBeDisabled();
    expect(screen.getByLabelText('API Key *')).toBeDisabled();
    expect(screen.getByLabelText('Label')).toBeDisabled();
    expect(screen.getByLabelText('Tag')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
  });

  it('should disable submit button when secret is empty', () => {
    render(<AddKeyForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Add Key' })).toBeDisabled();
  });

  it('should enable submit button when secret is filled', () => {
    render(<AddKeyForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: 'sk-123' } });

    expect(screen.getByRole('button', { name: 'Add Key' })).not.toBeDisabled();
  });

  it('should clear form after successful submit', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: 'sk-123' } });
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'My Key' } });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'prod' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Key' }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalled();
    });

    const secretInput = screen.getByLabelText<HTMLInputElement>('API Key *');
    const labelInput = screen.getByLabelText<HTMLInputElement>('Label');
    const tagInput = screen.getByLabelText<HTMLInputElement>('Tag');

    expect(secretInput.value).toBe('');
    expect(labelInput.value).toBe('');
    expect(tagInput.value).toBe('');
  });

  it('should show error from submit failure', async () => {
    const handleSubmit = vi.fn().mockRejectedValue(new Error('Failed to add key'));
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: 'sk-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Key' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to add key')).toBeInTheDocument();
    });
  });

  it('should trim whitespace from values', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: '  sk-123  ' } });
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '  My Key  ' } });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: '  prod  ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Key' }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        vendor: 'openai',
        secret: 'sk-123',
        label: 'My Key',
        tag: 'prod',
      });
    });
  });

  it('should not include empty optional fields', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AddKeyForm {...defaultProps} onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText('API Key *'), { target: { value: 'sk-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Key' }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        vendor: 'openai',
        secret: 'sk-123',
        label: undefined,
        tag: undefined,
      });
    });
  });

  it('should call onCancel when Cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(<AddKeyForm {...defaultProps} onCancel={handleCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(handleCancel).toHaveBeenCalled();
  });
});
