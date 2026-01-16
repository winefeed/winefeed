import { NextResponse } from 'next/server';
import { wineSearcherClient } from '@/lib/wine-searcher/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const winename = searchParams.get('winename');
    const lwin = searchParams.get('lwin');
    const vintage = searchParams.get('vintage') || undefined;
    const currency = (searchParams.get('currency') as 'SEK' | 'EUR' | 'USD') || 'SEK';

    // Validering
    if (!winename && !lwin) {
      return NextResponse.json(
        { error: 'winename eller lwin krävs' },
        { status: 400 }
      );
    }

    // Hämta priser från Wine-Searcher
    let response;
    if (lwin) {
      response = await wineSearcherClient.getPricesByLWIN(lwin, currency);
    } else {
      response = await wineSearcherClient.getPricesByName(winename!, vintage, currency);
    }

    if (!response) {
      return NextResponse.json(
        { error: 'Kunde inte hämta priser från Wine-Searcher' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      wine: response.wine_name,
      vintage: response.vintage,
      lwin: response.lwin,
      currency,
      merchants: response.results,
      total_results: response.total_results,
      lowest_price: response.results[0]?.price || null,
    });

  } catch (error) {
    console.error('Error in /api/wine-prices:', error);
    return NextResponse.json(
      { error: 'Något gick fel' },
      { status: 500 }
    );
  }
}
