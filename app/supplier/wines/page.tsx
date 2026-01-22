'use client';

/**
 * SUPPLIER WINES PAGE
 *
 * Manage wine catalog - list, upload, edit wines
 */

import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Wine,
  Upload,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
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
  is_active: boolean;
  created_at?: string;
}

type SortField = 'name' | 'producer' | 'region' | 'color' | 'price_ex_vat_sek' | 'stock_qty' | 'created_at';
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

  useEffect(() => {
    fetchSupplierAndWines();
  }, []);

  async function fetchSupplierAndWines() {
    try {
      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Fetch wines
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
        setImportResult({
          success: true,
          message: `${data.imported} viner importerade!`,
        });
        setPreview(null);
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
    .filter((wine) =>
      wine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wine.producer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wine.region?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'producer':
          aValue = a.producer.toLowerCase();
          bValue = b.producer.toLowerCase();
          break;
        case 'region':
          aValue = (a.region || '').toLowerCase();
          bValue = (b.region || '').toLowerCase();
          break;
        case 'color':
          aValue = a.color || '';
          bValue = b.color || '';
          break;
        case 'price_ex_vat_sek':
          aValue = a.price_ex_vat_sek;
          bValue = b.price_ex_vat_sek;
          break;
        case 'stock_qty':
          aValue = a.stock_qty;
          bValue = b.stock_qty;
          break;
        case 'created_at':
          aValue = a.created_at || '';
          bValue = b.created_at || '';
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const colorLabels: Record<string, string> = {
    red: 'Rött',
    white: 'Vitt',
    rose: 'Rosé',
    sparkling: 'Mousserande',
    fortified: 'Starkvin',
    orange: 'Orange',
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Importera viner
          </button>
        </div>
      </div>

      {/* Import Result Toast */}
      {importResult && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            importResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {importResult.success ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className={importResult.success ? 'text-green-800' : 'text-red-800'}>
            {importResult.message}
          </span>
          <button
            onClick={() => setImportResult(null)}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Importera viner</h2>
              <button
                onClick={() => {
                  setShowUpload(false);
                  setPreview(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {!preview ? (
                <>
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      {isDragActive
                        ? 'Släpp filen här...'
                        : 'Dra och släpp en Excel- eller CSV-fil här'}
                    </p>
                    <p className="text-sm text-gray-400">
                      eller klicka för att välja fil
                    </p>
                  </div>

                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Kolumner som krävs:</h3>
                    <p className="text-sm text-gray-600">
                      wine_name, producer, vintage, region, country, grape, color, price, moq
                    </p>
                    <a
                      href="/api/admin/wines/template?format=xlsx"
                      className="text-sm text-primary hover:underline mt-2 inline-block"
                    >
                      Ladda ner mall →
                    </a>
                  </div>
                </>
              ) : (
                <>
                  {/* Preview */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Fil: <strong>{preview.filename}</strong>
                    </p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">{preview.valid.length} giltiga</span>
                      </div>
                      {preview.invalid.length > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">{preview.invalid.length} ogiltiga</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Valid wines preview */}
                  {preview.valid.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">Förhandsvisning:</h3>
                      <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left p-2 font-medium text-gray-600">Vin</th>
                              <th className="text-left p-2 font-medium text-gray-600">Producent</th>
                              <th className="text-left p-2 font-medium text-gray-600">År</th>
                              <th className="text-right p-2 font-medium text-gray-600">Pris</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.valid.slice(0, 5).map((wine, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{wine.wine_name}</td>
                                <td className="p-2">{wine.producer}</td>
                                <td className="p-2">{wine.vintage}</td>
                                <td className="p-2 text-right">{wine.price} kr</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {preview.valid.length > 5 && (
                          <p className="text-sm text-gray-500 p-2 text-center bg-gray-50">
                            ... och {preview.valid.length - 5} till
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Invalid rows */}
                  {preview.invalid.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h3 className="font-medium text-red-800 mb-2">Ogiltiga rader:</h3>
                      <ul className="text-sm text-red-700 space-y-1">
                        {preview.invalid.slice(0, 3).map((item, i) => (
                          <li key={i}>
                            Rad {item.row}: {item.errors.join(', ')}
                          </li>
                        ))}
                        {preview.invalid.length > 3 && (
                          <li>... och {preview.invalid.length - 3} till</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setPreview(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Välj annan fil
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || preview.valid.length === 0}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importing ? 'Importerar...' : `Importera ${preview.valid.length} viner`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök viner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Wine List */}
      {filteredAndSortedWines.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader
                  label="Vin"
                  field="name"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Producent"
                  field="producer"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Region"
                  field="region"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Färg"
                  field="color"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Pris"
                  field="price_ex_vat_sek"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Lager"
                  field="stock_qty"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <th className="text-center p-4 font-medium text-gray-600 text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedWines.map((wine) => (
                <tr key={wine.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-medium text-gray-900">
                      {wine.name}
                      {wine.vintage && wine.vintage !== 'NV' && (
                        <span className="text-gray-500 ml-1">{wine.vintage}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{wine.grape}</div>
                  </td>
                  <td className="p-4 text-gray-600">{wine.producer}</td>
                  <td className="p-4 text-gray-600">
                    {wine.region}, {wine.country}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600">
                      {colorLabels[wine.color] || wine.color}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium text-gray-900">
                    {(wine.price_ex_vat_sek / 100).toLocaleString('sv-SE')} kr
                  </td>
                  <td className="p-4 text-right text-gray-600">{wine.stock_qty}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        wine.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {wine.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
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
            {searchTerm ? 'Inga viner hittades' : 'Din katalog är tom'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm
              ? 'Prova med en annan sökning'
              : 'Ladda upp dina viner för att komma igång'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Importera viner
            </button>
          )}
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
    <th
      className={`p-4 font-medium text-gray-600 text-sm cursor-pointer hover:bg-gray-100 transition-colors select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => onSort(field)}
    >
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <span>{label}</span>
        <span className="text-gray-400">
          {isActive ? (
            direction === 'asc' ? (
              <ChevronUp className="h-4 w-4 text-primary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-primary" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3" />
          )}
        </span>
      </div>
    </th>
  );
}
