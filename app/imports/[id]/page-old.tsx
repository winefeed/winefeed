'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusTimeline } from '../components/StatusTimeline';
import { DocumentList } from '../components/DocumentList';
import { ActionsPanel } from '../components/ActionsPanel';
import { SupplierImportWidget } from '../components/SupplierImportWidget';

interface ImportCaseData {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  importer_id: string;
  delivery_location_id: string;
  supplier_id: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  restaurant?: {
    id: string;
    name: string;
    contact_email: string;
    contact_phone: string;
  };
  importer?: {
    id: string;
    legal_name: string;
    org_number: string;
    contact_email: string;
  };
  delivery_location?: {
    id: string;
    delivery_address_line1: string;
    postal_code: string;
    city: string;
    status: string;
  };
  supplier?: {
    id: string;
    namn: string;
    kontakt_email: string;
  };
  status_events?: Array<{
    id: string;
    from_status: string;
    to_status: string;
    note: string | null;
    changed_by_user_id: string;
    created_at: string;
  }>;
}

interface Document {
  id: string;
  type: string;
  version: number;
  storage_path: string;
  sha256: string;
  created_at: string;
}

interface SupplierImport {
  id: string;
  tenant_id: string;
  import_id: string;
  created_at: string;
}

export default function ImportDetailsPage({ params }: { params: { id: string } }) {
  const { id: importId } = params;
  const router = useRouter();

  const [importCase, setImportCase] = useState<ImportCaseData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [supplierImports, setSupplierImports] = useState<SupplierImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch import case details
      const importResponse = await fetch(`/api/imports/${importId}`, {
        headers: {
          'x-tenant-id': '00000000-0000-0000-0000-000000000001'
        }
      });

      if (!importResponse.ok) {
        throw new Error('Failed to fetch import case');
      }

      const importData = await importResponse.json();
      setImportCase(importData);

      // Fetch documents
      const docsResponse = await fetch(`/api/imports/${importId}/documents`, {
        headers: {
          'x-tenant-id': '00000000-0000-0000-0000-000000000001'
        }
      });

      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setDocuments(docsData.documents || []);
      }

      // Fetch supplier imports
      const supplierImportsResponse = await fetch(`/api/imports/${importId}/supplier-imports`, {
        headers: {
          'x-tenant-id': '00000000-0000-0000-0000-000000000001'
        }
      });

      if (supplierImportsResponse.ok) {
        const supplierImportsData = await supplierImportsResponse.json();
        setSupplierImports(supplierImportsData.supplier_imports || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [importId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Laddar import case...</p>
        </div>
      </div>
    );
  }

  if (error || !importCase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">Fel</h2>
          <p className="text-muted-foreground mb-4">{error || 'Import case hittades inte'}</p>
          <Button onClick={() => router.push('/imports/new')}>
            Skapa nytt import case
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📦</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Import Case</h1>
                <p className="text-sm text-primary-foreground/80 font-mono">{importId}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => router.push('/imports/new')}
            >
              + Skapa ny
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">Grundläggande information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Restaurang</p>
                  <p className="font-medium">{importCase.restaurant?.name || 'Ej angiven'}</p>
                  {importCase.restaurant?.contact_email && (
                    <p className="text-sm text-muted-foreground">{importCase.restaurant.contact_email}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Importör</p>
                  <p className="font-medium">{importCase.importer?.legal_name || 'Ej angiven'}</p>
                  {importCase.importer?.org_number && (
                    <p className="text-sm text-muted-foreground">{importCase.importer.org_number}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Leveransplats</p>
                  <p className="font-medium">
                    {importCase.delivery_location?.delivery_address_line1 || 'Ej angiven'}
                  </p>
                  {importCase.delivery_location && (
                    <p className="text-sm text-muted-foreground">
                      {importCase.delivery_location.postal_code} {importCase.delivery_location.city}
                    </p>
                  )}
                  {importCase.delivery_location?.status && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: <span className="font-medium">{importCase.delivery_location.status}</span>
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Leverantör</p>
                  <p className="font-medium">{importCase.supplier?.namn || 'Ej angiven'}</p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">Status & Historik</h2>
              <StatusTimeline
                events={importCase.status_events || []}
                currentStatus={importCase.status}
              />
            </div>

            {/* Documents */}
            <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">Dokument</h2>
              <DocumentList documents={documents} importId={importId} />
            </div>

            {/* Supplier Imports */}
            <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold mb-4">Supplier Imports</h2>
              <SupplierImportWidget
                importId={importId}
                linkedImports={supplierImports}
                onRefresh={fetchData}
              />
            </div>
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Åtgärder</h2>
              <ActionsPanel
                importId={importId}
                currentStatus={importCase.status}
                onRefresh={fetchData}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
