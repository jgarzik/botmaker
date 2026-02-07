import https from 'https';
import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { FastifyReply } from 'fastify';
import type { VendorConfig } from '../types.js';

interface FlushableResponse extends ServerResponse {
  flush?: () => void;
}

const REQUEST_TIMEOUT_MS = 600000; // 10 min — must exceed slowest upstream (local LLMs can be slow)

export interface UpstreamRequest {
  vendorConfig: VendorConfig;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
  apiKey: string;
}

export async function forwardToUpstream(
  req: UpstreamRequest,
  reply: FastifyReply
): Promise<number> {
  return new Promise((resolve, reject) => {
    const { vendorConfig, path, method, headers, body, apiKey } = req;

    // Build upstream path
    const upstreamPath = vendorConfig.basePath + path;

    // Clone and modify headers
    const upstreamHeaders: Record<string, string> = { ...headers };

    // Remove hop-by-hop headers
    delete upstreamHeaders.host;
    delete upstreamHeaders.connection;
    delete upstreamHeaders.authorization;
    delete upstreamHeaders['content-length'];

    // Set correct host
    upstreamHeaders.host = vendorConfig.host;

    // Set auth header with real API key
    upstreamHeaders[vendorConfig.authHeader.toLowerCase()] = vendorConfig.authFormat(apiKey);

    // Set content-length if body present
    if (body) {
      upstreamHeaders['content-length'] = String(body.length);
    }

    const protocol = vendorConfig.protocol ?? 'https';
    const port = vendorConfig.port ?? (protocol === 'https' ? 443 : 80);

    const options = {
      hostname: vendorConfig.host,
      port,
      path: upstreamPath,
      method,
      headers: upstreamHeaders,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const transport = protocol === 'http' ? http : https;
    const proxyReq = transport.request(options, (proxyRes: IncomingMessage) => {
      const statusCode = proxyRes.statusCode ?? 500;

      // Build headers to forward (excluding hop-by-hop)
      const forwardHeaders: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        const lowerKey = key.toLowerCase();
        if (value && !['connection', 'transfer-encoding', 'content-length'].includes(lowerKey)) {
          forwardHeaders[key] = value;
        }
      }

      // For SSE responses, ensure proper streaming headers
      const contentType = proxyRes.headers['content-type'];
      if (contentType?.includes('text/event-stream')) {
        forwardHeaders['cache-control'] = 'no-cache';
        forwardHeaders.connection = 'keep-alive';
      }

      // Use raw response to bypass Fastify buffering
      // This is critical for SSE streaming to work properly
      reply.raw.writeHead(statusCode, forwardHeaders);

      proxyRes.on('data', (chunk) => {
        reply.raw.write(chunk);
        // Force flush for SSE - ensures events are sent immediately
        const rawResponse = reply.raw as FlushableResponse;
        if (typeof rawResponse.flush === 'function') {
          rawResponse.flush();
        }
      });

      proxyRes.on('end', () => {
        reply.raw.end();
        resolve(statusCode);
      });

      proxyRes.on('error', (err) => {
        reply.raw.end();
        reject(err);
      });
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      reject(new Error('Upstream request timed out'));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}
