// ---------------------------------------------------------------------------
// Payload validation for incoming events.
// Hand-rolled for zero dependencies — forward-compat: swap in Zod if needed.
// ---------------------------------------------------------------------------

import { REQUIRED_EVENT_FIELDS, type SecurityEventInput } from "../types/events.ts";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Validate a raw request body against the SecurityEventInput schema. */
export function validateEventPayload(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object." }] };
  }

  const data = body as Record<string, unknown>;

  // Check required fields exist and are strings
  for (const field of REQUIRED_EVENT_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push({ field, message: `"${field}" is required.` });
    } else if (typeof data[field] !== "string") {
      errors.push({ field, message: `"${field}" must be a string.` });
    } else if ((data[field] as string).trim().length === 0) {
      errors.push({ field, message: `"${field}" must not be empty.` });
    }
  }

  // Validate timestamp if provided
  if (data.timestamp !== undefined) {
    if (typeof data.timestamp !== "string") {
      errors.push({ field: "timestamp", message: '"timestamp" must be an ISO 8601 string.' });
    } else {
      const parsed = Date.parse(data.timestamp as string);
      if (isNaN(parsed)) {
        errors.push({ field: "timestamp", message: '"timestamp" is not a valid ISO 8601 date.' });
      }
    }
  }

  // Validate metadata if provided
  if (data.metadata !== undefined) {
    if (typeof data.metadata !== "object" || Array.isArray(data.metadata) || data.metadata === null) {
      errors.push({ field: "metadata", message: '"metadata" must be a JSON object.' });
    }
  }

  // Validate tags if provided
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      errors.push({ field: "tags", message: '"tags" must be an array of strings.' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Build a JSON error response. */
export function validationErrorResponse(errors: ValidationError[]): Response {
  return Response.json(
    {
      error: "Validation failed",
      details: errors,
    },
    { status: 400 }
  );
}
