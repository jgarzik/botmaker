import type { PersonaTemplate } from '../data/templates';
import './TemplateCard.css';

interface TemplateCardProps {
  template: PersonaTemplate;
  selected: boolean;
  onSelect: () => void;
}

export function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  const isSpecial = template.id === 'scratch';

  return (
    <button
      type="button"
      className={`template-card ${selected ? 'template-card--selected' : ''} ${isSpecial ? 'template-card--special' : ''}`}
      onClick={onSelect}
    >
      <div className="template-card-avatar">
        {template.emoji}
      </div>
      <div className="template-card-content">
        <div className="template-card-name">{template.name}</div>
        <div className="template-card-tagline">{template.tagline}</div>
        {template.soulPreview && (
          <div className="template-card-preview">{template.soulPreview}</div>
        )}
      </div>
      {selected && (
        <div className="template-card-check">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        </div>
      )}
    </button>
  );
}
