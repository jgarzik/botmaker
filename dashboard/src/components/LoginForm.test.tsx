import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from './LoginForm';

describe('LoginForm', () => {
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    mockOnLogin.mockReset();
  });

  it('should render password input and submit button', () => {
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={false} />);

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should render title and subtitle', () => {
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={false} />);

    expect(screen.getByText('BotMaker')).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
  });

  it('should call onLogin with password on form submit', () => {
    mockOnLogin.mockResolvedValueOnce(undefined);
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={false} />);

    const input = screen.getByLabelText(/password/i);
    const button = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(input, { target: { value: 'test-password' } });
    fireEvent.click(button);

    expect(mockOnLogin).toHaveBeenCalledWith('test-password');
  });

  it('should not call onLogin with empty password', () => {
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={false} />);

    const button = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(button);

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it('should display error message when error prop is set', () => {
    render(<LoginForm onLogin={mockOnLogin} error="Invalid password" isLoading={false} />);

    expect(screen.getByText('Invalid password')).toBeInTheDocument();
  });

  it('should disable input and button when loading', () => {
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={true} />);

    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show loading state in button', () => {
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={true} />);

    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });

  it('should submit form on Enter key', () => {
    mockOnLogin.mockResolvedValueOnce(undefined);
    render(<LoginForm onLogin={mockOnLogin} error={null} isLoading={false} />);

    const input = screen.getByLabelText(/password/i);
    const form = input.closest('form');
    if (!form) throw new Error('Form not found');

    fireEvent.change(input, { target: { value: 'test-password' } });
    fireEvent.submit(form);

    expect(mockOnLogin).toHaveBeenCalledWith('test-password');
  });
});
