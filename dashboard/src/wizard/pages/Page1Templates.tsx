import { useState, useMemo } from 'react';
import { useWizard } from '../context/WizardContext';
import { TEMPLATES, SCRATCH_TEMPLATE } from '../data/templates';
import { TemplateCard } from '../components';
import './Page1Templates.css';

export function Page1Templates() {
  const { state, dispatch } = useWizard();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return TEMPLATES;
    const query = searchQuery.toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.tagline.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (templateId: string) => {
    dispatch({ type: 'SELECT_TEMPLATE', templateId });
  };

  return (
    <div className="page1-templates">
      <div className="page1-header">
        <h3 className="page1-title">Choose a Persona Template</h3>
        <p className="page1-subtitle">
          Start with a pre-built personality or create your own from scratch
        </p>
      </div>

      <div className="page1-search">
        <svg className="page1-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z" />
        </svg>
        <input
          type="text"
          className="wizard-input page1-search-input"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); }}
        />
      </div>

      <div className="page1-grid">
        <TemplateCard
          template={SCRATCH_TEMPLATE}
          selected={state.selectedTemplateId === 'scratch'}
          onSelect={() => { handleSelect('scratch'); }}
        />
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={state.selectedTemplateId === template.id}
            onSelect={() => { handleSelect(template.id); }}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && searchQuery && (
        <div className="page1-empty">
          No templates match "{searchQuery}"
        </div>
      )}
    </div>
  );
}
