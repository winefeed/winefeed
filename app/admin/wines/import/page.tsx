'use client';

/**
 * Admin Wine Import Page
 *
 * Upload Excel/CSV files to import wine catalogs for suppliers.
 * Includes preview, validation, and error reporting.
 */

import { useState, useCallback, useEffect } from 'react';
import { getErrorMessage } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';

// ============================================================================
// Types
// ============================================================================

interface Supplier {
  id: string;
  name: string;
  type: string;
}

interface WinePreviewRow {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: Record<string, unknown>;
  raw: Record<string, unknown>;
}

interface ImportPreview {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  validRows: WinePreviewRow[];
  invalidRows: WinePreviewRow[];
}

interface PreviewResponse {
  success: boolean;
  preview?: ImportPreview;
  supplierName?: string;
  headerMapping?: Record<string, string>;
  warnings?: string[];
  error?: string;
}

interface ImportResponse {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ============================================================================
// Component
// ============================================================================

export default function WineImportPage() {
  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [supplierName, setSupplierName] = useState<string>('');

  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const [showInvalidRows, setShowInvalidRows] = useState(false);

  // Load suppliers on mount
  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoadingSuppliers(true);
    try {
      const response = await fetch('/api/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  // File drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setPreview(null);
      setImportResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10 MB
  });

  // Preview handler
  const handlePreview = async () => {
    if (!file || !selectedSupplierId) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('supplierId', selectedSupplierId);

    try {
      const response = await fetch('/api/admin/wines/preview', {
        method: 'POST',
        body: formData,
      });

      const data: PreviewResponse = await response.json();

      if (data.success && data.preview) {
        setPreview(data.preview);
        setWarnings(data.warnings || []);
        setSupplierName(data.supplierName || '');
      } else {
        setError(data.error || 'Kunde inte läsa filen');
      }
    } catch (err) {
      setError(`Fel vid uppladdning: ${getErrorMessage(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Import handler
  const handleImport = async () => {
    if (!preview || !selectedSupplierId) return;

    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/wines/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          wines: preview.validRows.map(r => r.data),
          filename: file?.name,
        }),
      });

      const data: ImportResponse = await response.json();
      setImportResult(data);

      if (data.success) {
        // Clear form on success
        setFile(null);
        setPreview(null);
      }
    } catch (err) {
      setError(`Fel vid import: ${getErrorMessage(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Reset handler
  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setWarnings([]);
    setError(null);
    setImportResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Importera vinkatalog</h1>
          <p className="mt-2 text-gray-600">
            Ladda upp en Excel- eller CSV-fil med vindata för att importera till en leverantörs katalog.
          </p>
        </div>

        {/* Success message */}
        {importResult?.success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-medium text-green-800">Import slutförd!</p>
                <p className="text-sm text-green-700">
                  {importResult.imported} nya viner importerade, {importResult.updated} uppdaterade
                  {importResult.skipped > 0 && `, ${importResult.skipped} hoppades över`}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="mt-3 text-sm font-medium text-green-700 hover:text-green-800"
            >
              Importera fler viner →
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Main form */}
        {!importResult?.success && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            {/* Step 1: Select supplier */}
            <div className="mb-6">
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
                1. Välj leverantör
              </label>
              <select
                id="supplier"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                disabled={isUploading || isImporting}
              >
                <option value="">Välj leverantör...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Upload file */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700">
                2. Ladda upp fil
              </label>
              <div
                {...getRootProps()}
                className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="text-center">
                    <svg
                      className="mx-auto h-10 w-10 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mt-2 font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                      }}
                      className="mt-2 text-sm text-red-600 hover:text-red-700"
                    >
                      Ta bort fil
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg
                      className="mx-auto h-10 w-10 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mt-2 text-gray-600">
                      {isDragActive
                        ? 'Släpp filen här...'
                        : 'Dra och släpp en fil här, eller klicka för att välja'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Excel (.xlsx, .xls) eller CSV. Max 10 MB.
                    </p>
                  </div>
                )}
              </div>

              {/* Template download */}
              <div className="mt-3 flex gap-4">
                <a
                  href="/api/admin/wines/template?format=xlsx"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Ladda ner Excel-mall
                </a>
                <a
                  href="/api/admin/wines/template?format=csv"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Ladda ner CSV-mall
                </a>
              </div>
            </div>

            {/* Preview button */}
            {!preview && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || !selectedSupplierId || isUploading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Läser fil...
                  </span>
                ) : (
                  'Förhandsgranska'
                )}
              </button>
            )}

            {/* Preview results */}
            {preview && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="font-medium text-gray-900">Förhandsgranskning</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Leverantör: <span className="font-medium">{supplierName}</span>
                </p>

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-800">Varningar:</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-amber-700">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Stats */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-white p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{preview.totalRows}</p>
                    <p className="text-sm text-gray-500">Totalt</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{preview.validCount}</p>
                    <p className="text-sm text-green-700">Giltiga</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{preview.invalidCount}</p>
                    <p className="text-sm text-red-700">Ogiltiga</p>
                  </div>
                </div>

                {/* Invalid rows details */}
                {preview.invalidCount > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowInvalidRows(!showInvalidRows)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      {showInvalidRows ? 'Dölj' : 'Visa'} ogiltiga rader ({preview.invalidCount})
                    </button>

                    {showInvalidRows && (
                      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-red-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-red-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-red-800">Rad</th>
                              <th className="px-3 py-2 text-left font-medium text-red-800">Data</th>
                              <th className="px-3 py-2 text-left font-medium text-red-800">Problem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {preview.invalidRows.map((row) => (
                              <tr key={row.rowNumber}>
                                <td className="px-3 py-2 text-gray-600">{row.rowNumber}</td>
                                <td className="px-3 py-2 text-gray-900">
                                  {String(row.raw.wine_name || row.raw.name || '(okänd)')}
                                </td>
                                <td className="px-3 py-2 text-red-600">
                                  {row.errors.join(', ')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Import buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={preview.validCount === 0 || isImporting}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isImporting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Importerar...
                      </span>
                    ) : (
                      `Importera ${preview.validCount} viner`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
