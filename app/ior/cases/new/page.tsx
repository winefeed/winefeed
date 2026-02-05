/**
 * IOR NEW CASE PAGE
 *
 * Create a new communication case with a producer.
 * Flow:
 * 1. Select producer (preselected if producerId in query)
 * 2. Select category
 * 3. Choose template (opens TemplateChooser)
 * 4. Submit → redirect to case detail
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Send,
  FileText,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { TemplateChooser } from '@/components/ior/TemplateChooser';
import { cn } from '@/lib/utils';

interface Producer {
  id: string;
  name: string;
  country: string;
  contactEmail?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: string[];
  slaDays?: number;
}

const categories = [
  { id: 'pricing', label: 'Prissättning', description: 'Prislistor och prisfrågor' },
  { id: 'logistics', label: 'Logistik', description: 'Leverans och frakt' },
  { id: 'quality', label: 'Kvalitet', description: 'Produktkvalitet och reklamation' },
  { id: 'documents', label: 'Dokument', description: 'Certifikat och dokumentation' },
  { id: 'general', label: 'Allmänt', description: 'Övriga frågor' },
];

export default function NewCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProducerId = searchParams.get('producerId');

  // State
  const [producers, setProducers] = useState<Producer[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedProducerId, setSelectedProducerId] = useState(preselectedProducerId || '');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // UI state
  const [showTemplateChooser, setShowTemplateChooser] = useState(false);
  const [showProducerDropdown, setShowProducerDropdown] = useState(false);

  const selectedProducer = producers.find(p => p.id === selectedProducerId);
  const isProducerLocked = !!preselectedProducerId;

  useEffect(() => {
    async function fetchData() {
      try {
        const [producersRes, templatesRes] = await Promise.all([
          fetch('/api/ior/producers?pageSize=100'),
          fetch('/api/ior/templates'),
        ]);

        if (producersRes.ok) {
          const data = await producersRes.json();
          setProducers(data.items || []);
        }

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleTemplateSelect = (
    template: MessageTemplate,
    variables: Record<string, string>
  ) => {
    setSelectedTemplate(template);
    setTemplateVariables(variables);
    setSelectedCategory(template.category);

    // Render subject
    let renderedSubject = template.subject;
    Object.entries(variables).forEach(([key, value]) => {
      renderedSubject = renderedSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    if (selectedProducer) {
      renderedSubject = renderedSubject.replace(/{{producer_name}}/g, selectedProducer.name);
    }
    setSubject(renderedSubject);

    // Render body
    let renderedBody = template.body;
    Object.entries(variables).forEach(([key, value]) => {
      renderedBody = renderedBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    if (selectedProducer) {
      renderedBody = renderedBody.replace(/{{producer_name}}/g, selectedProducer.name);
    }
    setMessage(renderedBody);
  };

  const handleSubmit = async () => {
    if (!selectedProducerId || !subject.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      // Create the case
      const caseRes = await fetch('/api/ior/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producer_id: selectedProducerId,
          subject: subject.trim(),
          category: selectedCategory,
          priority: selectedTemplate?.slaDays && selectedTemplate.slaDays <= 3 ? 'HIGH' : 'NORMAL',
        }),
      });

      if (!caseRes.ok) {
        throw new Error('Failed to create case');
      }

      const { case: newCase } = await caseRes.json();

      // Send the first message
      const messageRes = await fetch(`/api/ior/cases/${newCase.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.trim(),
          templateId: selectedTemplate?.id,
          variables: templateVariables,
        }),
      });

      if (!messageRes.ok) {
        console.error('Failed to send message, but case was created');
      }

      // Redirect to case detail
      router.push(`/ior/cases/${newCase.id}`);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Kunde inte skapa ärende. Försök igen.');
      setSubmitting(false);
    }
  };

  const canSubmit = selectedProducerId && subject.trim() && message.trim() && !submitting;

  if (loading) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Breadcrumb */}
      <div className="px-4 lg:px-6 mb-4">
        <Link
          href="/ior/cases"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till ärenden
        </Link>
      </div>

      {/* Header */}
      <div className="px-4 lg:px-6 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Nytt ärende</h1>
        <p className="text-sm text-gray-500 mt-1">
          Skapa ett nytt kommunikationsärende med en producent
        </p>
      </div>

      {/* Form */}
      <div className="px-4 lg:px-6">
        <div className="bg-white border rounded-lg p-6 space-y-6 max-w-2xl">
          {/* Producer selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Producent
            </label>
            {isProducerLocked && selectedProducer ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="p-2 bg-wine/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-wine" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedProducer.name}</p>
                  <p className="text-sm text-gray-500">{selectedProducer.country}</p>
                </div>
                <Check className="h-5 w-5 text-green-500 ml-auto" />
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowProducerDropdown(!showProducerDropdown)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 border rounded-lg text-left',
                    'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                    selectedProducer ? 'border-gray-300' : 'border-gray-300'
                  )}
                >
                  {selectedProducer ? (
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-gray-400" />
                      <span className="font-medium">{selectedProducer.name}</span>
                      <span className="text-gray-500">• {selectedProducer.country}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Välj producent...</span>
                  )}
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </button>

                {showProducerDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProducerDropdown(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                      {producers.map((producer) => (
                        <button
                          key={producer.id}
                          onClick={() => {
                            setSelectedProducerId(producer.id);
                            setShowProducerDropdown(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50',
                            selectedProducerId === producer.id && 'bg-wine/5'
                          )}
                        >
                          <Building2 className="h-5 w-5 text-gray-400" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{producer.name}</p>
                            <p className="text-sm text-gray-500">{producer.country}</p>
                          </div>
                          {selectedProducerId === producer.id && (
                            <Check className="h-5 w-5 text-wine" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kategori
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-colors',
                    selectedCategory === cat.id
                      ? 'border-wine bg-wine/5 text-wine'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className="font-medium text-sm">{cat.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Template or manual */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <button
              onClick={() => setShowTemplateChooser(true)}
              disabled={!selectedProducerId}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-colors',
                selectedProducerId
                  ? 'border-wine text-wine hover:bg-wine/5'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <FileText className="h-4 w-4" />
              Använd mall
            </button>
            {selectedTemplate && (
              <span className="text-sm text-gray-500">
                Mall: <span className="font-medium text-gray-700">{selectedTemplate.name}</span>
              </span>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ämne
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Skriv ett ämne..."
              className={cn(
                'w-full px-4 py-2 border border-gray-300 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                'placeholder:text-gray-400'
              )}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meddelande
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ditt meddelande..."
              rows={6}
              className={cn(
                'w-full px-4 py-3 border border-gray-300 rounded-lg resize-none',
                'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                'placeholder:text-gray-400'
              )}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link
              href="/ior/cases"
              className="px-4 py-2 text-gray-700 font-medium hover:text-gray-900"
            >
              Avbryt
            </Link>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                canSubmit
                  ? 'bg-wine text-white hover:bg-wine/90'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Skapar...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Skicka
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Template chooser modal */}
      <TemplateChooser
        templates={templates.filter(t =>
          selectedCategory === 'general' || t.category === selectedCategory
        )}
        isOpen={showTemplateChooser}
        onClose={() => setShowTemplateChooser(false)}
        onSelect={handleTemplateSelect}
        producerName={selectedProducer?.name}
      />
    </div>
  );
}
