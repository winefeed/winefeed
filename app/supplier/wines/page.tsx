'use client';

/**
 * SUPPLIER WINES PAGE - Pilot Loop 2.0
 *
 * Manage wine catalog with:
 * - Inline editing (price, vintage, stock, status)
 * - Bulk selection and updates
 * - Clear status indicators
 * - Offer usage tracking
 */

import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Wine,
  Upload,
  Search,
  Plus,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Loader2,
  Package,
  Clock,
  Archive,
} from 'lucide-react';

interface SupplierWine {
  id: string;
  name: string;
  producer: string;
  vintage: string | null;
  region: string;
  country: string;
  grape: string;
  color: string;
  price_ex_vat_sek: number;
  stock_qty: number;
  moq: number;
  status: 'ACTIVE' | 'TEMPORARILY_UNAVAILABLE' | 'END_OF_VINTAGE';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  offer_count?: number;
}

// Helper to format relative time
function formatTimeAgo(dateString: string | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just nu';
  if (diffMins < 60) return `${diffMins} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  return date.toLocaleDateString('sv-SE');
}

type SortField = 'name' | 'producer' | 'region' | 'color' | 'price_ex_vat_sek' | 'stock_qty' | 'status' | 'offer_count';
type SortDirection = 'asc' | 'desc';

interface ImportPreview {
  valid: ImportRow[];
  invalid: { row: number; data: any; errors: string[] }[];
  filename: string;
}

interface ImportRow {
  wine_name: string;
  producer: string;
  vintage: string;
  region: string;
  country: string;
  grape: string;
  color: string;
  price: number;
  stock: number;
  moq: number;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Aktiv', icon: CheckCircle, color: 'green' },
  { value: 'TEMPORARILY_UNAVAILABLE', label: 'Tillfälligt slut', icon: Clock, color: 'yellow' },
  { value: 'END_OF_VINTAGE', label: 'Årgång slut', icon: Archive, color: 'gray' },
] as const;

export default function SupplierWinesPage() {
  const [wines, setWines] = useState<SupplierWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('producer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ wineId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);

  // Bulk selection state
  const [selectedWines, setSelectedWines] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchSupplierAndWines();
  }, []);

  async function fetchSupplierAndWines() {
    try {
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      const winesRes = await fetch(`/api/suppliers/${supplierData.supplierId}/wines`);
      if (winesRes.ok) {
        const winesData = await winesRes.json();
        setWines(winesData.wines || []);
      }
    } catch (error) {
      console.error('Failed to fetch wines:', error);
    } finally {
      setLoading(false);
    }
  }

  // Editable fields in order for Tab navigation
  const EDITABLE_FIELDS = ['price_ex_vat_sek', 'stock_qty'];

  // Inline edit handlers
  const startEdit = (wineId: string, field: string, currentValue: any) => {
    setEditingCell({ wineId, field });
    setEditValue(String(currentValue ?? ''));
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Navigate to next/prev editable cell
  const navigateToNextCell = (currentWineId: string, currentField: string, reverse: boolean = false) => {
    const wineIds = filteredAndSortedWines.map(w => w.id);
    const currentWineIndex = wineIds.indexOf(currentWineId);
    const currentFieldIndex = EDITABLE_FIELDS.indexOf(currentField);

    let nextWineIndex = currentWineIndex;
    let nextFieldIndex = currentFieldIndex + (reverse ? -1 : 1);

    // Move to next/prev field or wrap to next/prev row
    if (nextFieldIndex >= EDITABLE_FIELDS.length) {
      nextFieldIndex = 0;
      nextWineIndex++;
    } else if (nextFieldIndex < 0) {
      nextFieldIndex = EDITABLE_FIELDS.length - 1;
      nextWineIndex--;
    }

    // Check bounds
    if (nextWineIndex < 0 || nextWineIndex >= wineIds.length) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    const nextWine = filteredAndSortedWines[nextWineIndex];
    const nextField = EDITABLE_FIELDS[nextFieldIndex];
    const nextValue = nextField === 'price_ex_vat_sek'
      ? nextWine.price_ex_vat_sek / 100
      : nextWine.stock_qty ?? '';

    setEditingCell({ wineId: nextWine.id, field: nextField });
    setEditValue(String(nextValue));
  };

  const saveEdit = async (navigateAfter?: { wineId: string; field: string; reverse: boolean }): Promise<boolean> => {
    if (!editingCell || !supplierId) return false;

    const { wineId, field } = editingCell;
    let value: any = editValue;

    // Convert value based on field type
    if (field === 'price_ex_vat_sek') {
      value = Math.round(parseFloat(editValue) * 100); // Convert to öre
      if (isNaN(value) || value < 0) {
        setImportResult({ success: false, message: 'Ogiltigt pris' });
        return false;
      }
      // Block price = 0
      if (value === 0) {
        setImportResult({ success: false, message: 'Pris kan inte vara 0' });
        return false;
      }
    } else if (field === 'stock_qty' || field === 'vintage') {
      value = parseInt(editValue) || null;
    }

    setSaving(wineId);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const { wine } = await response.json();
        setWines(prev => prev.map(w => w.id === wineId ? { ...w, ...wine } : w));

        // Navigate to next cell if requested
        if (navigateAfter) {
          navigateToNextCell(navigateAfter.wineId, navigateAfter.field, navigateAfter.reverse);
        } else {
          setEditingCell(null);
          setEditValue('');
        }
        return true;
      } else {
        const error = await response.json();
        setImportResult({ success: false, message: error.error || 'Kunde inte spara' });
        return false;
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Ändringar kunde inte sparas - kontrollera nätverket' });
      return false;
    } finally {
      setSaving(null);
    }
  };

  const updateStatus = async (wineId: string, newStatus: string) => {
    if (!supplierId) return;

    setSaving(wineId);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const { wine } = await response.json();
        setWines(prev => prev.map(w => w.id === wineId ? { ...w, ...wine } : w));
      } else {
        setImportResult({ success: false, message: 'Kunde inte uppdatera status' });
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Ett fel uppstod' });
    } finally {
      setSaving(null);
    }
  };

  // Bulk update handler
  const bulkUpdateStatus = async (newStatus: string) => {
    if (!supplierId || selectedWines.size === 0) return;

    setBulkUpdating(true);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_ids: Array.from(selectedWines),
          updates: { status: newStatus },
        }),
      });

      if (response.ok) {
        const { updated_count } = await response.json();
        setWines(prev => prev.map(w =>
          selectedWines.has(w.id) ? { ...w, status: newStatus as any } : w
        ));
        setSelectedWines(new Set());
        setImportResult({ success: true, message: `${updated_count} viner uppdaterade` });
      } else {
        const error = await response.json();
        setImportResult({ success: false, message: error.error || 'Bulk-uppdatering misslyckades' });
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Ett fel uppstod' });
    } finally {
      setBulkUpdating(false);
    }
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedWines.size === filteredAndSortedWines.length) {
      setSelectedWines(new Set());
    } else {
      setSelectedWines(new Set(filteredAndSortedWines.map(w => w.id)));
    }
  };

  const toggleSelect = (wineId: string) => {
    const newSelected = new Set(selectedWines);
    if (newSelected.has(wineId)) {
      newSelected.delete(wineId);
    } else {
      newSelected.add(wineId);
    }
    setSelectedWines(newSelected);
  };

  // Dropzone for import
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !supplierId) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/preview`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPreview({
          valid: data.valid || [],
          invalid: data.invalid || [],
          filename: file.name,
        });
      } else {
        const error = await response.json();
        setImportResult({ success: false, message: error.error || 'Kunde inte läsa filen' });
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Ett fel uppstod vid filuppladdning' });
    }
  }, [supplierId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  async function handleImport() {
    if (!preview || !supplierId) return;

    setImporting(true);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wines: preview.valid }),
      });

      if (response.ok) {
        const data = await response.json();
        setImportResult({ success: true, message: `${data.imported} viner importerade!` });
        setPreview(null);
        setShowUpload(false);
        fetchSupplierAndWines();
      } else {
        const error = await response.json();
        setImportResult({ success: false, message: error.error || 'Import misslyckades' });
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Ett fel uppstod vid import' });
    } finally {
      setImporting(false);
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedWines = wines
    .filter((wine) => {
      // Status filter
      if (statusFilter !== 'ALL' && wine.status !== statusFilter) {
        return false;
      }
      // Search filter
      return (
        wine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wine.producer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wine.region?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    })
    .sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortField) {
        case 'name': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'producer': aValue = a.producer.toLowerCase(); bValue = b.producer.toLowerCase(); break;
        case 'region': aValue = (a.region || '').toLowerCase(); bValue = (b.region || '').toLowerCase(); break;
        case 'color': aValue = a.color || ''; bValue = b.color || ''; break;
        case 'price_ex_vat_sek': aValue = a.price_ex_vat_sek; bValue = b.price_ex_vat_sek; break;
        case 'stock_qty': aValue = a.stock_qty ?? 0; bValue = b.stock_qty ?? 0; break;
        case 'status': aValue = a.status; bValue = b.status; break;
        case 'offer_count': aValue = a.offer_count ?? 0; bValue = b.offer_count ?? 0; break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const colorLabels: Record<string, string> = {
    red: 'Rött', white: 'Vitt', rose: 'Rosé', sparkling: 'Mousserande', fortified: 'Starkvin', orange: 'Orange',
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    if (!option) return null;

    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      gray: 'bg-gray-100 text-gray-600',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[option.color]}`}>
        <option.icon className="w-3 h-3" />
        {option.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vinkatalog</h1>
          <p className="text-gray-500 mt-1">
            {wines.length} viner i din katalog
            {wines.filter(w => w.status === 'ACTIVE').length !== wines.length && (
              <span className="ml-2">({wines.filter(w => w.status === 'ACTIVE').length} aktiva)</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/admin/wines/template?format=xlsx"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Mall
          </a>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg text-sm font-medium hover:bg-[#6B1818]"
          >
            <Upload className="h-4 w-4" />
            Importera viner
          </button>
        </div>
      </div>

      {/* Toast Messages */}
      {importResult && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {importResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
          <span className={importResult.success ? 'text-green-800' : 'text-red-800'}>{importResult.message}</span>
          <button onClick={() => setImportResult(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedWines.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-4">
          <span className="text-blue-800 font-medium">{selectedWines.size} viner valda</span>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => bulkUpdateStatus(option.value)}
                disabled={bulkUpdating}
                className="px-3 py-1 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
              >
                {bulkUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : option.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelectedWines(new Set())} className="ml-auto text-blue-600 hover:underline text-sm">
            Avmarkera alla
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök viner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1E1E]/20 focus:border-[#7B1E1E]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-2 text-sm rounded-lg ${statusFilter === 'ALL' ? 'bg-[#7B1E1E] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Alla
          </button>
          {STATUS_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`px-3 py-2 text-sm rounded-lg ${statusFilter === option.value ? 'bg-[#7B1E1E] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wine List */}
      {filteredAndSortedWines.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-[70vh] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    checked={selectedWines.size === filteredAndSortedWines.length && filteredAndSortedWines.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#7B1E1E] focus:ring-[#7B1E1E]"
                  />
                </th>
                <SortableHeader label="Vin" field="name" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Producent" field="producer" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Pris (ex moms)" field="price_ex_vat_sek" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader label="Lager" field="stock_qty" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader label="Status" field="status" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="I offerter" field="offer_count" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedWines.map((wine) => (
                <tr key={wine.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedWines.has(wine.id)}
                      onChange={() => toggleSelect(wine.id)}
                      className="rounded border-gray-300 text-[#7B1E1E] focus:ring-[#7B1E1E]"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">
                      {wine.name}
                      {wine.vintage && wine.vintage !== 'NV' && (
                        <span className="text-gray-500 ml-1">{wine.vintage}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{wine.grape} &middot; {wine.region}, {wine.country}</div>
                    {wine.updated_at && formatTimeAgo(wine.updated_at) && (
                      <div className="text-xs text-gray-400 mt-0.5">Redigerad {formatTimeAgo(wine.updated_at)}</div>
                    )}
                  </td>
                  <td className="p-4 text-gray-600">{wine.producer}</td>

                  {/* Editable Price */}
                  <td className="p-4 text-right">
                    {editingCell?.wineId === wine.id && editingCell?.field === 'price_ex_vat_sek' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              saveEdit({ wineId: wine.id, field: 'price_ex_vat_sek', reverse: e.shiftKey });
                            }
                          }}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#7B1E1E]"
                          autoFocus
                        />
                        <button onClick={() => saveEdit()} disabled={saving === wine.id} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          {saving === wine.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(wine.id, 'price_ex_vat_sek', wine.price_ex_vat_sek / 100)}
                        className="cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded font-medium text-gray-900"
                        title="Klicka för att redigera"
                      >
                        {(wine.price_ex_vat_sek / 100).toLocaleString('sv-SE')} kr
                      </span>
                    )}
                  </td>

                  {/* Editable Stock */}
                  <td className="p-4 text-right">
                    {editingCell?.wineId === wine.id && editingCell?.field === 'stock_qty' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              saveEdit({ wineId: wine.id, field: 'stock_qty', reverse: e.shiftKey });
                            }
                          }}
                          className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#7B1E1E]"
                          autoFocus
                        />
                        <button onClick={() => saveEdit()} disabled={saving === wine.id} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          {saving === wine.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(wine.id, 'stock_qty', wine.stock_qty ?? '')}
                        className="cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded text-gray-600"
                        title="Klicka för att redigera"
                      >
                        {wine.stock_qty ?? '—'}
                      </span>
                    )}
                  </td>

                  {/* Status Dropdown */}
                  <td className="p-4">
                    {saving === wine.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <select
                        value={wine.status}
                        onChange={(e) => updateStatus(wine.id, e.target.value)}
                        className="text-xs border-0 bg-transparent cursor-pointer focus:ring-0 p-0"
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Offer Count */}
                  <td className="p-4 text-right">
                    {wine.offer_count && wine.offer_count > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-sm text-blue-600 cursor-help"
                        title={`Används i ${wine.offer_count} ${wine.offer_count === 1 ? 'offert' : 'offerter'}`}
                      >
                        <Package className="h-3 w-3" />
                        {wine.offer_count}
                      </span>
                    ) : (
                      <span className="text-gray-300" title="Inte använd i några offerter">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Wine className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'ALL' ? 'Inga viner hittades' : 'Din katalog är tom'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'ALL' ? 'Prova med en annan sökning eller filter' : 'Ladda upp dina viner för att komma igång'}
          </p>
          {!searchTerm && statusFilter === 'ALL' && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg text-sm font-medium hover:bg-[#6B1818]"
            >
              <Upload className="h-4 w-4" />
              Importera viner
            </button>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Importera viner</h2>
              <button onClick={() => { setShowUpload(false); setPreview(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {!preview ? (
                <>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-[#7B1E1E] bg-[#7B1E1E]/5' : 'border-gray-300 hover:border-gray-400'}`}>
                    <input {...getInputProps()} />
                    <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">{isDragActive ? 'Släpp filen här...' : 'Dra och släpp en Excel- eller CSV-fil här'}</p>
                    <p className="text-sm text-gray-400">eller klicka för att välja fil</p>
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Kolumner som krävs:</h3>
                    <p className="text-sm text-gray-600">wine_name, producer, vintage, region, country, grape, color, price, moq</p>
                    <a href="/api/admin/wines/template?format=xlsx" className="text-sm text-[#7B1E1E] hover:underline mt-2 inline-block">Ladda ner mall &rarr;</a>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Fil: <strong>{preview.filename}</strong></p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-green-600"><CheckCircle className="h-4 w-4" /><span className="text-sm">{preview.valid.length} giltiga</span></div>
                      {preview.invalid.length > 0 && <div className="flex items-center gap-2 text-red-600"><AlertCircle className="h-4 w-4" /><span className="text-sm">{preview.invalid.length} ogiltiga</span></div>}
                    </div>
                  </div>

                  {preview.valid.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">Förhandsvisning:</h3>
                      <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0"><tr><th className="text-left p-2">Vin</th><th className="text-left p-2">Producent</th><th className="text-left p-2">År</th><th className="text-right p-2">Pris</th></tr></thead>
                          <tbody>
                            {preview.valid.slice(0, 5).map((wine, i) => (<tr key={i} className="border-t"><td className="p-2">{wine.wine_name}</td><td className="p-2">{wine.producer}</td><td className="p-2">{wine.vintage}</td><td className="p-2 text-right">{wine.price} kr</td></tr>))}
                          </tbody>
                        </table>
                        {preview.valid.length > 5 && <p className="text-sm text-gray-500 p-2 text-center bg-gray-50">... och {preview.valid.length - 5} till</p>}
                      </div>
                    </div>
                  )}

                  {preview.invalid.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h3 className="font-medium text-red-800 mb-2">Ogiltiga rader:</h3>
                      <ul className="text-sm text-red-700 space-y-1">
                        {preview.invalid.slice(0, 3).map((item, i) => (<li key={i}>Rad {item.row}: {item.errors.join(', ')}</li>))}
                        {preview.invalid.length > 3 && <li>... och {preview.invalid.length - 3} till</li>}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setPreview(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Välj annan fil</button>
                    <button onClick={handleImport} disabled={importing || preview.valid.length === 0} className="px-4 py-2 bg-[#7B1E1E] text-white rounded-lg text-sm font-medium hover:bg-[#6B1818] disabled:opacity-50 disabled:cursor-not-allowed">
                      {importing ? 'Importerar...' : `Importera ${preview.valid.length} viner`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}

function SortableHeader({ label, field, currentField, direction, onSort, align = 'left' }: SortableHeaderProps) {
  const isActive = currentField === field;
  return (
    <th className={`p-4 font-medium text-gray-600 text-sm cursor-pointer hover:bg-gray-100 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => onSort(field)}>
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <span>{label}</span>
        <span className="text-gray-400">
          {isActive ? (direction === 'asc' ? <ChevronUp className="h-4 w-4 text-[#7B1E1E]" /> : <ChevronDown className="h-4 w-4 text-[#7B1E1E]" />) : <ChevronsUpDown className="h-3 w-3" />}
        </span>
      </div>
    </th>
  );
}
