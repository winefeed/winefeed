'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface ActionsPanelProps {
  importId: string;
  currentStatus: string;
  onRefresh: () => void;
}

export function ActionsPanel({ importId, currentStatus, onRefresh }: ActionsPanelProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error_code?: string;
    error_message?: string;
  } | null>(null);
  const [documentResult, setDocumentResult] = useState<{
    version?: number;
    storage_path?: string;
    error?: string;
  } | null>(null);

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
        error_message: getErrorMessage(err, 'Ett fel uppstod')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate5369 = async () => {
    setLoading(true);
    setDocumentResult(null);

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

      const data = await response.json();
      setDocumentResult({
        version: data.version,
        storage_path: data.storage_path
      });
      onRefresh(); // Refresh to show new document
    } catch (err) {
      setDocumentResult({
        error: getErrorMessage(err, 'Ett fel uppstod')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetStatus = async (toStatus: string, why: string) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/imports/${importId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
          
        },
        body: JSON.stringify({ to_status: toStatus, why })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      onRefresh(); // Refresh to show new status
    } catch (err) {
      toast.error('Kunde inte uppdatera status', getErrorMessage(err, 'Ett fel uppstod'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Validation Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Validera för leverans</h3>
        <Button
          onClick={handleValidateShipment}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          {loading ? 'Validerar...' : '🚚 Validate Shipment'}
        </Button>

        {validationResult && (
          <div className={`p-4 rounded-lg border ${validationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {validationResult.valid ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium text-green-800">Validering OK</p>
                  <p className="text-sm text-green-700">Leverans kan genomföras</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-medium text-red-800">Validering misslyckades</p>
                  <p className="text-sm text-red-700 mt-1">
                    <span className="font-mono text-xs bg-red-100 px-2 py-0.5 rounded">{validationResult.error_code}</span>
                  </p>
                  <p className="text-sm text-red-700 mt-1">{validationResult.error_message}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Generation Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Generera dokument</h3>
        <Button
          onClick={handleGenerate5369}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          {loading ? 'Genererar...' : '📄 Generera 5369_03'}
        </Button>

        {documentResult && (
          <div className={`p-4 rounded-lg border ${documentResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            {documentResult.error ? (
              <div className="flex items-start gap-2">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-medium text-red-800">Generering misslyckades</p>
                  <p className="text-sm text-red-700 mt-1">{documentResult.error}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium text-green-800">Dokument genererat</p>
                  <p className="text-sm text-green-700 mt-1">Version: {documentResult.version}</p>
                  <p className="text-xs text-green-600 mt-1 font-mono truncate">{documentResult.storage_path}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Actions Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Ändra status</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleSetStatus('SUBMITTED', 'Skickad för granskning')}
            disabled={loading || currentStatus === 'SUBMITTED'}
            variant="outline"
            size="sm"
          >
            📤 Submit
          </Button>
          <Button
            onClick={() => handleSetStatus('APPROVED', 'Godkänd för import')}
            disabled={loading || currentStatus === 'APPROVED'}
            variant="outline"
            size="sm"
          >
            ✅ Approve
          </Button>
          <Button
            onClick={() => handleSetStatus('REJECTED', 'Nekad - saknar dokumentation')}
            disabled={loading || currentStatus === 'REJECTED'}
            variant="destructive"
            size="sm"
          >
            ❌ Reject
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Aktuell status: <span className="font-medium">{currentStatus}</span>
        </p>
      </div>
    </div>
  );
}
