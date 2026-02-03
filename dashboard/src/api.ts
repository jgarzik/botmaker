import type { Bot, CreateBotInput, ContainerStats, OrphanReport, CleanupReport, ProxyKey, AddKeyInput, ProxyHealthResponse } from './types';

const API_BASE = '/api';

let adminToken: string | null = null;

export function setAdminToken(token: string): void {
  adminToken = token;
  localStorage.setItem('admin_token', token);
}

export function getAdminToken(): string | null {
  adminToken ??= localStorage.getItem('admin_token');
  return adminToken;
}

export function clearAdminToken(): void {
  adminToken = null;
  localStorage.removeItem('admin_token');
}

function getAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  if (!token) {
    throw new Error('Not authenticated. Please provide an admin token.');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    clearAdminToken();
    throw new Error('Authentication failed. Please re-enter your admin token.');
  }
  if (!response.ok) {
    const data: { error?: string } = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `HTTP error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchBots(): Promise<Bot[]> {
  const response = await fetch(`${API_BASE}/bots`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ bots: Bot[] }>(response);
  return data.bots;
}

export async function fetchBot(hostname: string): Promise<Bot> {
  const response = await fetch(`${API_BASE}/bots/${hostname}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Bot>(response);
}

export async function createBot(input: CreateBotInput): Promise<Bot> {
  const response = await fetch(`${API_BASE}/bots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(Object.entries(getAuthHeaders())) },
    body: JSON.stringify(input),
  });
  return handleResponse<Bot>(response);
}

export async function deleteBot(hostname: string): Promise<void> {
  const response = await fetch(`${API_BASE}/bots/${hostname}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  await handleResponse<{ success: boolean }>(response);
}

export async function startBot(hostname: string): Promise<void> {
  const response = await fetch(`${API_BASE}/bots/${hostname}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  await handleResponse<{ success: boolean }>(response);
}

export async function stopBot(hostname: string): Promise<void> {
  const response = await fetch(`${API_BASE}/bots/${hostname}/stop`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  await handleResponse<{ success: boolean }>(response);
}

export async function fetchContainerStats(): Promise<ContainerStats[]> {
  const response = await fetch(`${API_BASE}/stats`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ stats: ContainerStats[] }>(response);
  return data.stats;
}

export async function fetchOrphans(): Promise<OrphanReport> {
  const response = await fetch(`${API_BASE}/admin/orphans`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<OrphanReport>(response);
}

export async function runCleanup(): Promise<CleanupReport> {
  const response = await fetch(`${API_BASE}/admin/cleanup`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse<CleanupReport>(response);
}

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch('/health');
  return handleResponse<{ status: string; timestamp: string }>(response);
}

export async function fetchProxyKeys(): Promise<ProxyKey[]> {
  const response = await fetch(`${API_BASE}/proxy/keys`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ keys: ProxyKey[] }>(response);
  return data.keys;
}

export async function addProxyKey(input: AddKeyInput): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/proxy/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(Object.entries(getAuthHeaders())) },
    body: JSON.stringify(input),
  });
  return handleResponse<{ id: string }>(response);
}

export async function deleteProxyKey(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/proxy/keys/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function fetchProxyHealth(): Promise<ProxyHealthResponse> {
  const response = await fetch(`${API_BASE}/proxy/health`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<ProxyHealthResponse>(response);
}
