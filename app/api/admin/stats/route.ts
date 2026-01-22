/**
 * ADMIN STATS API
 *
 * GET /api/admin/stats
 *
 * Returns comprehensive overview stats for admin dashboard
 * Shows all suppliers and wines in the system
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // Get all suppliers
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, namn, type, is_active, kontakt_email, telefon, hemsida, org_number, created_at')
      .order('created_at', { ascending: false });

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
      return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }

    // Get all wines from supplier_wines table
    const { data: wines, error: winesError } = await supabase
      .from('supplier_wines')
      .select('id, supplier_id, name, producer, color, price_ex_vat_sek, stock_qty, moq, created_at, is_active');

    if (winesError) {
      console.error('Error fetching wines:', winesError);
      return NextResponse.json({ error: 'Failed to fetch wines', details: winesError.message }, { status: 500 });
    }

    // Get all supplier users
    const { data: supplierUsers, error: usersError } = await supabase
      .from('supplier_users')
      .select('id, user_id, supplier_id, created_at');

    // Calculate stats per supplier
    const supplierStats = suppliers?.map(supplier => {
      const supplierWines = wines?.filter(w => w.supplier_id === supplier.id) || [];
      const activeWines = supplierWines.filter(w => w.is_active !== false);
      const users = supplierUsers?.filter(u => u.supplier_id === supplier.id) || [];

      // Wine breakdown by color
      const colorBreakdown: Record<string, number> = {};
      supplierWines.forEach(wine => {
        const color = wine.color || 'unknown';
        colorBreakdown[color] = (colorBreakdown[color] || 0) + 1;
      });

      // Calculate average price (convert from öre to SEK)
      const avgPrice = supplierWines.length > 0
        ? Math.round(supplierWines.reduce((sum, w) => sum + (w.price_ex_vat_sek || 0), 0) / supplierWines.length / 100)
        : 0;

      return {
        id: supplier.id,
        name: supplier.namn,
        type: supplier.type,
        isActive: supplier.is_active,
        email: supplier.kontakt_email,
        phone: supplier.telefon,
        website: supplier.hemsida,
        orgNumber: supplier.org_number,
        createdAt: supplier.created_at,
        totalWines: supplierWines.length,
        activeWines: activeWines.length,
        userCount: users.length,
        avgPriceSek: avgPrice,
        colorBreakdown,
      };
    }) || [];

    // Total stats
    const totalWines = wines?.length || 0;
    const activeWines = wines?.filter(w => w.is_active !== false).length || 0;
    const totalSuppliers = suppliers?.length || 0;
    const activeSuppliers = suppliers?.filter(s => s.is_active !== false).length || 0;
    const totalUsers = supplierUsers?.length || 0;

    // Recent wines (last 10)
    const recentWines = wines
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(wine => {
        const supplier = suppliers?.find(s => s.id === wine.supplier_id);
        return {
          id: wine.id,
          name: wine.name,
          producer: wine.producer,
          color: wine.color,
          priceSek: wine.price_ex_vat_sek ? Math.round(wine.price_ex_vat_sek / 100) : null,
          supplierName: supplier?.namn || 'Okänd',
          createdAt: wine.created_at,
        };
      }) || [];

    // Wine color distribution (total)
    const colorDistribution: Record<string, number> = {};
    wines?.forEach(wine => {
      const color = wine.color || 'unknown';
      colorDistribution[color] = (colorDistribution[color] || 0) + 1;
    });

    // Type distribution
    const typeLabels: Record<string, string> = {
      'SWEDISH_IMPORTER': 'Svensk importör',
      'EU_PRODUCER': 'EU-producent',
      'EU_IMPORTER': 'EU-importör',
    };

    const typeDistribution: Record<string, { count: number; label: string }> = {};
    suppliers?.forEach(supplier => {
      const type = supplier.type || 'unknown';
      if (!typeDistribution[type]) {
        typeDistribution[type] = { count: 0, label: typeLabels[type] || type };
      }
      typeDistribution[type].count++;
    });

    return NextResponse.json({
      overview: {
        totalSuppliers,
        activeSuppliers,
        totalWines,
        activeWines,
        totalUsers,
      },
      suppliers: supplierStats,
      recentWines,
      colorDistribution,
      typeDistribution,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
