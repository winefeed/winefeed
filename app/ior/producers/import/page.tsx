/**
 * IOR CATALOG IMPORT
 *
 * Drag-drop JSON import with preview and confirmation.
 * Supports Combi export format.
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileJson,
  CheckCircle,
  AlertTriangle,
  Wine,
  Building2,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CombiProduct {
  wineName?: { value: string };
  productName?: { value: string };
  producer?: { value: string };
  vintage?: { value: string };
  color?: { value: string };
  type?: { value: string };
  grape?: { value: string };
  grapes?: { value: string };
  Appellation?: { value: string };
  appellation?: { value: string };
  description?: { value: string };
  bottleSizeMl?: { value: string };
  Volume?: { value: string };
  volume?: { value: string };
  price?: { value: string };
  country?: { value: string };
  region?: { value: string };
  [key: string]: { value: string } | undefined;
}

interface CombiDataset {
  id: string;
  name: string;
  data: CombiProduct[];
}

interface ProducerPreview {
  name: string;
  productCount: number;
  products: Array<{
    name: string;
    vintage: string;
    type: string;
  }>;
}

interface ImportResult {
  success: boolean;
  results: {
    producersCreated: number;
    producersExisting: number;
    productsCreated: number;
    productsSkipped: number;
    skipReasons?: { noName?: number; duplicate?: number; dbError?: number };
    errors: string[];
  };
  summary: string;
}

export default function ImportCatalogPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<CombiDataset | null>(null);
  const [preview, setPreview] = useState<ProducerPreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setParseError(null);
    setDataset(null);
    setPreview([]);
    setResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as CombiDataset;

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Ogiltig fil: Förväntade { data: [...] }');
      }

      setDataset(data);

      // Build preview grouped by producer
      const byProducer = new Map<string, CombiProduct[]>();
      for (const item of data.data) {
        const producerName = item.producer?.value || 'Okänd producent';
        if (!byProducer.has(producerName)) {
          byProducer.set(producerName, []);
        }
        byProducer.get(producerName)!.push(item);
      }

      const previewData: ProducerPreview[] = [];
      for (const [name, products] of byProducer) {
        previewData.push({
          name,
          productCount: products.length,
          products: products.slice(0, 5).map(p => ({
            name: p.wineName?.value || p.productName?.value || 'Okänd',
            vintage: p.vintage?.value || 'NV',
            type: p.color?.value || p.type?.value || '-',
          })),
        });
      }

      // Sort by product count descending
      previewData.sort((a, b) => b.productCount - a.productCount);
      setPreview(previewData);

    } catch (err) {
      console.error('Parse error:', err);
      setParseError(err instanceof Error ? err.message : 'Kunde inte läsa filen');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'application/json' || droppedFile.name.endsWith('.json'))) {
      setFile(droppedFile);
      parseFile(droppedFile);
    } else {
      setParseError('Endast JSON-filer stöds (.json)');
    }
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }, [parseFile]);

  const handleImport = async () => {
    if (!dataset) return;

    setImporting(true);
    setParseError(null);

    try {
      const response = await fetch('/api/ior/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataset),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import misslyckades');
      }

      setResult(data as ImportResult);
    } catch (err) {
      console.error('Import error:', err);
      setParseError(err instanceof Error ? err.message : 'Import misslyckades');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setDataset(null);
    setPreview([]);
    setParseError(null);
    setResult(null);
  };

  const totalProducts = preview.reduce((sum, p) => sum + p.productCount, 0);

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/ior/producers"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-wine transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till producenter
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-wine/10 rounded-xl">
          <Upload className="h-6 w-6 text-wine" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importera katalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ladda upp en JSON-fil från Combi för att importera producenter och produkter
          </p>
        </div>
      </div>

      {/* Success result */}
      {result?.success && (
        <div className="mb-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-2 border-emerald-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-200 rounded-full">
              <CheckCircle className="h-6 w-6 text-emerald-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-900 text-lg">Import klar!</h3>
              <p className="text-emerald-700 mt-1">{result.summary}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-2xl font-bold text-emerald-700">{result.results.producersCreated}</p>
                  <p className="text-sm text-emerald-600">Nya producenter</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-2xl font-bold text-emerald-700">{result.results.producersExisting}</p>
                  <p className="text-sm text-emerald-600">Befintliga</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-2xl font-bold text-emerald-700">{result.results.productsCreated}</p>
                  <p className="text-sm text-emerald-600">Produkter skapade</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-500">{result.results.productsSkipped}</p>
                  <p className="text-sm text-gray-500">Hoppade över</p>
                </div>
              </div>

              {result.results.productsSkipped > 0 && result.results.skipReasons && (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Hoppade över:</p>
                  <ul className="text-sm text-gray-600 mt-1 space-y-0.5">
                    {(result.results.skipReasons.duplicate ?? 0) > 0 && (
                      <li>• {result.results.skipReasons.duplicate} redan importerade (duplikat)</li>
                    )}
                    {(result.results.skipReasons.noName ?? 0) > 0 && (
                      <li>• {result.results.skipReasons.noName} saknar produktnamn</li>
                    )}
                    {(result.results.skipReasons.dbError ?? 0) > 0 && (
                      <li>• {result.results.skipReasons.dbError} misslyckades (databasfel)</li>
                    )}
                  </ul>
                </div>
              )}

              {result.results.errors.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">
                    {result.results.errors.length} varningar:
                  </p>
                  <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                    {result.results.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Link
                  href="/ior/producers"
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Visa producenter
                </Link>
                <button
                  onClick={reset}
                  className="px-5 py-2.5 border-2 border-emerald-300 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-colors"
                >
                  Importera fler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone (show if no result) */}
      {!result && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-all',
            dragActive
              ? 'border-wine bg-wine/5'
              : 'border-gray-300 hover:border-gray-400',
            dataset && 'border-emerald-300 bg-emerald-50/50'
          )}
        >
          {!dataset ? (
            <>
              <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                <FileJson className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium mb-2">
                Dra och släpp en JSON-fil här
              </p>
              <p className="text-gray-500 text-sm mb-4">
                eller
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-wine text-white rounded-lg font-medium hover:bg-wine/90 transition-colors cursor-pointer">
                <Upload className="h-4 w-4" />
                Välj fil
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <FileJson className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file?.name}</p>
                  <p className="text-sm text-gray-500">
                    {dataset.name || 'Combi export'}
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {parseError && (
        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Fel</p>
            <p className="text-red-600 text-sm">{parseError}</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && !result && (
        <div className="mt-6">
          {/* Summary */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Förhandsvisning</h2>
              <p className="text-sm text-gray-500">
                {totalProducts} produkter från {preview.length} producenter
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
                importing
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-wine text-white hover:bg-wine/90 shadow-sm hover:shadow'
              )}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importerar...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importera {totalProducts} produkter
                </>
              )}
            </button>
          </div>

          {/* Producer cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {preview.map((producer) => (
              <div
                key={producer.name}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-wine/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-wine/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-wine" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {producer.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {producer.productCount} produkter
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {producer.products.map((product, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <Wine className="h-3.5 w-3.5 text-gray-400" />
                      <span className="truncate flex-1">{product.name}</span>
                      {product.vintage !== 'NV' && (
                        <span className="text-wine font-medium">{product.vintage}</span>
                      )}
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                        {product.type}
                      </span>
                    </div>
                  ))}
                  {producer.productCount > 5 && (
                    <p className="text-xs text-gray-400 pl-5">
                      +{producer.productCount - 5} till (alla importeras)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
