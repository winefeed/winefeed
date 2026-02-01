'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusTimeline } from '../components/StatusTimeline';
import { DocumentList } from '../components/DocumentList';
import { SupplierImportWidget } from '../components/SupplierImportWidget';
import { Tooltip, InfoIcon } from '../components/Tooltip';
import { Accordion } from '../components/Accordion';
import { StatusBadge } from '../components/StatusBadge';
import { WineCheckPanel } from '@/app/components/wine-check';
import {
  ComplianceCard,
  checkImportCaseCompliance,
  getImportCaseSteps,
  type ComplianceStatus,
} from '@/components/compliance';
import { getErrorMessage } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

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
    org_number?: string;
    contact_email: string;
    contact_phone: string;
  };
  importer?: {
    id: string;
    legal_name: string;
    org_number: string;
    contact_name?: string;
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
  created_by?: string;
}

/**
 * Import Case Compliance Card
 * Shows overall compliance status for the import case
 */
function ImportCaseComplianceCard({
  importCase,
  hasDocuments,
}: {
  importCase: ImportCaseData;
  hasDocuments: boolean;
}) {
  // Compute compliance status
  const complianceResult = checkImportCaseCompliance({
    status: importCase.status,
    ddl_status: importCase.delivery_location?.status,
    has_document: hasDocuments,
    has_shipment: !!importCase.delivery_location,
  });

  // Get progress steps
  const steps = getImportCaseSteps({
    status: importCase.status,
    has_identifiers: true, // Assume identifiers exist if import case was created
    has_shipment: !!importCase.delivery_location,
    has_required_fields: true, // Assume fields are complete for import case level
    has_document: hasDocuments,
  });

  return (
    <div className="mb-6">
      <ComplianceCard
        title="Import Case Compliance"
        status={complianceResult.status}
        missingFields={complianceResult.missingFields}
        blockReason={complianceResult.blockReason}
        steps={steps}
        collapsible={true}
        defaultExpanded={complianceResult.status !== 'OK'}
      />
    </div>
  );
}

