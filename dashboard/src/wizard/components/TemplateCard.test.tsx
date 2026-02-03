import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateCard } from './TemplateCard';
import type { PersonaTemplate } from '../data/templates';

const mockTemplate: PersonaTemplate = {
  id: 'test-template',
  name: 'Test Template',
  emoji: '🧪',
  tagline: 'A test template for testing',
  soulPreview: 'I am a test bot...',
  soulMarkdown: '# Soul\nI am a test bot',
};

describe('TemplateCard', () => {
  it('renders template information', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        selected={false}
        onSelect={() => { /* noop */ }}
      />
    );

    expect(screen.getByText('Test Template')).toBeInTheDocument();
    expect(screen.getByText('A test template for testing')).toBeInTheDocument();
    expect(screen.getByText('🧪')).toBeInTheDocument();
  });

  it('shows preview text', () => {
    render(
      <TemplateCard
        template={mockTemplate}
        selected={false}
        onSelect={() => { /* noop */ }}
      />
    );

    expect(screen.getByText('I am a test bot...')).toBeInTheDocument();
  });

  it('applies selected class when selected', () => {
    const { container } = render(
      <TemplateCard
        template={mockTemplate}
        selected={true}
        onSelect={() => { /* noop */ }}
      />
    );

    expect(container.querySelector('.template-card--selected')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const handleSelect = vi.fn();

    render(
      <TemplateCard
        template={mockTemplate}
        selected={false}
        onSelect={handleSelect}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it('applies special class for scratch template', () => {
    const scratchTemplate: PersonaTemplate = {
      id: 'scratch',
      name: 'Start from Scratch',
      emoji: '✨',
      tagline: 'Build your own',
      soulPreview: '',
      soulMarkdown: '',
    };

    const { container } = render(
      <TemplateCard
        template={scratchTemplate}
        selected={false}
        onSelect={() => { /* noop */ }}
      />
    );

    expect(container.querySelector('.template-card--special')).toBeInTheDocument();
  });
});
