/**
 * ADMIN WINES PAGE
 *
 * /admin/wines
 *
 * Shows all wines in the system with supplier filtering
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wine, RefreshCw, Search, Filter } from 'lucide-react';

interface WineItem {
  id: string;
  supplier_id: string;
  name: string;
  producer: string;
  country: string;
  region: string | null;
  color: string;
  price_ex_vat_sek: number;
  priceSek: number | null;
  stock_qty: number | null;
  moq: number | null;
  is_active: boolean;
  created_at: string;
  supplierName: string;
  supplierType: string;
}

interface Supplier {
  id: string;
  namn: string;
  type: string;
}

const COLOR_LABELS: Record<string, { label: string; color: string }> = {
  red: { label: 'Rött', color: 'bg-red-500' },
  white: { label: 'Vitt', color: 'bg-amber-200' },
  rose: { label: 'Rosé', color: 'bg-pink-300' },
  sparkling: { label: 'Mousserande', color: 'bg-yellow-300' },
  orange: { label: 'Orange', color: 'bg-orange-400' },
  fortified: { label: 'Starkvin', color: 'bg-amber-700' },
};

function AdminWinesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wines, setWines] = useState<WineItem[]>([]);
  const [filteredWines, setFilteredWines] = useState<WineItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<string>(searchParams.get('supplier') || '');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchWines();
  }, []);

  useEffect(() => {
    let filtered = wines;

    // Filter by supplier
    if (selectedSupplier) {
      filtered = filtered.filter(w => w.supplier_id === selectedSupplier);
    }

    // Filter by color
    if (selectedColor) {
      filtered = filtered.filter(w => w.color === selectedColor);
    }

    // Search by name or producer
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(query) ||
        w.producer.toLowerCase().includes(query) ||
        w.country?.toLowerCase().includes(query) ||
        w.region?.toLowerCase().includes(query)
      );
    }

    setFilteredWines(filtered);
  }, [wines, selectedSupplier, selectedColor, searchQuery]);

  const fetchWines = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/wines');

      if (!response.ok) {
        throw new Error('Failed to fetch wines');
      }

      const data = await response.json();
      setWines(data.wines);
      setFilteredWines(data.wines);
      setSuppliers(data.suppliers);
    } catch (err: any) {
      console.error('Failed to fetch wines:', err);
      setError(err.message || 'Kunde inte ladda viner');
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplier(supplierId);
    // Update URL without reload
    const params = new URLSearchParams(searchParams);
    if (supplierId) {
      params.set('supplier', supplierId);
    } else {
      params.delete('supplier');
    }
    router.replace(`/admin/wines?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center max-w-md mx-auto">
          <div className="text-destructive text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Något gick fel</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchWines}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Försök igen
          </button>
        </div>
      </div>
    );
  }

  // Get unique colors from wines
  const availableColors = [...new Set(wines.map(w => w.color))].filter(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vinkatalog</h1>
          <p className="text-muted-foreground mt-1">
            {filteredWines.length} av {wines.length} viner
          </p>
        </div>
        <button
          onClick={fetchWines}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Uppdatera
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-card rounded-lg p-4 border border-border">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">
              Sök
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök vin, producent, region..."
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Supplier filter */}
          <div className="w-64">
            <label className="block text-sm font-medium text-foreground mb-1">
              Leverantör
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Alla leverantörer</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.namn}
                </option>
              ))}
            </select>
          </div>

          {/* Color filter */}
          <div className="w-48">
            <label className="block text-sm font-medium text-foreground mb-1">
              Färg
            </label>
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Alla färger</option>
              {availableColors.map((color) => (
                <option key={color} value={color}>
                  {COLOR_LABELS[color]?.label || color}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Wines Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Vin
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Producent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Leverantör
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Typ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Region
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pris
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  MOQ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lager
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredWines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Wine className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Inga viner hittades</p>
                  </td>
                </tr>
              ) : (
                filteredWines.map((wine) => {
                  const colorInfo = COLOR_LABELS[wine.color] || { label: wine.color, color: 'bg-gray-400' };
                  return (
                    <tr key={wine.id} className="hover:bg-accent transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded ${colorInfo.color}`}></div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{wine.name}</div>
                            <div className="text-xs text-muted-foreground">{wine.country}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {wine.producer}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-foreground">{wine.supplierName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {colorInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {wine.region || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground text-right font-medium">
                        {wine.priceSek ? `${wine.priceSek} kr` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                        {wine.moq || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {wine.stock_qty !== null ? (
                          <span className={wine.stock_qty > 0 ? 'text-green-600' : 'text-red-600'}>
                            {wine.stock_qty}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">∞</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminWinesPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    }>
      <AdminWinesPageContent />
    </Suspense>
  );
}
