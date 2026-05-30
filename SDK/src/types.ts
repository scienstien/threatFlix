/**
 * SecurityAI SDK Type Definitions
 * 
 * This file defines all types and interfaces used by the SDK.
 * Team A (Backend) should mirror these types for validation.
 * Keep this in sync across teams.
 */

/**
 * Event types supported by SecurityAI
 * Extend this enum as new event types are added
 */
export enum EventType {
  FAILED_LOGIN = 'failed_login',
  SUCCESSFUL_LOGIN = 'successful_login',
  PASSWORD_RESET = 'password_reset',
  SUSPICIOUS_IP = 'suspicious_ip',
  GENERIC_LOG = 'log',
  REPORT = 'report'
}

/**
 * Canonical event payload sent to POST /events
 * All SDK methods normalize to this format
 * This is the contract with Team A (Backend)
 */
export interface SecurityEvent {
  projectId: string;
  event: EventType | string;
  user?: string;
  ip?: string;
  service?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * SDK Configuration
 */
export interface SecurityAIConfig {
  apiKey: string;
  projectId: string;
  backendUrl?: string;
  appVersion?: string;
  hostname?: string;
}

/**
 * Authentication event details
 */
export interface AuthEventDetails extends Record<string, unknown> {
  user: string;
  ip: string;
  service?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Report event details (generic security event)
 */
export interface ReportDetails extends Record<string, unknown> {
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

/**
 * Log event details
 */
export interface LogDetails extends Record<string, unknown> {
  message: string;
  level?: 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}
