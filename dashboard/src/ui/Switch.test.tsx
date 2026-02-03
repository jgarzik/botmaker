import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch', () => {
  it('should render as checkbox', () => {
    render(<Switch checked={false} onChange={() => { /* noop */ }} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should reflect checked state', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => { /* noop */ }} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(<Switch checked={true} onChange={() => { /* noop */ }} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('should call onChange with new value when clicked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('should call onChange with false when checked switch is clicked', () => {
    const handleChange = vi.fn();
    render(<Switch checked={true} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('should render label when provided', () => {
    render(<Switch checked={false} onChange={() => { /* noop */ }} label="Enable feature" />);
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
  });

  it('should apply sm size class', () => {
    render(<Switch checked={false} onChange={() => { /* noop */ }} size="sm" />);
    const label = screen.getByRole('checkbox').closest('label');
    expect(label).toHaveClass('switch--sm');
  });

  it('should apply md size class by default', () => {
    render(<Switch checked={false} onChange={() => { /* noop */ }} />);
    const label = screen.getByRole('checkbox').closest('label');
    expect(label).toHaveClass('switch--md');
  });

  it('should be disabled when disabled prop is true', () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} disabled />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    const label = checkbox.closest('label');
    expect(label).toHaveClass('switch--disabled');
  });

  it('should use provided id', () => {
    render(<Switch checked={false} onChange={() => { /* noop */ }} id="custom-switch" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'custom-switch');
  });

  it('should generate unique id when not provided', () => {
    render(
      <>
        <Switch checked={false} onChange={() => { /* noop */ }} />
        <Switch checked={false} onChange={() => { /* noop */ }} />
      </>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].id).not.toBe(checkboxes[1].id);
    expect(checkboxes[0].id).toMatch(/^switch-/);
    expect(checkboxes[1].id).toMatch(/^switch-/);
  });

  it('should pass through additional props', () => {
    render(<Switch checked={false} onChange={() => { /* noop */ }} aria-label="Toggle switch" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label', 'Toggle switch');
  });
});
