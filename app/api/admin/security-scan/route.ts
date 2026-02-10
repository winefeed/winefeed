/**
 * SECURITY SCAN API
 *
 * POST /api/admin/security-scan
 *
 * Runs the Security Agent pipeline and returns the report.
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { runSecurityScan } from '@/lib/security-agent/pipeline';
import { SecurityAgentOptions } from '@/lib/security-agent/types';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    let options: SecurityAgentOptions = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // No body or invalid JSON — use defaults
    }

    const result = await runSecurityScan(options);
    return NextResponse.json(result.report);
  } catch (error: any) {
    console.error('Security scan failed:', error);
    return NextResponse.json(
      { error: 'Security scan failed', message: error.message },
      { status: 500 }
    );
  }
}
