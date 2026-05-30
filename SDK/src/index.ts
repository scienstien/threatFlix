/**
 * SecurityAI SDK - Main Class
 * 
 * A thin, reliable JavaScript SDK for capturing security events.
 * This SDK is designed to:
 * - Only format and forward events (no complex logic)
 * - Normalize all event types to a canonical format
 * - Automatically attach client metadata (app version, hostname, timestamp)
 * - Be easy to integrate and merge with other team components
 * 
 * Usage:
 *   const security = new SecurityAI({ apiKey: 'key', projectId: 'proj-1' });
 *   security.auth.failedLogin({ user: 'admin', ip: '192.168.1.5' });
 */

import {
  SecurityEvent,
  EventType,
  SecurityAIConfig,
  AuthEventDetails,
  ReportDetails,
  LogDetails
} from './types';

export class SecurityAI {
  private config: SecurityAIConfig;
  private backendUrl: string;

  // Nested namespace for auth-related methods
  public auth = {
    failedLogin: (details: AuthEventDetails) => this._sendEvent(EventType.FAILED_LOGIN, details),
    successfulLogin: (details: AuthEventDetails) => this._sendEvent(EventType.SUCCESSFUL_LOGIN, details),
    passwordReset: (details: AuthEventDetails) => this._sendEvent(EventType.PASSWORD_RESET, details)
  };

  constructor(config: SecurityAIConfig) {
    if (!config.apiKey || !config.projectId) {
      throw new Error('SecurityAI requires apiKey and projectId in config');
    }

    this.config = {
      backendUrl: 'http://localhost:3000', // Default backend URL
      ...config
    };

    this.backendUrl = this.config.backendUrl || 'http://localhost:3000';
  }

  /**
   * Generic log method for custom security events
   */
  public log(details: LogDetails): void {
    this._sendEvent(EventType.GENERIC_LOG, {
      service: details.level || 'info',
      ...details
    });
  }

  /**
   * Report a security incident or event
   */
  public report(details: ReportDetails): void {
    this._sendEvent(EventType.REPORT, details);
  }

  /**
   * Suspicious IP detection helper
   */
  public suspiciousIP(ip: string, context?: Record<string, unknown>): void {
    this._sendEvent(EventType.SUSPICIOUS_IP, {
      ip,
      ...context
    });
  }

  /**
   * Internal method: Normalize event details and send to backend
   * This is the core of the SDK - everything funnels through here
   */
  private _sendEvent(eventType: EventType | string, details: Record<string, unknown>): void {
    try {
      // Build the canonical event payload
      const event: SecurityEvent = {
        projectId: this.config.projectId,
        event: eventType,
        timestamp: new Date().toISOString(),
        metadata: {
          appVersion: this.config.appVersion || 'unknown',
          hostname: this.config.hostname || 'unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          ...(details.metadata as Record<string, unknown>)
        }
      };

      // Spread in optional fields from details
      if (details.user) event.user = details.user as string;
      if (details.ip) event.ip = details.ip as string;
      if (details.service) event.service = details.service as string;

      // Send to backend
      this._post('/events', event);
    } catch (error) {
      console.error('[SecurityAI] Failed to send event:', error);
      // Fail silently to avoid breaking the host application
    }
  }

  /**
   * HTTP POST helper - sends event to backend
   * Team A should expose POST /events endpoint
   */
  private _post(endpoint: string, payload: SecurityEvent): void {
    // Use fetch if available, else fall back to XMLHttpRequest
    if (typeof fetch !== 'undefined') {
      fetch(`${this.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(payload)
      }).catch((error) => {
        // Fail silently - don't break the app if backend is down
        console.warn('[SecurityAI] Backend unreachable:', error);
      });
    } else if (typeof XMLHttpRequest !== 'undefined') {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.backendUrl}${endpoint}`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${this.config.apiKey}`);
      xhr.onerror = () => {
        console.warn('[SecurityAI] Backend unreachable');
      };
      xhr.send(JSON.stringify(payload));
    }
  }

  /**
   * Utility: Get current config (for debugging)
   */
  public getConfig(): Readonly<SecurityAIConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Utility: Set backend URL (useful for testing or dynamic config)
   */
  public setBackendUrl(url: string): void {
    this.backendUrl = url;
  }
}

// Export as default for easier imports
export default SecurityAI;
