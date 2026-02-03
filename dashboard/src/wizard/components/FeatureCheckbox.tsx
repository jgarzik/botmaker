import './FeatureCheckbox.css';

interface FeatureCheckboxProps {
  id: string;
  label: string;
  icon?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

export function FeatureCheckbox({ id, label, icon, checked, onChange, hint }: FeatureCheckboxProps) {
  return (
    <label className={`feature-checkbox ${checked ? 'feature-checkbox--checked' : ''}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        className="feature-checkbox-input"
        checked={checked}
        onChange={(e) => { onChange(e.target.checked); }}
      />
      <span className="feature-checkbox-box">
        {checked && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        )}
      </span>
      <div className="feature-checkbox-content">
        <span className="feature-checkbox-label">
          {icon && <span className="feature-checkbox-icon">{icon}</span>}
          {label}
        </span>
        {hint && <span className="feature-checkbox-hint">{hint}</span>}
      </div>
    </label>
  );
}
