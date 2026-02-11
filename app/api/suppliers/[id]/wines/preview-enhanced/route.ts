/**
 * POST /api/suppliers/[id]/wines/preview-enhanced
 *
 * Enhanced wine import preview using Catalog Agent.
 * Adds smart mapping, enrichment, anomaly detection, and quality report.
 *
 * REQUIRES: SELLER role + ownership of supplier
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { runCatalogAgentPreview } from '@/lib/catalog-agent/pipeline';
import { CatalogAgentOptions } from '@/lib/catalog-agent/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await props.params;
  try {
    const supplierId = params.id;

    // Auth check
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    if (actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      if (actor.supplier_id !== supplierId) {
        return NextResponse.json(
          { error: 'Not authorized for this supplier' },
          { status: 403 }
        );
      }
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Ingen fil uppladdad' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Filen är för stor. Max ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
    const hasValidExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Filformatet stöds inte. Ladda upp Excel (.xlsx, .xls), CSV eller PDF.' },
        { status: 400 }
      );
    }

    // Parse options from form data
    const options: CatalogAgentOptions = {
      enableSmartMapping: formData.get('enableSmartMapping') !== 'false',
      enableEnrichment: formData.get('enableEnrichment') !== 'false',
      enableAnomalyDetection: formData.get('enableAnomalyDetection') !== 'false',
      enableDescriptions: formData.get('enableDescriptions') === 'true',
    };

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Run Catalog Agent pipeline
    const result = await runCatalogAgentPreview(buffer, file.name, options);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Enhanced Preview] Error:', error);
    return NextResponse.json(
      { error: `Fel vid filhantering: ${error.message}` },
      { status: 500 }
    );
  }
}
