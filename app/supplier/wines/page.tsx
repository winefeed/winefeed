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
  Trash2,
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
  notes?: string | null;
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
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      imported: number;
      updated: number;
      errors: number;
    };
  } | null>(null);
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

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<SupplierWine | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  const EDITABLE_FIELDS = ['price_ex_vat_sek', 'vintage', 'status', 'notes'];

  // Toast state (separate from importResult for better UX)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Store original value for rollback (per-cell snapshot, not whole array)
  const [originalValue, setOriginalValue] = useState<any>(null);

  // Track in-flight saves to prevent rollback conflicts
  const [inFlightSaves, setInFlightSaves] = useState<Map<string, { field: string; oldValue: any }>>(new Map());

  // Inline edit handlers
  const startEdit = (wineId: string, field: string, currentValue: any) => {
    setEditingCell({ wineId, field });
    setEditValue(String(currentValue ?? ''));
    setOriginalValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setOriginalValue(null);
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
        showToast('Ogiltigt pris', 'error');
        return false;
      }
      // Block price = 0
      if (value === 0) {
        showToast('Pris kan inte vara 0', 'error');
        return false;
      }
    } else if (field === 'vintage') {
      value = editValue ? parseInt(editValue) : null;
      if (editValue && isNaN(parseInt(editValue))) {
        showToast('Ogiltig årgång', 'error');
        return false;
      }
    } else if (field === 'notes') {
      value = editValue || null;
      if (value && value.length > 140) {
        showToast('Anteckning får max vara 140 tecken', 'error');
        return false;
      }
    } else if (field === 'status') {
      value = editValue;
    }

    // Check if value actually changed
    if (value === originalValue) {
      if (navigateAfter) {
        navigateToNextCell(navigateAfter.wineId, navigateAfter.field, navigateAfter.reverse);
      } else {
        cancelEdit();
      }
      return true;
    }

    // Per-cell snapshot for rollback (avoids concurrency issues with rapid edits)
    const saveKey = `${wineId}:${field}`;
    const currentWine = wines.find(w => w.id === wineId);
    const oldValue = currentWine ? (currentWine as any)[field] : null;

    // Track this in-flight save
    setInFlightSaves(prev => new Map(prev).set(saveKey, { field, oldValue }));

    // Apply optimistic update
    setWines(prev => prev.map(w => {
      if (w.id !== wineId) return w;
      return { ...w, [field]: value, updated_at: new Date().toISOString() };
    }));

    setSaving(wineId);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const { wine } = await response.json();
        // Update with server response (authoritative) - this is the canonical state
        setWines(prev => prev.map(w => w.id === wineId ? { ...w, ...wine } : w));

        // Clear in-flight tracker
        setInFlightSaves(prev => {
          const next = new Map(prev);
          next.delete(saveKey);
          return next;
        });

        // Navigate to next cell if requested
        if (navigateAfter) {
          navigateToNextCell(navigateAfter.wineId, navigateAfter.field, navigateAfter.reverse);
        } else {
          setEditingCell(null);
          setEditValue('');
          setOriginalValue(null);
        }
        showToast('Sparat', 'success');
        return true;
      } else {
        // Rollback only this specific field (not whole array)
        setWines(prev => prev.map(w => {
          if (w.id !== wineId) return w;
          return { ...w, [field]: oldValue };
        }));

        // Clear in-flight tracker
        setInFlightSaves(prev => {
          const next = new Map(prev);
          next.delete(saveKey);
          return next;
        });

        const error = await response.json();
        showToast(error.error || 'Kunde inte spara', 'error');
        return false;
      }
    } catch (error) {
      // Rollback only this specific field
      setWines(prev => prev.map(w => {
        if (w.id !== wineId) return w;
        return { ...w, [field]: oldValue };
      }));

      // Clear in-flight tracker
      setInFlightSaves(prev => {
        const next = new Map(prev);
        next.delete(saveKey);
        return next;
      });

      showToast('Ändringar kunde inte sparas - kontrollera nätverket', 'error');
      return false;
    } finally {
      setSaving(null);
    }
  };

  // Handle blur - save if changed
  const handleBlur = () => {
    if (editingCell && editValue !== String(originalValue ?? '')) {
      saveEdit();
    } else {
      cancelEdit();
    }
  };

  const updateStatus = async (wineId: string, newStatus: string) => {
    if (!supplierId) return;

    // Per-cell snapshot for rollback
    const currentWine = wines.find(w => w.id === wineId);
    const oldStatus = currentWine?.status;

    // Optimistic update
    setWines(prev => prev.map(w =>
      w.id === wineId ? { ...w, status: newStatus as any, updated_at: new Date().toISOString() } : w
    ));

    setSaving(wineId);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const { wine } = await response.json();
        // Use server response as canonical state
        setWines(prev => prev.map(w => w.id === wineId ? { ...w, ...wine } : w));
        showToast('Status uppdaterad', 'success');
      } else {
        // Rollback only this field
        setWines(prev => prev.map(w =>
          w.id === wineId ? { ...w, status: oldStatus as any } : w
        ));
        showToast('Kunde inte uppdatera status', 'error');
      }
    } catch (error) {
      // Rollback only this field
      setWines(prev => prev.map(w =>
        w.id === wineId ? { ...w, status: oldStatus as any } : w
      ));
      showToast('Ett fel uppstod', 'error');
    } finally {
      setSaving(null);
    }
  };

  // Bulk update handler
  const bulkUpdateStatus = async (newStatus: string) => {
    if (!supplierId || selectedWines.size === 0) return;

    // Optimistic update
    const previousWines = [...wines];
    setWines(prev => prev.map(w =>
      selectedWines.has(w.id) ? { ...w, status: newStatus as any, updated_at: new Date().toISOString() } : w
    ));

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
        setSelectedWines(new Set());
        showToast(`${updated_count} viner uppdaterade`, 'success');
      } else {
        setWines(previousWines);
        const error = await response.json();
        showToast(error.error || 'Bulk-uppdatering misslyckades', 'error');
      }
    } catch (error) {
      setWines(previousWines);
      showToast('Ett fel uppstod', 'error');
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

  // Delete wine
  const deleteWine = async (wine: SupplierWine) => {
    if (!supplierId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/wines/${wine.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWines(prev => prev.filter(w => w.id !== wine.id));
        showToast(`"${wine.name}" raderades`, 'success');
        setDeleteConfirm(null);
      } else {
        const error = await response.json();
        showToast(error.error || 'Kunde inte radera vinet', 'error');
      }
    } catch (error) {
      showToast('Ett fel uppstod', 'error');
    } finally {
      setDeleting(false);
    }
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
    setImportProgress({ current: 0, total: preview.valid.length });

    try {
      // Simulate progress for better UX (actual import is one API call)
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (!prev) return null;
          const next = Math.min(prev.current + Math.ceil(prev.total / 10), prev.total - 1);
          return { ...prev, current: next };
        });
      }, 200);

      const response = await fetch(`/api/suppliers/${supplierId}/wines/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wines: preview.valid }),
      });

      clearInterval(progressInterval);
      setImportProgress({ current: preview.valid.length, total: preview.valid.length });

      if (response.ok) {
        const data = await response.json();
        const summary = data.summary || { imported: data.imported || 0, updated: 0, errors: 0 };

        // Show detailed result
        setImportResult({
          success: true,
          message: summary.imported > 0 && summary.updated > 0
            ? `${summary.imported} nya viner importerade, ${summary.updated} uppdaterade`
            : summary.imported > 0
            ? `${summary.imported} viner importerade`
            : `${summary.updated} viner uppdaterade`,
          details: {
            imported: summary.imported,
            updated: summary.updated,
            errors: summary.errors || 0,
          },
        });

        // Delay closing modal to show result
        setTimeout(() => {
          setPreview(null);
          setShowUpload(false);
          setImportProgress(null);
          fetchSupplierAndWines();
        }, 1500);
      } else {
        const error = await response.json();
        setImportResult({ success: false, message: error.error || 'Import misslyckades' });
        setImportProgress(null);
      }
    } catch (error) {
      setImportResult({ success: false, message: 'Ett fel uppstod vid import' });
      setImportProgress(null);
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
          {supplierId && (
            <a
              href={`/api/suppliers/${supplierId}/wines/template?format=xlsx`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Mall
            </a>
          )}
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
                <SortableHeader label="Pris (ex moms)" field="price_ex_vat_sek" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                <th className="p-4 font-medium text-gray-600 text-sm text-right">Årgång</th>
                <SortableHeader label="Status" field="status" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                <th className="p-4 font-medium text-gray-600 text-sm">Anteckning</th>
                <SortableHeader label="I offerter" field="offer_count" currentField={sortField} direction={sortDirection} onSort={handleSort} align="right" />
                <th className="p-4 font-medium text-gray-600 text-sm w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedWines.map((wine) => {
                const isEndOfVintage = wine.status === 'END_OF_VINTAGE';
                return (
                <tr
                  key={wine.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 group ${isEndOfVintage ? 'opacity-60' : ''}`}
                >
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
                    </div>
                    <div className="text-sm text-gray-500">{wine.producer} &middot; {wine.region}, {wine.country}</div>
                    {wine.updated_at && formatTimeAgo(wine.updated_at) && (
                      <div className="text-xs text-gray-400 mt-0.5">Uppdaterad {formatTimeAgo(wine.updated_at)}</div>
                    )}
                  </td>

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
                          onBlur={handleBlur}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#7B1E1E]"
                          autoFocus
                        />
                        {saving === wine.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
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

                  {/* Editable Vintage */}
                  <td className="p-4 text-right">
                    {editingCell?.wineId === wine.id && editingCell?.field === 'vintage' ? (
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
                              saveEdit({ wineId: wine.id, field: 'vintage', reverse: e.shiftKey });
                            }
                          }}
                          onBlur={handleBlur}
                          placeholder="NV"
                          className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#7B1E1E]"
                          autoFocus
                        />
                        {saving === wine.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(wine.id, 'vintage', wine.vintage ?? '')}
                        className="cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded text-gray-600"
                        title="Klicka för att redigera"
                      >
                        {wine.vintage || 'NV'}
                      </span>
                    )}
                  </td>

                  {/* Status Badge + Dropdown */}
                  <td className="p-4">
                    {saving === wine.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <div className="flex items-center gap-2">
                        {getStatusBadge(wine.status)}
                        <select
                          value={wine.status}
                          onChange={(e) => updateStatus(wine.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white cursor-pointer focus:ring-1 focus:ring-[#7B1E1E] focus:border-[#7B1E1E]"
                        >
                          {STATUS_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>

                  {/* Editable Notes */}
                  <td className="p-4">
                    {editingCell?.wineId === wine.id && editingCell?.field === 'notes' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              saveEdit({ wineId: wine.id, field: 'notes', reverse: e.shiftKey });
                            }
                          }}
                          onBlur={handleBlur}
                          maxLength={140}
                          placeholder="Anteckning (max 140 tecken)"
                          className="w-48 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#7B1E1E]"
                          autoFocus
                        />
                        <span className="text-xs text-gray-400">{editValue.length}/140</span>
                        {saving === wine.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(wine.id, 'notes', wine.notes ?? '')}
                        className="cursor-pointer hover:bg-yellow-50 px-2 py-1 rounded text-gray-600 text-sm truncate max-w-[200px] inline-block"
                        title={wine.notes || 'Klicka för att lägga till anteckning'}
                      >
                        {wine.notes || <span className="text-gray-300 italic">Lägg till...</span>}
                      </span>
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

                  {/* Delete Button */}
                  <td className="p-4">
                    <button
                      onClick={() => setDeleteConfirm(wine)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Radera vin"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
              })}
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
                    {supplierId && (
                      <a href={`/api/suppliers/${supplierId}/wines/template?format=xlsx`} className="text-sm text-[#7B1E1E] hover:underline mt-2 inline-block">Ladda ner mall &rarr;</a>
                    )}
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

                  {/* Progress Bar */}
                  {importProgress && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Importerar viner...</span>
                        <span className="font-medium text-gray-900">
                          {importProgress.current} / {importProgress.total}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#7B1E1E] transition-all duration-200"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Import Result in Modal */}
                  {importResult && importing === false && importProgress?.current === importProgress?.total && (
                    <div className={`mb-4 p-4 rounded-lg ${
                      importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {importResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className={`font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {importResult.message}
                        </span>
                      </div>
                      {importResult.details && (
                        <div className="mt-2 flex gap-4 text-sm">
                          {importResult.details.imported > 0 && (
                            <span className="text-green-700">
                              <Plus className="h-3 w-3 inline mr-1" />
                              {importResult.details.imported} nya
                            </span>
                          )}
                          {importResult.details.updated > 0 && (
                            <span className="text-blue-700">
                              ↻ {importResult.details.updated} uppdaterade
                            </span>
                          )}
                          {importResult.details.errors > 0 && (
                            <span className="text-red-700">
                              ✕ {importResult.details.errors} fel
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setPreview(null)}
                      disabled={importing}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Välj annan fil
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || preview.valid.length === 0}
                      className="px-4 py-2 bg-[#7B1E1E] text-white rounded-lg text-sm font-medium hover:bg-[#6B1818] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importerar...
                        </>
                      ) : (
                        `Importera ${preview.valid.length} viner`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Radera vin?</h2>
                  <p className="text-sm text-gray-500">Detta går inte att ångra</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="font-medium text-gray-900">{deleteConfirm.name}</p>
                <p className="text-sm text-gray-500">
                  {deleteConfirm.producer} &middot; {deleteConfirm.vintage || 'NV'}
                </p>
                {deleteConfirm.offer_count && deleteConfirm.offer_count > 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    ⚠️ Används i {deleteConfirm.offer_count} {deleteConfirm.offer_count === 1 ? 'offert' : 'offerter'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => deleteWine(deleteConfirm)}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Raderar...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Radera
                    </>
                  )}
                </button>
              </div>
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
