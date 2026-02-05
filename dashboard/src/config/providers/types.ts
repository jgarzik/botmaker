export interface ModelInfo {
  id: string;
  label?: string;
  description?: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  models: ModelInfo[];
  defaultModel: string;
  keyHint?: string; // Placeholder hint for API key format (e.g., "sk-ant-...")
}
