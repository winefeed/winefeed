'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SupplierImport {
  id: string;
  tenant_id: string;
  import_id: string;
  created_at: string;
}

interface SupplierImportWidgetProps {
  importId: string;
  linkedImports: SupplierImport[];
  onRefresh: () => void;
}

export function SupplierImportWidget({ importId, linkedImports, onRefresh }: SupplierImportWidgetProps) {
  const [supplierImportId, setSupplierImportId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAttach = async () => {
    if (!supplierImportId.trim()) {
      setMessage({ type: 'error', text: 'Ange ett supplier import ID' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/imports/${importId}/attach-supplier-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify({ supplier_import_id: supplierImportId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to attach supplier import');
      }

      setMessage({ type: 'success', text: 'Supplier import kopplat!' });
      setSupplierImportId('');
      onRefresh(); // Refresh to show new linked import
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Attach Form */}
      <div className="space-y-3">
        <Label htmlFor="supplier_import_id">Koppla Supplier Import</Label>
        <div className="flex gap-2">
          <Input
            id="supplier_import_id"
            type="text"
            placeholder="UUID för supplier import"
            value={supplierImportId}
            onChange={(e) => setSupplierImportId(e.target.value)}
          />
          <Button
            onClick={handleAttach}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Kopplar...' : 'Koppla'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ange UUID för en supplier_import (CSV-upload) för att koppla den till detta importcase
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* Linked Imports */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Kopplade Supplier Imports ({linkedImports.length})</h4>
        {linkedImports.length > 0 ? (
          <div className="space-y-2">
            {linkedImports.map((si) => (
              <div key={si.id} className="bg-card border border-border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs truncate">{si.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(si.created_at).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Inga kopplade supplier imports</p>
        )}
      </div>
    </div>
  );
}
