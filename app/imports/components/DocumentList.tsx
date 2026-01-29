'use client';

import { useState } from 'react';
import { getErrorMessage } from '@/lib/utils';

interface Document {
  id: string;
  type: string;
  version: number;
  storage_path: string;
  sha256: string;
  created_at: string;
}

interface DocumentListProps {
  documents: Document[];
  importId: string;
}

const documentTypeLabels: Record<string, string> = {
  'SKV_5369_03': 'Skatteverket 5369_03 (DDL-ansökan)'
};

export function DocumentList({ documents, importId }: DocumentListProps) {
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (doc: Document) => {
    setLoadingDocId(doc.id);
    setError(null);

    try {
      const response = await fetch(`/api/imports/${importId}/documents/${doc.id}/download`, {
        headers: {
          
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate download link');
      }

      const data = await response.json();

      // Open signed URL in new window
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(getErrorMessage(err, 'Ett fel uppstod'));
      setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
    } finally {
      setLoadingDocId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Inga dokument genererade ännu</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {documents.map((doc) => (
        <div key={doc.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">📄</span>
                <span className="font-medium">
                  {documentTypeLabels[doc.type] || doc.type}
                </span>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                  v{doc.version}
                </span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Skapad:</span>{' '}
                  {new Date(doc.created_at).toLocaleString('sv-SE')}
                </p>
                <p className="text-xs font-mono truncate">
                  <span className="font-medium">Hash:</span> {doc.sha256.substring(0, 16)}...
                </p>
                <p className="text-xs truncate">
                  <span className="font-medium">Sökväg:</span> {doc.storage_path}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDownload(doc)}
                disabled={loadingDocId === doc.id}
                className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingDocId === doc.id ? 'Hämtar länk...' : '⬇️ Ladda ner'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
