/**
 * IOR ROUTE GUARD
 *
 * Helper to consistently resolve IORContext in all /api/ior/* routes.
 * Keeps routes thin: just call requireIORContext(request) and get ctx.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService, type ActorContext } from '@/lib/actor-service';
import { type IORContext } from '@/lib/ior-portfolio-service';

export interface IORGuardResult {
  ctx: IORContext;
  actor: ActorContext;
}

export interface IORGuardError {
  error: string;
  status: 401 | 403;
}

/**
 * Resolve IORContext from request headers.
 * Returns ctx and actor if successful, or error response if not.
 */
export async function requireIORContext(
  request: NextRequest
): Promise<IORGuardResult | IORGuardError> {
  const tenantId = request.headers.get('x-tenant-id');
  const userId = request.headers.get('x-user-id');

  if (!tenantId || !userId) {
    return { error: 'Missing authentication context', status: 401 };
  }

  const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

  if (!actorService.hasRole(actor, 'IOR')) {
    return { error: 'Access denied - IOR role required', status: 403 };
  }

  if (!actor.importer_id) {
    return { error: 'No importer associated with user', status: 403 };
  }

  const ctx: IORContext = {
    tenantId,
    importerId: actor.importer_id,
    userId,
    userName: actor.user_email,
  };

  return { ctx, actor };
}

/**
 * Type guard to check if result is an error
 */
export function isGuardError(result: IORGuardResult | IORGuardError): result is IORGuardError {
  return 'error' in result;
}

/**
 * Convert guard error to NextResponse
 */
export function guardErrorResponse(error: IORGuardError): NextResponse {
  return NextResponse.json({ error: error.error }, { status: error.status });
}

/**
 * Validate inbound email webhook secret
 */
export function validateInboundSecret(request: NextRequest): boolean {
  const secret = process.env.INBOUND_EMAIL_SECRET;

  // If no secret configured, reject all requests (fail secure)
  if (!secret) {
    console.warn('[IOR Inbound] INBOUND_EMAIL_SECRET not configured - rejecting request');
    return false;
  }

  const providedSecret = request.headers.get('x-wf-inbound-secret');
  return providedSecret === secret;
}
