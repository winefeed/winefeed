/**
 * WINE KNOWLEDGE INGESTION API
 *
 * POST /api/admin/wine-knowledge/ingest
 *
 * Triggers ingestion of wine knowledge from Systembolaget data.
 * Admin-only endpoint.
 *
 * Query params:
 * - source=github  → Fetch from GitHub data repo (default, fast)
 * - source=scrape&url=...  → Scrape a specific product page
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { ingestFromGitHub, scrapeProductPage } from '@/lib/rag/systembolaget-scraper';
import { ingestWines } from '@/lib/rag/wine-knowledge-store';

export async function POST(request: NextRequest) {
  try {
    // Auth: admin only
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'github';

    if (source === 'scrape') {
      // Scrape a single URL
      const url = searchParams.get('url');
      if (!url) {
        return NextResponse.json({ error: 'url parameter required for scrape mode' }, { status: 400 });
      }

      const wine = await scrapeProductPage(url);
      if (!wine) {
        return NextResponse.json({ error: 'Failed to parse product page' }, { status: 400 });
      }

      const result = await ingestWines([wine]);
      return NextResponse.json({ source: 'scrape', wine: wine.wine_name, result });
    }

    // Default: GitHub data
    const wines = await ingestFromGitHub();

    if (wines.length === 0) {
      return NextResponse.json({
        source: 'github',
        message: 'No wines with taste data found in GitHub data',
        hint: 'The GitHub repo may not include taste descriptions. Try scraping individual product pages instead.',
      });
    }

    const result = await ingestWines(wines);
    return NextResponse.json({ source: 'github', result });

  } catch (error: any) {
    console.error('Wine knowledge ingestion error:', error);
    return NextResponse.json(
      { error: 'Ingestion failed', details: error.message },
      { status: 500 }
    );
  }
}
