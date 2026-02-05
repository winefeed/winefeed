/**
 * IOR FEEDBACK DETAIL
 *
 * View and update feedback status.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageSquarePlus,
  AlertTriangle,
  Bug,
  Lightbulb,
  Workflow,
  Database,
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FeedbackItem {
  id: string;
  pagePath: string;
  category: string;
  severity: string;
  title: string;
  details: string;
  expected?: string;
  status: string;
  producerId?: string;
  createdAt: string;
  updatedAt: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  UX: Lightbulb,
  Bug: Bug,
  Data: Database,
  Workflow: Workflow,
  'Missing feature': MessageSquarePlus,
  Other: HelpCircle,
};

const categoryLabels: Record<string, string> = {
  UX: 'UX / Användarvänlighet',
  Bug: 'Bugg',
  Data: 'Data',
  Workflow: 'Arbetsflöde',
  'Missing feature': 'Saknad funktion',
  Other: 'Övrigt',
};

const severityStyles: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

const severityLabels: Record<string, string> = {
  Low: 'Låg',
  Medium: 'Medel',
  High: 'Hög',
};

const statusOptions = [
  { value: 'OPEN', label: 'Öppen', icon: Clock, bg: 'bg-blue-100 text-blue-700' },
  { value: 'ACKNOWLEDGED', label: 'Mottagen', icon: CheckCircle, bg: 'bg-purple-100 text-purple-700' },
  { value: 'DONE', label: 'Klar', icon: CheckCircle, bg: 'bg-green-100 text-green-700' },
  { value: 'WONTFIX', label: 'Åtgärdas ej', icon: XCircle, bg: 'bg-gray-100 text-gray-500' },
];

export default function FeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const feedbackId = params.id as string;

  const [feedback, setFeedback] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function fetchFeedback() {
      try {
        const response = await fetch(`/api/ior/feedback/${feedbackId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Feedback hittades inte');
          }
          throw new Error('Kunde inte ladda feedback');
        }
        const data = await response.json();
        setFeedback(data.feedback);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Ett fel uppstod');
      } finally {
        setLoading(false);
      }
    }

    fetchFeedback();
  }, [feedbackId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!feedback || updating) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/ior/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Kunde inte uppdatera status');
      }

      const data = await response.json();
      setFeedback(data.feedback);
    } catch (err) {
      console.error('Update error:', err);
      alert('Kunde inte uppdatera status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="bg-white border rounded-lg p-6">
            <div className="h-6 bg-gray-200 rounded w-64 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="py-6 px-4 lg:px-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <p className="text-red-700 font-medium">{error || 'Något gick fel'}</p>
          <Link
            href="/ior/feedback"
            className="inline-flex items-center gap-2 mt-4 text-wine hover:text-wine/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till feedback
          </Link>
        </div>
      </div>
    );
  }

  const CategoryIcon = categoryIcons[feedback.category] || HelpCircle;
  const currentStatus = statusOptions.find(s => s.value === feedback.status) || statusOptions[0];

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

      <div className="max-w-3xl">
        {/* Header */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <CategoryIcon className="h-6 w-6 text-gray-600" />
            </div>
            <div className="flex-1">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                  currentStatus.bg
                )}>
                  <currentStatus.icon className="h-3 w-3" />
                  {currentStatus.label}
                </span>
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  severityStyles[feedback.severity]
                )}>
                  {severityLabels[feedback.severity]}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  {categoryLabels[feedback.category]}
                </span>
              </div>

              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {feedback.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {format(new Date(feedback.createdAt), 'd MMM yyyy HH:mm', { locale: sv })}
                </span>
                <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                  {feedback.pagePath}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-medium text-gray-900 mb-3">Beskrivning</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{feedback.details}</p>

          {feedback.expected && (
            <>
              <h2 className="font-medium text-gray-900 mt-6 mb-3">Förväntat beteende</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{feedback.expected}</p>
            </>
          )}
        </div>

        {/* Status update */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="font-medium text-gray-900 mb-4">Uppdatera status</h2>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => {
              const Icon = option.icon;
              const isActive = feedback.status === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  disabled={updating || isActive}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                    isActive
                      ? `${option.bg} ring-2 ring-offset-2 ring-current`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    updating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
