import { InputHTMLAttributes } from 'react';
import './Switch.css';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onChange,
  label,
  size = 'md',
  disabled,
  id,
  ...props
}: SwitchProps) {
  const switchId = id ?? `switch-${Math.random().toString(36).substring(2, 11)}`;

  return (
    <label
      className={`switch switch--${size} ${disabled ? 'switch--disabled' : ''}`}
      htmlFor={switchId}
    >
      <input
        type="checkbox"
        id={switchId}
        className="switch-input"
        checked={checked}
        onChange={(e) => { onChange(e.target.checked); }}
        disabled={disabled}
        {...props}
      />
      <span className="switch-track">
        <span className="switch-thumb" />
        <span className="switch-indicator switch-indicator--on">I</span>
        <span className="switch-indicator switch-indicator--off">O</span>
      </span>
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}
