/**
 * IOR CASE DETAIL
 *
 * Case detail page with:
 * - Header with status/priority badges
 * - CaseTimeline for message history
 * - New message form with template option
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Clock,
  AlertTriangle,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  MoreHorizontal,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CaseTimeline, CaseTimelineSkeleton } from '@/components/ior/CaseTimeline';
import { TemplateChooser } from '@/components/ior/TemplateChooser';
import { cn } from '@/lib/utils';

interface CaseMessage {
  id: string;
  content: string;
  contentHtml?: string;
  direction: 'OUTBOUND' | 'INBOUND';
  senderType: 'IOR_USER' | 'PRODUCER' | 'SYSTEM';
  senderName: string;
  senderEmail?: string;
  templateId?: string;
  templateName?: string;
  attachments?: Array<{
    name: string;
    url: string;
    size?: number;
  }>;
  createdAt: string;
}

interface CaseDetail {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  producerId: string;
  producerName: string;
  producerEmail?: string;
  dueAt?: string;
  isOverdue: boolean;
  createdAt: string;
  messages: CaseMessage[];
  threadToken?: string;
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

const statusLabels: Record<string, string> = {
  OPEN: 'Öppen',
  WAITING_PRODUCER: 'Väntar svar',
  WAITING_INTERNAL: 'Behöver åtgärd',
  RESOLVED: 'Löst',
  CLOSED: 'Stängd',
};

const statusStyles: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  WAITING_PRODUCER: 'bg-amber-100 text-amber-700',
  WAITING_INTERNAL: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const priorityStyles: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-500',
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Message form state
  const [newMessage, setNewMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [showTemplateChooser, setShowTemplateChooser] = useState(false);

  // Status update state
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function fetchCase() {
      try {
        const [caseResponse, templatesResponse] = await Promise.all([
          fetch(`/api/ior/cases/${caseId}`),
          fetch('/api/ior/templates'),
        ]);

        if (!caseResponse.ok) {
          if (caseResponse.status === 404) {
            throw new Error('Ärendet hittades inte');
          }
          throw new Error('Kunde inte ladda ärende');
        }

        const caseJson = await caseResponse.json();
        setCaseData(caseJson);

        if (templatesResponse.ok) {
          const templatesJson = await templatesResponse.json();
          setTemplates(templatesJson.templates || []);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    fetchCase();
  }, [caseId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedTemplate) return;

    setSending(true);
    try {
      const response = await fetch(`/api/ior/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage,
          templateId: selectedTemplate?.id,
          variables: templateVariables,
        }),
      });

      if (!response.ok) {
        throw new Error('Kunde inte skicka meddelande');
      }

      const result = await response.json();

      // Add new message to timeline
      if (caseData) {
        setCaseData({
          ...caseData,
          messages: [...caseData.messages, result.message],
          status: result.caseStatus || caseData.status,
        });
      }

      // Reset form
      setNewMessage('');
      setSelectedTemplate(null);
      setTemplateVariables({});
    } catch (err) {
      console.error('Send error:', err);
      alert('Kunde inte skicka meddelande. Försök igen.');
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (
    template: MessageTemplate,
    variables: Record<string, string>
  ) => {
    setSelectedTemplate(template);
    setTemplateVariables(variables);

    // Pre-fill message with rendered template
    let content = template.body;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    if (caseData?.producerName) {
      content = content.replace(/{{producer_name}}/g, caseData.producerName);
    }
    setNewMessage(content);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/ior/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Kunde inte uppdatera status');
      }

      if (caseData) {
        setCaseData({ ...caseData, status: newStatus });
      }
      setShowStatusMenu(false);
    } catch (err) {
      console.error('Status update error:', err);
      alert('Kunde inte uppdatera status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="bg-white border rounded-lg p-6">
            <div className="h-6 bg-gray-200 rounded w-64 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-48" />
          </div>
          <CaseTimelineSkeleton />
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <p className="text-red-700 font-medium">{error || 'Något gick fel'}</p>
          <Link
            href="/ior/cases"
            className="inline-flex items-center gap-2 mt-4 text-wine hover:text-wine/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till ärenden
          </Link>
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

      {/* Case header */}
      <div className="px-4 lg:px-6 mb-6">
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                  priorityStyles[caseData.priority]
                )}>
                  {caseData.priority === 'URGENT' && (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {caseData.priority}
                </span>
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  statusStyles[caseData.status]
                )}>
                  {statusLabels[caseData.status] || caseData.status}
                </span>
                {caseData.isOverdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    <Clock className="h-3 w-3" />
                    Försenad
                  </span>
                )}
              </div>

              {/* Subject */}
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {caseData.subject}
              </h1>

              {/* Meta */}
              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                <Link
                  href={`/ior/producers/${caseData.producerId}`}
                  className="flex items-center gap-1 hover:text-wine"
                >
                  <Building2 className="h-4 w-4" />
                  {caseData.producerName}
                </Link>
                <span>
                  Skapad {format(new Date(caseData.createdAt), 'd MMM yyyy', { locale: sv })}
                </span>
                {caseData.dueAt && (
                  <span className={cn(
                    'flex items-center gap-1',
                    caseData.isOverdue ? 'text-red-600' : 'text-gray-500'
                  )}>
                    <Clock className="h-4 w-4" />
                    Förfaller{' '}
                    {formatDistanceToNow(new Date(caseData.dueAt), {
                      addSuffix: true,
                      locale: sv,
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={cn(
                  'p-2 rounded-lg border border-gray-300',
                  'hover:bg-gray-50 transition-colors'
                )}
              >
                <MoreHorizontal className="h-5 w-5 text-gray-600" />
              </button>

              {showStatusMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowStatusMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-20">
                    <div className="py-1">
                      <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">
                        Uppdatera status
                      </p>
                      {['OPEN', 'WAITING_PRODUCER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusUpdate(status)}
                          disabled={updatingStatus || caseData.status === status}
                          className={cn(
                            'w-full text-left px-4 py-2 text-sm',
                            caseData.status === status
                              ? 'bg-gray-50 text-gray-400'
                              : 'hover:bg-gray-50 text-gray-700'
                          )}
                        >
                          {caseData.status === status && (
                            <CheckCircle className="h-4 w-4 inline mr-2 text-green-500" />
                          )}
                          {statusLabels[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 lg:px-6 mb-6">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="font-medium text-gray-900 mb-4">Konversation</h2>
          <CaseTimeline
            messages={caseData.messages}
            subject={caseData.subject}
            threadToken={caseData.threadToken}
          />
        </div>
      </div>

      {/* New message form */}
      {!['CLOSED', 'RESOLVED'].includes(caseData.status) && (
        <div className="px-4 lg:px-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="font-medium text-gray-900 mb-4">Nytt meddelande</h2>

            {/* Template indicator */}
            {selectedTemplate && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-wine/5 rounded-lg">
                <FileText className="h-4 w-4 text-wine" />
                <span className="text-sm text-wine font-medium">
                  Mall: {selectedTemplate.name}
                </span>
                <button
                  onClick={() => {
                    setSelectedTemplate(null);
                    setTemplateVariables({});
                    setNewMessage('');
                  }}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Message input */}
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Skriv ditt meddelande..."
              rows={4}
              className={cn(
                'w-full px-4 py-3 border border-gray-300 rounded-lg resize-none',
                'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                'placeholder:text-gray-400'
              )}
            />

            {/* Actions */}
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setShowTemplateChooser(true)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                  'border border-gray-300 text-gray-700 font-medium',
                  'hover:bg-gray-50 transition-colors'
                )}
              >
                <FileText className="h-4 w-4" />
                Använd mall
              </button>

              <button
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  newMessage.trim() && !sending
                    ? 'bg-wine text-white hover:bg-wine/90'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {sending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Skickar...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Skicka meddelande
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closed case notice */}
      {['CLOSED', 'RESOLVED'].includes(caseData.status) && (
        <div className="px-4 lg:px-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <CheckCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">
              Detta ärende är {caseData.status === 'CLOSED' ? 'stängt' : 'löst'}
            </p>
            <button
              onClick={() => handleStatusUpdate('OPEN')}
              className="mt-3 text-sm text-wine hover:text-wine/80 font-medium"
            >
              Öppna igen
            </button>
          </div>
        </div>
      )}

      {/* Template chooser modal */}
      <TemplateChooser
        templates={templates}
        isOpen={showTemplateChooser}
        onClose={() => setShowTemplateChooser(false)}
        onSelect={handleTemplateSelect}
        producerName={caseData.producerName}
      />
    </div>
  );
}
