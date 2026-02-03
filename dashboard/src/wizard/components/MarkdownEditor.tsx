import './MarkdownEditor.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  return (
    <div className="markdown-editor">
      <div className="markdown-editor-header">
        <span className="markdown-editor-label">SOUL.md</span>
        <span className="markdown-editor-hint">Markdown supported</span>
      </div>
      <textarea
        className="markdown-editor-textarea"
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        placeholder={placeholder ?? '# Soul\n\nDescribe your bot\'s personality, guidelines, and behavior...'}
        spellCheck={false}
      />
    </div>
  );
}
