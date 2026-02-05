/**
 * IOR NEW FEEDBACK
 *
 * Form to submit structured feedback.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquarePlus, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { value: 'UX', label: 'UX / Användarvänlighet', description: 'Något är svårt att använda eller förstå' },
  { value: 'Bug', label: 'Bugg', description: 'Något fungerar inte som det ska' },
  { value: 'Data', label: 'Data', description: 'Fel eller saknad data' },
  { value: 'Workflow', label: 'Arbetsflöde', description: 'Processen fungerar inte optimalt' },
  { value: 'Missing feature', label: 'Saknad funktion', description: 'Jag saknar en funktion' },
  { value: 'Other', label: 'Övrigt', description: 'Annan typ av feedback' },
];

const severities = [
  { value: 'Low', label: 'Låg', description: 'Liten påverkan, kan vänta' },
  { value: 'Medium', label: 'Medel', description: 'Påverkar arbetet men går att kringgå' },
  { value: 'High', label: 'Hög', description: 'Stort problem, blockerar arbetet' },
];

interface FormData {
  category: string;
  severity: string;
  title: string;
  details: string;
  expected: string;
}

export default function NewFeedbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get context from URL params
  const fromPath = searchParams.get('from') || '/ior';
  const producerId = searchParams.get('producerId') || undefined;
  const caseId = searchParams.get('caseId') || undefined;

  const [formData, setFormData] = useState<FormData>({
    category: '',
    severity: 'Medium',
    title: '',
    details: '',
    expected: '',
  });

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.category) {
      setError('Välj en kategori');
      return;
    }
    if (!formData.title.trim()) {
      setError('Ange en titel');
      return;
    }
    if (!formData.details.trim()) {
      setError('Beskriv problemet eller förslaget');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/ior/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          severity: formData.severity,
          title: formData.title.trim(),
          details: formData.details.trim(),
          expected: formData.expected.trim() || undefined,
          pagePath: fromPath,
          producerId,
          caseId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kunde inte skicka feedback');
      }

      // Success - redirect to feedback list
      router.push('/ior/feedback');
    } catch (err) {
      console.error('Submit feedback error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-6 px-4 lg:px-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/ior/feedback"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till feedback
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-wine/10 rounded-lg">
          <MessageSquarePlus className="h-6 w-6 text-wine" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ge feedback</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hjälp oss förbättra IOR
          </p>
        </div>
      </div>

      {/* Context info */}
      {fromPath !== '/ior' && (
        <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Sidan:</span>{' '}
            <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">{fromPath}</code>
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white border rounded-lg divide-y">
          {/* Category */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Typ av feedback <span className="text-red-500">*</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleChange('category', cat.value)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    formData.category === cat.value
                      ? 'border-wine bg-wine/5 ring-2 ring-wine'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <p className="font-medium text-gray-900 text-sm">{cat.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div className="p-6">
            <h2 className="font-medium text-gray-900 mb-4">Allvarlighetsgrad <span className="text-red-500">*</span></h2>
            <div className="flex gap-3">
              {severities.map((sev) => (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => handleChange('severity', sev.value)}
                  className={cn(
                    'flex-1 p-3 rounded-lg border text-left transition-all',
                    formData.severity === sev.value
                      ? 'border-wine bg-wine/5 ring-2 ring-wine'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <p className="font-medium text-gray-900 text-sm">{sev.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{sev.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title & Details */}
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Sammanfattning <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Kort beskrivning av problemet eller förslaget"
                className={cn(
                  'w-full px-4 py-2 border border-gray-300 rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                  'placeholder:text-gray-400'
                )}
              />
            </div>

            <div>
              <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">
                Detaljer <span className="text-red-500">*</span>
              </label>
              <textarea
                id="details"
                value={formData.details}
                onChange={(e) => handleChange('details', e.target.value)}
                rows={5}
                placeholder="Beskriv problemet i detalj. Vad gjorde du? Vad hände? Vad förväntade du dig?"
                className={cn(
                  'w-full px-4 py-3 border border-gray-300 rounded-lg resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                  'placeholder:text-gray-400'
                )}
              />
            </div>

            <div>
              <label htmlFor="expected" className="block text-sm font-medium text-gray-700 mb-1">
                Förväntat beteende <span className="text-gray-400 font-normal">(valfritt)</span>
              </label>
              <textarea
                id="expected"
                value={formData.expected}
                onChange={(e) => handleChange('expected', e.target.value)}
                rows={3}
                placeholder="Hur borde det fungera istället?"
                className={cn(
                  'w-full px-4 py-3 border border-gray-300 rounded-lg resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                  'placeholder:text-gray-400'
                )}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors',
              saving
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-wine text-white hover:bg-wine/90'
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Skickar...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Skicka feedback
              </>
            )}
          </button>

          <Link
            href="/ior/feedback"
            className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
          >
            Avbryt
          </Link>
        </div>
      </form>
    </div>
  );
}
