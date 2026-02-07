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
  dynamicModels?: boolean;    // Models should be fetched at runtime (e.g., Ollama)
  baseUrlEditable?: boolean;  // Show editable base URL field in wizard
}
