/**
 * ADMIN WINES PAGE
 *
 * /admin/wines
 *
 * Shows all wines in the system with supplier filtering
 */

'use client';

import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wine, RefreshCw, Search, Filter, X, ChevronUp, ChevronDown } from 'lucide-react';

interface WineItem {
  id: string;
  supplier_id: string;
  sku: string | null;
  name: string;
  producer: string;
  country: string;
  region: string | null;
  appellation: string | null;
  grape: string | null;
  color: string;
  vintage: number | null;
  alcohol_pct: number | null;
  volume_ml: number | null;
  price_ex_vat_sek: number;
  price_sek_ib: number | null;
  currency: string | null;
  priceSek: number | null;
  stock_qty: number | null;
  moq: number | null;
  case_size: number | null;
  lead_time_days: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  supplierName: string;
  supplierType: string;
}

interface Supplier {
  id: string;
  namn: string;
  type: string;
}

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  'SWEDISH_IMPORTER': 'Svensk importör',
  'EU_PRODUCER': 'EU-producent',
  'EU_IMPORTER': 'EU-importör',
  'IOR': 'Importör',
};

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
  const [selectedWine, setSelectedWine] = useState<WineItem | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: string | number | null = a[sortColumn as keyof WineItem] as string | number | null;
      let bVal: string | number | null = b[sortColumn as keyof WineItem] as string | number | null;

      // Handle special cases
      if (sortColumn === 'priceSek') {
        aVal = a.priceSek ?? 0;
        bVal = b.priceSek ?? 0;
      } else if (sortColumn === 'supplierName') {
        aVal = a.supplierName || '';
        bVal = b.supplierName || '';
      }

      // Handle null/undefined
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // String comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredWines(filtered);
  }, [wines, selectedSupplier, selectedColor, searchQuery, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sortable header component
  const SortableHeader = ({ column, label, className = '' }: { column: string; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(column)}
      className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <div className="w-3" />
        )}
      </div>
    </th>
  );

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
    } catch (err) {
      console.error('Failed to fetch wines:', err);
      setError(getErrorMessage(err, 'Kunde inte ladda viner'));
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

      {/* Wine Detail Modal */}
      {selectedWine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedWine(null)}>
          <div
            className="bg-card rounded-xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-12 rounded ${COLOR_LABELS[selectedWine.color]?.color || 'bg-gray-400'}`}></div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedWine.name}</h2>
                  <p className="text-muted-foreground">{selectedWine.producer}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWine(null)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Typ</p>
                  <p className="text-foreground font-medium">{COLOR_LABELS[selectedWine.color]?.label || selectedWine.color}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Årgång</p>
                  <p className="text-foreground font-medium">{selectedWine.vintage || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Land</p>
                  <p className="text-foreground font-medium">{selectedWine.country}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Region</p>
                  <p className="text-foreground font-medium">{selectedWine.region || '—'}</p>
                </div>
                {selectedWine.appellation && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Appellation</p>
                    <p className="text-foreground font-medium">{selectedWine.appellation}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Druva</p>
                  <p className="text-foreground font-medium">{selectedWine.grape || '—'}</p>
                </div>
              </div>

              {/* Technical Info */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Teknisk information</h3>
                <div className="grid grid-cols-3 gap-4">
                  {selectedWine.alcohol_pct && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Alkohol</p>
                      <p className="text-foreground font-medium">{selectedWine.alcohol_pct}%</p>
                    </div>
                  )}
                  {selectedWine.volume_ml && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Volym</p>
                      <p className="text-foreground font-medium">{selectedWine.volume_ml} ml</p>
                    </div>
                  )}
                  {selectedWine.sku && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">SKU</p>
                      <p className="text-foreground font-medium font-mono text-sm">{selectedWine.sku}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & Availability */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Pris & tillgänglighet</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pris (ex moms)</p>
                    <p className="text-foreground font-bold text-lg">{selectedWine.priceSek ? `${selectedWine.priceSek} SEK` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">MOQ</p>
                    <p className="text-foreground font-medium">{selectedWine.moq || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Kartongstorlek</p>
                    <p className="text-foreground font-medium">{selectedWine.case_size ? `${selectedWine.case_size} fl` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Lagersaldo</p>
                    <p className={`font-medium ${selectedWine.stock_qty !== null ? (selectedWine.stock_qty > 0 ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                      {selectedWine.stock_qty !== null ? selectedWine.stock_qty : '∞'}
                    </p>
                  </div>
                  {selectedWine.lead_time_days && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ledtid</p>
                      <p className="text-foreground font-medium">{selectedWine.lead_time_days} dagar</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Supplier */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Leverantör</h3>
                <p className="text-foreground font-medium">{selectedWine.supplierName}</p>
                <p className="text-xs text-muted-foreground">{SUPPLIER_TYPE_LABELS[selectedWine.supplierType] || selectedWine.supplierType}</p>
              </div>

              {/* Description */}
              {selectedWine.description && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Beskrivning</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{selectedWine.description}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-border text-xs text-muted-foreground">
                <div className="flex gap-4">
                  <span>ID: {selectedWine.id.slice(0, 8)}...</span>
                  <span>Aktiv: {selectedWine.is_active ? 'Ja' : 'Nej'}</span>
                  <span>Skapad: {new Date(selectedWine.created_at).toLocaleDateString('sv-SE')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wines Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <SortableHeader column="name" label="Vin" className="text-left" />
                <SortableHeader column="producer" label="Producent" className="text-left" />
                <SortableHeader column="supplierName" label="Leverantör" className="text-left" />
                <SortableHeader column="color" label="Typ" className="text-left" />
                <SortableHeader column="region" label="Region" className="text-left" />
                <SortableHeader column="priceSek" label="Pris (ex moms)" className="text-right" />
                <SortableHeader column="moq" label="MOQ" className="text-right" />
                <SortableHeader column="stock_qty" label="Lager" className="text-right" />
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
                    <tr
                      key={wine.id}
                      className="hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => setSelectedWine(wine)}
                    >
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
