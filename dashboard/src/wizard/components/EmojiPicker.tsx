import { useState } from 'react';
import './EmojiPicker.css';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const COMMON_EMOJIS = [
  '🤖', '🧠', '💬', '🎯', '⚡', '🔥', '💡', '🌟',
  '🎮', '📚', '✍️', '🔬', '🎨', '🎧', '💻', '🛠️',
  '🌍', '🚀', '🎭', '🦾', '👾', '🤝', '📊', '🔮',
  '🦊', '🐱', '🐶', '🦁', '🐼', '🦄', '🐉', '🦅',
];

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [showGrid, setShowGrid] = useState(false);
  const [textInput, setTextInput] = useState(value);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTextInput(newValue);
    if (newValue.length > 0) {
      onChange(newValue.slice(0, 2));
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setTextInput(emoji);
    onChange(emoji);
    setShowGrid(false);
  };

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-input-row">
        <input
          type="text"
          className="wizard-input emoji-picker-input"
          value={textInput}
          onChange={handleTextChange}
          placeholder="🤖"
          maxLength={2}
        />
        <button
          type="button"
          className="emoji-picker-toggle"
          onClick={() => { setShowGrid(!showGrid); }}
        >
          {showGrid ? 'Hide' : 'Pick'}
        </button>
      </div>
      {showGrid && (
        <div className="emoji-picker-grid">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`emoji-picker-option ${value === emoji ? 'emoji-picker-option--selected' : ''}`}
              onClick={() => { handleEmojiSelect(emoji); }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
