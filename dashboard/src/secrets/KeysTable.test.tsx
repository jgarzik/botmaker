import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeysTable } from './KeysTable';
import type { ProxyKey } from '../types';

const mockKeys: ProxyKey[] = [
  { id: 'key1', vendor: 'openai', label: 'Production Key', tag: 'prod', created_at: 1700000000 },
  { id: 'key2', vendor: 'anthropic', label: 'Test Key', tag: null, created_at: 1700100000 },
  { id: 'key3', vendor: 'venice', label: null, tag: 'dev', created_at: 1699900000 },
  { id: 'key4', vendor: 'google', label: 'Google Key', tag: 'prod', created_at: 1700200000 },
];

describe('KeysTable', () => {
  it('should render empty state when no keys', () => {
    render(<KeysTable keys={[]} onDelete={() => { /* noop */ }} />);

    expect(screen.getByText('No API keys configured')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    render(<KeysTable keys={mockKeys} onDelete={() => { /* noop */ }} />);

    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Tag')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('should render all keys', () => {
    render(<KeysTable keys={mockKeys} onDelete={() => { /* noop */ }} />);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Venice')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('should display labels or dash for missing', () => {
    render(<KeysTable keys={mockKeys} onDelete={() => { /* noop */ }} />);

    expect(screen.getByText('Production Key')).toBeInTheDocument();
    expect(screen.getByText('Test Key')).toBeInTheDocument();
    expect(screen.getByText('Google Key')).toBeInTheDocument();
    // Venice key has null label, should show dash
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should display tags or default for missing', () => {
    render(<KeysTable keys={mockKeys} onDelete={() => { /* noop */ }} />);

    // Should have 'prod' appearing twice and 'dev' once
    const prodTags = screen.getAllByText('prod');
    expect(prodTags).toHaveLength(2);
    expect(screen.getByText('dev')).toBeInTheDocument();
    // Anthropic key has null tag, should show 'default'
    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('should sort keys by created_at descending (newest first)', () => {
    render(<KeysTable keys={mockKeys} onDelete={() => { /* noop */ }} />);

    const rows = screen.getAllByRole('row');
    // First row is header, so data rows start at index 1
    const vendorCells = rows.slice(1).map(row => row.querySelector('td')?.textContent);

    // Sorted by created_at desc: Google (1700200000), Anthropic (1700100000), OpenAI (1700000000), Venice (1699900000)
    expect(vendorCells[0]).toBe('Google');
    expect(vendorCells[1]).toBe('Anthropic');
    expect(vendorCells[2]).toBe('OpenAI');
    expect(vendorCells[3]).toBe('Venice');
  });

  it('should call onDelete with key when delete button clicked', () => {
    const handleDelete = vi.fn();
    render(<KeysTable keys={mockKeys} onDelete={handleDelete} />);

    // Get all delete buttons
    const deleteButtons = screen.getAllByTitle('Delete key');

    // Click the first delete button (Google key is first due to sorting)
    fireEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'key4', vendor: 'google' })
    );
  });

  it('should render vendor names with correct display text', () => {
    const keys: ProxyKey[] = [
      { id: 'k1', vendor: 'openai', label: 'A', tag: null, created_at: 1 },
    ];
    render(<KeysTable keys={keys} onDelete={() => { /* noop */ }} />);

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('should handle unknown vendor gracefully', () => {
    const keys: ProxyKey[] = [
      { id: 'k1', vendor: 'unknown-vendor', label: 'A', tag: null, created_at: 1 },
    ];
    render(<KeysTable keys={keys} onDelete={() => { /* noop */ }} />);

    // Should just display the vendor string as-is
    expect(screen.getByText('unknown-vendor')).toBeInTheDocument();
  });
});
