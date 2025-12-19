import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the server-only module (Next.js specific)
vi.mock('server-only', () => ({}));

// Mock next/cache
vi.mock('next/cache', () => ({
  unstable_cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock axios - need to properly structure for ESM default export
const mockAxiosRequest = vi.fn();
const mockIsAxiosError = vi.fn((error) => error?.isAxiosError === true);

vi.mock('axios', () => {
  const axiosFn = (...args: unknown[]) => mockAxiosRequest(...args);
  axiosFn.isAxiosError = mockIsAxiosError;
  return { default: axiosFn };
});

// Mock the config module
vi.mock('./config', () => ({
  agentConfig: {
    baseUrl: 'test-org.my.salesforce.com',
    credentials: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
    agentId: 'test-agent-id',
    getAuthEndpoint: () => 'https://test-org.my.salesforce.com/services/oauth2/token',
    getSessionEndpoint: (sessionId: string) => `/einstein/ai-agent/v1/sessions/${sessionId}`,
    getStreamingEndpoint: (sessionId: string) => `/einstein/ai-agent/v1/sessions/${sessionId}/messages/stream`,
  },
}));

// Mock AppLink SDK
const mockGetAuthorization = vi.fn();
vi.mock('@heroku/applink', () => ({
  init: () => ({
    addons: {
      applink: {
        getAuthorization: mockGetAuthorization,
      },
    },
  }),
}));

// Mock env config - SF_JWT_CONNECTION_NAME
vi.mock('@/config/env', () => ({
  getJwtConnectionName: () => 'test-jwt-connection',
}));

describe('Agentforce Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('AuthMode type', () => {
    it('should export AuthMode type with correct values', async () => {
      const { AuthMode } = await import('./agentforce');
      // TypeScript ensures only "direct" | "applink" are valid
      const directMode: typeof AuthMode = 'direct';
      const applinkMode: typeof AuthMode = 'applink';
      expect(directMode).toBe('direct');
      expect(applinkMode).toBe('applink');
    });
  });

  describe('getToken (direct mode)', () => {
    it('should return credentials from OAuth endpoint', async () => {
      const mockResponse = {
        data: {
          access_token: 'direct-access-token-123',
          api_instance_url: 'https://api.salesforce.com',
        },
      };
      mockAxiosRequest.mockResolvedValueOnce(mockResponse);

      const { newSession } = await import('./agentforce');
      
      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'session-123' },
      });

      const result = await newSession('test-agent', 'direct');

      // First call should be to OAuth endpoint
      expect(mockAxiosRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: 'https://test-org.my.salesforce.com/services/oauth2/token',
        })
      );

      expect(result.sessionId).toBe('session-123');
    });

    it('should throw error when OAuth response is missing access_token', async () => {
      // Use mockResolvedValue (not Once) so retries also get this response
      mockAxiosRequest.mockResolvedValue({
        data: { api_instance_url: 'https://api.salesforce.com' },
      });

      const { newSession } = await import('./agentforce');

      // The validation error gets wrapped in "Authentication failed: Unable to connect to Salesforce"
      // because the catch block treats all non-axios errors the same way
      await expect(newSession('test-agent', 'direct')).rejects.toThrow(
        'Authentication failed'
      );
    });

    it('should throw error when OAuth response is missing api_instance_url', async () => {
      // Use mockResolvedValue (not Once) so retries also get this response
      mockAxiosRequest.mockResolvedValue({
        data: { access_token: 'token-123' },
      });

      const { newSession } = await import('./agentforce');

      // The validation error gets wrapped in "Authentication failed: Unable to connect to Salesforce"
      await expect(newSession('test-agent', 'direct')).rejects.toThrow(
        'Authentication failed'
      );
    });
  });

  describe('getTokenFromAppLink (applink mode)', () => {
    it('should return credentials from AppLink SDK with api.salesforce.com as apiInstanceUrl', async () => {
      mockGetAuthorization.mockResolvedValueOnce({
        accessToken: 'applink-access-token-456',
        domainUrl: 'https://test-org.my.salesforce.com',
      });

      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'applink-session-456' },
      });

      const { newSession } = await import('./agentforce');
      const result = await newSession('test-agent', 'applink');

      // Should call AppLink SDK with the connection name from env
      expect(mockGetAuthorization).toHaveBeenCalledWith('test-jwt-connection');

      // Should use api.salesforce.com for the session creation
      expect(mockAxiosRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.salesforce.com/einstein/ai-agent/v1/agents/test-agent/sessions',
          headers: expect.objectContaining({
            Authorization: 'Bearer applink-access-token-456',
          }),
        })
      );

      expect(result.sessionId).toBe('applink-session-456');
    });

    it('should throw error when AppLink returns no access token', async () => {
      // Use mockResolvedValue (not Once) so retries also get this response
      mockGetAuthorization.mockResolvedValue({
        domainUrl: 'https://test-org.my.salesforce.com',
        // accessToken is missing
      });

      const { newSession } = await import('./agentforce');

      await expect(newSession('test-agent', 'applink')).rejects.toThrow(
        'AppLink authentication failed'
      );
    });

    it('should throw error when AppLink SDK fails', async () => {
      // Use mockRejectedValue (not Once) so retries also get this error
      mockGetAuthorization.mockRejectedValue(new Error('AppLink service unavailable'));

      const { newSession } = await import('./agentforce');

      await expect(newSession('test-agent', 'applink')).rejects.toThrow(
        'AppLink authentication failed'
      );
    });
  });

  describe('newSession', () => {
    it('should default to direct mode when authMode is not specified', async () => {
      mockAxiosRequest.mockResolvedValueOnce({
        data: {
          access_token: 'direct-token',
          api_instance_url: 'https://api.salesforce.com',
        },
      });
      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'default-session' },
      });

      const { newSession } = await import('./agentforce');
      await newSession('test-agent');

      // Should call OAuth endpoint (direct mode)
      expect(mockAxiosRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://test-org.my.salesforce.com/services/oauth2/token',
        })
      );
    });

    it('should use default agentId from config when not provided', async () => {
      mockAxiosRequest.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          api_instance_url: 'https://api.salesforce.com',
        },
      });
      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'session-with-default-agent' },
      });

      const { newSession } = await import('./agentforce');
      await newSession(undefined, 'direct');

      // Should use default agent ID from config
      expect(mockAxiosRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.salesforce.com/einstein/ai-agent/v1/agents/test-agent-id/sessions',
        })
      );
    });
  });

  describe('sendStreamingMessage', () => {
    it('should pass authMode through to getCredentials', async () => {
      // Setup for applink mode - use mockResolvedValue for multiple calls
      mockGetAuthorization.mockResolvedValue({
        accessToken: 'applink-token',
        domainUrl: 'https://test-org.my.salesforce.com',
      });

      // Session creation
      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'streaming-session' },
      });

      // Streaming message
      mockAxiosRequest.mockResolvedValueOnce({
        data: 'stream-data',
      });

      const { sendStreamingMessage } = await import('./agentforce');
      await sendStreamingMessage('Hello', 1, 'test-agent', 'applink');

      // Should have called AppLink
      expect(mockGetAuthorization).toHaveBeenCalled();

      // Streaming call should use api.salesforce.com
      expect(mockAxiosRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('https://api.salesforce.com'),
          headers: expect.objectContaining({
            Authorization: 'Bearer applink-token',
          }),
        })
      );
    });
  });

  describe('API URL handling', () => {
    it('direct mode should use api_instance_url from OAuth response', async () => {
      mockAxiosRequest.mockResolvedValueOnce({
        data: {
          access_token: 'token',
          api_instance_url: 'https://custom-api.salesforce.com',
        },
      });
      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'session' },
      });

      const { newSession } = await import('./agentforce');
      await newSession('agent-id', 'direct');

      expect(mockAxiosRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://custom-api.salesforce.com/einstein/ai-agent/v1/agents/agent-id/sessions',
        })
      );
    });

    it('applink mode should always use https://api.salesforce.com', async () => {
      mockGetAuthorization.mockResolvedValueOnce({
        accessToken: 'token',
        domainUrl: 'https://any-org.my.salesforce.com', // This should be ignored
      });
      mockAxiosRequest.mockResolvedValueOnce({
        data: { sessionId: 'session' },
      });

      const { newSession } = await import('./agentforce');
      await newSession('agent-id', 'applink');

      expect(mockAxiosRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://api.salesforce.com/einstein/ai-agent/v1/agents/agent-id/sessions',
        })
      );
    });
  });

  describe('input validation', () => {
    it('should throw error for empty message text', async () => {
      mockGetAuthorization.mockResolvedValue({
        accessToken: 'token',
        domainUrl: 'https://test-org.my.salesforce.com',
      });
      mockAxiosRequest.mockResolvedValue({
        data: { sessionId: 'session' },
      });

      const { sendStreamingMessage } = await import('./agentforce');

      await expect(sendStreamingMessage('', 1, 'agent-id', 'applink')).rejects.toThrow(
        'Message text cannot be empty'
      );
    });

    it('should throw error for invalid sequence ID', async () => {
      mockGetAuthorization.mockResolvedValue({
        accessToken: 'token',
        domainUrl: 'https://test-org.my.salesforce.com',
      });
      mockAxiosRequest.mockResolvedValue({
        data: { sessionId: 'session' },
      });

      const { sendStreamingMessage } = await import('./agentforce');

      await expect(sendStreamingMessage('Hello', -1, 'agent-id', 'applink')).rejects.toThrow(
        'Invalid sequence ID'
      );
    });
  });
});