export default function ImportDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { id: importId } = params;
  const router = useRouter();

  const [importCase, setImportCase] = useState<ImportCaseData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch import case details
      const importResponse = await fetch(`/api/imports/${importId}`, {
        headers: {
          
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
          
        }
      });

      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setDocuments(docsData.documents || []);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Ett fel uppstod'));
    } finally {
      setLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laddar import case...</p>
        </div>
      </div>
    );
  }

  if (error || !importCase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Fel vid laddning</h2>
          <p className="text-muted-foreground mb-4">{error || 'Import case hittades inte'}</p>
          <Button onClick={() => router.push('/imports/new')}>
            Skapa nytt ärende
          </Button>
        </div>
      </div>
    );
  }

  const latestDocument = documents.length > 0 ? documents[0] : null;
  const olderDocuments = documents.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h1 className="text-xl font-bold">Import Case</h1>
                {showAdvanced && (
                  <p className="text-xs text-primary-foreground/70 font-mono">{importId}</p>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/imports/new')}
            >
              + Skapa ny
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Compliance Card - Overall Import Case Compliance */}
        <ImportCaseComplianceCard
          importCase={importCase}
          hasDocuments={documents.length > 0}
        />

        {/* Summary Card */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-1 mb-2">
                <p className="text-sm font-medium text-muted-foreground">Restaurang</p>
              </div>
              <p className="font-semibold text-lg">{importCase.restaurant?.name || 'Ej angiven'}</p>
              <p className="text-sm text-muted-foreground">
                {importCase.delivery_location?.delivery_address_line1}
              </p>
              <p className="text-sm text-muted-foreground">
                {importCase.delivery_location?.postal_code} {importCase.delivery_location?.city}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-2">
                <p className="text-sm font-medium text-muted-foreground">Importör</p>
              </div>
              <p className="font-semibold text-lg">{importCase.importer?.legal_name || 'Ej angiven'}</p>
              <p className="text-sm text-muted-foreground">{importCase.importer?.org_number}</p>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-2">
                <p className="text-sm font-medium text-muted-foreground">Leveransplats</p>
                <InfoIcon tooltip="Status för adressen som direkt leveransplats hos Skatteverket." />
              </div>
              <StatusBadge
                status={importCase.delivery_location?.status || 'NOT_REGISTERED'}
                type="delivery_place"
                size="md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {importCase.delivery_location?.status === 'APPROVED'
                  ? 'Adressen är godkänd'
                  : 'Adressen är inte godkänd än'}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-2">
                <p className="text-sm font-medium text-muted-foreground">Ärende (5369_03)</p>
                <InfoIcon tooltip="Status för registreringsärendet hos Skatteverket. Detta är oberoende av om adressen redan är godkänd." />
              </div>
              <StatusBadge
                status={importCase.status}
                type="case"
                size="md"
              />
              {importCase.delivery_location?.status === 'APPROVED' && importCase.status === 'NOT_REGISTERED' && (
                <p className="text-xs text-amber-600 mt-2 flex items-start gap-1">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span>Adressen är redan godkänd, men detta specifika ärende är ej registrerat.</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Översikt (Collapsible) */}
            <Accordion title="Översikt" defaultOpen={false}>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Restaurang namn</p>
                    <p className="font-medium">{importCase.restaurant?.name}</p>
                  </div>
                  {showAdvanced && importCase.restaurant?.org_number && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Restaurang org.nr</p>
                      <p className="font-medium font-mono text-sm">{importCase.restaurant.org_number}</p>
                    </div>
                  )}
                  {showAdvanced && importCase.restaurant?.contact_email && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Restaurang e-post</p>
                      <p className="font-medium text-sm">{importCase.restaurant.contact_email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Importör</p>
                    <p className="font-medium">{importCase.importer?.legal_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Importör org.nr</p>
                    <p className="font-medium font-mono text-sm">{importCase.importer?.org_number}</p>
                  </div>
                  {showAdvanced && importCase.importer?.contact_email && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Importör e-post</p>
                      <p className="font-medium text-sm">{importCase.importer.contact_email}</p>
                    </div>
                  )}
                  {importCase.supplier && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Leverantör</p>
                      <p className="font-medium">{importCase.supplier.namn}</p>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs"
                >
                  {showAdvanced ? '← Dölj detaljer' : 'Visa fler detaljer →'}
                </Button>
              </div>
            </Accordion>

            {/* Documents */}
            <div className="bg-card border border-border rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold">Dokument</h2>
                <InfoIcon tooltip="SKV 5369_03 blanketter som genererats för detta ärende." />
              </div>

              {latestDocument ? (
                <div className="space-y-4">
                  <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="font-semibold text-green-900">Senaste dokument</p>
                          <span className="text-xs font-medium px-2 py-0.5 bg-green-100 text-green-800 rounded">
                            v{latestDocument.version}
                          </span>
                        </div>
                        <p className="text-sm text-green-800 mb-1">SKV 5369_03 - Direkt leveransplats</p>
                        <p className="text-xs text-green-700">
                          Skapad: {new Date(latestDocument.created_at).toLocaleString('sv-SE')}
                        </p>
                        {showAdvanced && (
                          <p className="text-xs text-green-600 font-mono mt-1">
                            Hash: {latestDocument.sha256.substring(0, 16)}...
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const response = await fetch(
                            `/api/imports/${importId}/documents/${latestDocument.id}/download`,
                            {
                              headers: {
                                
                              }
                            }
                          );
                          if (response.ok) {
                            const data = await response.json();
                            window.open(data.url, '_blank');
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Ladda ner
                      </Button>
                    </div>
                  </div>

                  {olderDocuments.length > 0 && (
                    <Accordion title="Historik" badge={olderDocuments.length}>
                      <div className="space-y-2">
                        {olderDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded border border-border">
                            <div>
                              <p className="text-sm font-medium">Version {doc.version}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(doc.created_at).toLocaleString('sv-SE')}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const response = await fetch(
                                  `/api/imports/${importId}/documents/${doc.id}/download`,
                                  {
                                    headers: {
                                      
                                    }
                                  }
                                );
                                if (response.ok) {
                                  const data = await response.json();
                                  window.open(data.url, '_blank');
                                }
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Accordion>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">Inga dokument genererade ännu</p>
                  <p className="text-xs mt-1">Använd &quot;Generera 5369_03&quot; i åtgärdspanelen</p>
                </div>
              )}
            </div>

            {/* Status History - Latest event always visible */}
            {importCase.status_events && importCase.status_events.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Statushistorik</h3>
                    <InfoIcon tooltip="Historik över alla statusändringar för detta ärende" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {importCase.status_events.length} händelse{importCase.status_events.length !== 1 ? 'r' : ''}
                  </span>
                </div>

                {/* Latest Event - Always Visible */}
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Senaste händelse</p>
                  <StatusTimeline
                    events={[importCase.status_events[0]]}
                    currentStatus={importCase.status}
                  />
                </div>

                {/* Older Events - Collapsed */}
                {importCase.status_events.length > 1 && (
                  <Accordion title="Äldre händelser" badge={importCase.status_events.length - 1}>
                    <StatusTimeline
                      events={importCase.status_events.slice(1)}
                      currentStatus={importCase.status}
                    />
                  </Accordion>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Actions & Tools */}
          <div className="space-y-6">
            <ImprovedActionsPanel
              importId={importId}
              currentStatus={importCase.status}
              hasDocuments={documents.length > 0}
              deliveryPlaceStatus={importCase.delivery_location?.status || 'NOT_REGISTERED'}
              ddlStatus={importCase.delivery_location?.status}
              onRefresh={fetchData}
            />

            {/* Data Quality Tools */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">VERKTYG / DATAKVALITET</h3>
                <WineCheckPanel
                  mode="standalone"
                  title="Wine Check"
                  description="Verifiera och normalisera ett vin-namn."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// New Improved Actions Panel Component
interface ImprovedActionsPanelProps {
  importId: string;
  currentStatus: string;
  hasDocuments: boolean;
  deliveryPlaceStatus: string;
  ddlStatus?: string;
  onRefresh: () => void;
}

function ImprovedActionsPanel({
  importId,
  currentStatus,
  hasDocuments,
  deliveryPlaceStatus,
  ddlStatus,
  onRefresh,
}: ImprovedActionsPanelProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error_code?: string;
    error_message?: string;
  } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Check compliance status to block actions if needed
  const complianceResult = checkImportCaseCompliance({
    status: currentStatus,
    ddl_status: ddlStatus,
    has_document: hasDocuments,
  });
  const isBlocked = complianceResult.status === 'BLOCKED';

  const canSubmit = hasDocuments && currentStatus === 'NOT_REGISTERED' && !isBlocked;
  const canApprove = currentStatus === 'SUBMITTED' && !isBlocked;
  const canReject = currentStatus === 'SUBMITTED';
  const canValidate = currentStatus === 'APPROVED' && !isBlocked;

  const handleValidateShipment = async () => {
    setLoading(true);
    setValidationResult(null);

    try {
      const response = await fetch(`/api/imports/${importId}/validate-shipment`, {
        method: 'POST',
        headers: {
          
        }
      });

      const data = await response.json();
      setValidationResult(data);
    } catch (err) {
      setValidationResult({
        valid: false,
        error_code: 'NETWORK_ERROR',
        error_message: getErrorMessage(err)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate5369 = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/imports/${importId}/documents/5369`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
          
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate document');
      }

      onRefresh();
    } catch (err) {
      toast.error('Kunde inte generera dokument', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (toStatus: string, note?: string) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/imports/${importId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
          
        },
        body: JSON.stringify({ to_status: toStatus, why: note || '' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      onRefresh();
    } catch (err) {
      toast.error('Kunde inte uppdatera status', getErrorMessage(err));
    } finally {
      setLoading(false);
      setShowRejectModal(false);
      setRejectNote('');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold">Åtgärder</h2>
        </div>

        {/* Blocked Warning */}
        {isBlocked && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-red-800 text-sm">Åtgärder blockerade</p>
                <p className="text-xs text-red-700 mt-1">{complianceResult.blockReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Primary Actions */}
        <div className="space-y-3 pb-6 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Primära åtgärder</p>

          {/* Validate Shipment */}
          <Tooltip
            content={canValidate
              ? "Kontrollera om alla krav är uppfyllda för att genomföra en leverans under uppskov till denna plats."
              : "Kan inte validera: Ärendet måste vara GODKÄNT av Skatteverket först."
            }
          >
            <Button
              onClick={handleValidateShipment}
              disabled={!canValidate || loading}
              className="w-full"
              variant={canValidate ? "default" : "secondary"}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validera för leverans
            </Button>
          </Tooltip>

          {validationResult && (
            <div className={`p-3 rounded-lg border text-sm ${
              validationResult.valid
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start gap-2">
                {validationResult.valid ? (
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <p className="font-medium">{validationResult.valid ? 'Validering OK' : 'Validering misslyckades'}</p>
                  {!validationResult.valid && validationResult.error_code && (
                    <p className="text-xs mt-1 font-mono">{validationResult.error_code}</p>
                  )}
                  {validationResult.error_message && (
                    <p className="text-xs mt-1">{validationResult.error_message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Generate Document */}
          <Tooltip
            content="Genererar blanketten SKV 5369_03 (Ansökan om direkt leveransplats) baserat på uppgifterna i detta ärende."
          >
            <Button
              onClick={handleGenerate5369}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generera 5369_03
            </Button>
          </Tooltip>
        </div>

        {/* Status Changes */}
        <div className="space-y-3 pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Statusändringar</p>

          <div className="grid grid-cols-2 gap-2">
            <Tooltip
              content={canSubmit
                ? "Skickar ärendet för granskning. Status ändras till INSKICKAD."
                : "Kan inte skicka in: Generera dokument först (SKV 5369_03)."
              }
            >
              <Button
                onClick={() => handleStatusChange('SUBMITTED', 'Inskickad för granskning')}
                disabled={!canSubmit || loading}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Skicka in
              </Button>
            </Tooltip>

            <Tooltip
              content={canApprove
                ? "Markera ärendet som godkänt. Använd endast efter att Skatteverket har godkänt ansökan."
                : "Kan inte godkänna: Ärendet måste vara INSKICKAD först."
              }
            >
              <Button
                onClick={() => handleStatusChange('APPROVED', 'Godkänd av Skatteverket')}
                disabled={!canApprove || loading}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Godkänn
              </Button>
            </Tooltip>
          </div>

          <Tooltip
            content={canReject
              ? "Markera ärendet som nekat. Kräver motivering."
              : "Kan inte neka: Ärendet måste vara INSKICKAD först."
            }
          >
            <Button
              onClick={() => setShowRejectModal(true)}
              disabled={!canReject || loading}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Avslå
            </Button>
          </Tooltip>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Aktuell status:</span>
              <StatusBadge status={currentStatus} type="case" size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Avslå ärende</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ange anledning till varför ärendet avslås:
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="w-full border border-border rounded p-2 text-sm min-h-[100px] mb-4"
              placeholder="T.ex. Dokumentation ofullständig, felaktiga uppgifter..."
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectNote('');
                }}
              >
                Avbryt
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleStatusChange('REJECTED', rejectNote)}
                disabled={!rejectNote.trim() || loading}
              >
                Avslå ärende
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
