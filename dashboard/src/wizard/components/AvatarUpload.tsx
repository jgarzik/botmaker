import { useRef } from 'react';
import './AvatarUpload.css';

interface AvatarUploadProps {
  previewUrl: string;
  emoji: string;
  onUpload: (file: File, previewUrl: string) => void;
  onClear: () => void;
}

export function AvatarUpload({ previewUrl, emoji, onUpload, onClear }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const url = URL.createObjectURL(file);
    onUpload(file, url);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear();
  };

  return (
    <div className="avatar-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="avatar-upload-input"
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="avatar-upload-preview"
        onClick={handleClick}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Avatar preview" className="avatar-upload-image" />
        ) : (
          <span className="avatar-upload-emoji">{emoji}</span>
        )}
        <div className="avatar-upload-overlay">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 5h3l1-1h4l1 1h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm6 9a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <span>Upload</span>
        </div>
      </button>
      {previewUrl && (
        <button
          type="button"
          className="avatar-upload-clear"
          onClick={handleClear}
        >
          Remove
        </button>
      )}
      <span className="avatar-upload-hint">PNG, JPG up to 1MB</span>
    </div>
  );
}
