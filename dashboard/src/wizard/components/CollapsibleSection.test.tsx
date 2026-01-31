import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders title and content when open by default', () => {
    render(
      <CollapsibleSection title="Test Section">
        <div>Section content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('hides content when defaultOpen is false', () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen={false}>
        <div>Section content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.queryByText('Section content')).not.toBeInTheDocument();
  });

  it('toggles content visibility on click', () => {
    render(
      <CollapsibleSection title="Test Section">
        <div>Section content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Section content')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Test Section'));
    expect(screen.queryByText('Section content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Test Section'));
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('applies open class when expanded', () => {
    const { container } = render(
      <CollapsibleSection title="Test Section">
        <div>Content</div>
      </CollapsibleSection>
    );

    expect(container.querySelector('.collapsible-section--open')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Test Section'));
    expect(container.querySelector('.collapsible-section--open')).not.toBeInTheDocument();
  });
});
