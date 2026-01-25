/**
 * ORG NUMBER LOOKUP API
 *
 * GET /api/org-lookup?org_number=XXXXXX-XXXX
 *
 * Looks up Swedish company info from organization number.
 * Uses Roaring.io API if configured, otherwise returns not_found.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orgNumber = searchParams.get('org_number');

  if (!orgNumber) {
    return NextResponse.json(
      { error: 'Missing org_number parameter' },
      { status: 400 }
    );
  }

  // Validate format (XXXXXX-XXXX)
  const orgPattern = /^\d{6}-\d{4}$/;
  if (!orgPattern.test(orgNumber)) {
    return NextResponse.json(
      { error: 'Invalid org_number format. Expected XXXXXX-XXXX' },
      { status: 400 }
    );
  }

  // Check if Roaring.io API key is configured
  const roaringApiKey = process.env.ROARING_API_KEY;

  if (roaringApiKey) {
    try {
      // Call Roaring.io API
      const response = await fetch(
        `https://api.roaring.io/se/company/lookup/${orgNumber.replace('-', '')}`,
        {
          headers: {
            'Authorization': `Bearer ${roaringApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Extract relevant fields
        return NextResponse.json({
          name: data.name || data.companyName || null,
          address: data.address?.street || data.visitingAddress?.street || null,
          postalCode: data.address?.postalCode || data.visitingAddress?.postalCode || null,
          city: data.address?.city || data.visitingAddress?.city || null,
          status: data.status === 'ACTIVE' ? 'active' : 'inactive',
        });
      } else if (response.status === 404) {
        return NextResponse.json({
          status: 'not_found',
          message: 'Företaget hittades inte. Fyll i uppgifterna manuellt.',
        });
      } else {
        // API error - fallback to not_found
        console.error('Roaring API error:', response.status);
        return NextResponse.json({
          status: 'not_found',
          message: 'Kunde inte hämta företagsinfo. Fyll i uppgifterna manuellt.',
        });
      }
    } catch (error) {
      console.error('Roaring API error:', error);
      // On error, return not_found so user can enter manually
      return NextResponse.json({
        status: 'not_found',
        message: 'Kunde inte hämta företagsinfo. Fyll i uppgifterna manuellt.',
      });
    }
  }

  // No API key configured - return not_found
  // User will enter details manually
  return NextResponse.json({
    status: 'not_found',
    message: 'Fyll i uppgifterna manuellt.',
  });
}
