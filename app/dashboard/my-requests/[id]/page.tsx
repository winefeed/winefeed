/**
 * RESTAURANT VIEW: REQUEST STATUS
 *
 * /dashboard/my-requests/[id]
 *
 * Shows request details and which suppliers received the request
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Eye, MessageSquare, Building2, Mail, Megaphone, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { openCriteriaBadges, type OpenCriteria } from '@/lib/matching-agent/open-request-fanout';

interface SupplierAssignment {
  supplier_id: string;
  supplier_name: string;
  status: 'SENT' | 'VIEWED' | 'RESPONDED';
  sent_at: string;
}

interface RequestDetails {
  id: string;
  freetext: string | null;
  budget_sek: number | null;
  quantity_bottles: number | null;
  delivery_date_requested: string | null;
  specialkrav: string[] | null;
  color: string | null;
  status: string;
  request_type: 'targeted' | 'open';
  open_criteria: OpenCriteria | null;
  created_at: string;
  offers_count: number;
  assignments: SupplierAssignment[];
}

export default function RequestStatusPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/requests/${requestId}/status`);

      if (!response.ok) {
        throw new Error('Kunde inte ladda förfrågan');
      }

      const data = await response.json();
      setRequest(data);
    } catch (err: any) {
      console.error('Failed to fetch request:', err);
      setError(err.message || 'Något gick fel');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RESPONDED':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'VIEWED':
        return <Eye className="h-4 w-4 text-blue-600" />;
      default:
        return <Mail className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'RESPONDED':
        return 'Har svarat';
      case 'VIEWED':
        return 'Har öppnat';
      default:
        return 'Skickad';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'RESPONDED':
        return 'bg-green-50 border-green-200';
      case 'VIEWED':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/my-requests')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">{error || 'Förfrågan hittades inte'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back button + duplicate action */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/dashboard/my-requests')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka till mina förfrågningar
        </button>
        {request.request_type === 'open' && (
          <button
            onClick={() => router.push(`/dashboard/new-request/open?from=${request.id}`)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-[#722F37]/20 text-[#722F37] hover:bg-[#722F37]/5 transition-colors"
            title="Skapa en ny förfrågan med samma kriterier"
          >
            <Copy className="h-4 w-4" />
            Duplicera
          </button>
        )}
      </div>

      {/* PENDING_REVIEW state — open broadcast request waiting for admin */}
      {request.status === 'PENDING_REVIEW' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Väntar på granskning</p>
            <p className="text-sm text-amber-800 mt-1">
              Vi granskar din öppna förfrågan innan den skickas ut till leverantörer. Du får mail när den är godkänd — oftast inom någon timme på vardagar.
            </p>
          </div>
        </div>
      )}

      {/* REJECTED state */}
      {request.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-6">
          <p className="font-semibold text-red-900">Förfrågan avvisad</p>
          <p className="text-sm text-red-800 mt-1">
            Vi har inte skickat ut din förfrågan. Hör av dig till{' '}
            <a href="mailto:hej@winefeed.se" className="underline font-medium">hej@winefeed.se</a>
            {' '}om du har frågor.
          </p>
        </div>
      )}

      {/* Request summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        {request.request_type === 'open' && (
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#722F37]/10 text-[#722F37] border border-[#722F37]/20">
              <Megaphone className="h-3 w-3" />
              Öppen förfrågan
            </span>
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {request.freetext || 'Vinförfrågan'}
        </h1>

        {request.request_type === 'open' && request.open_criteria ? (
          <>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {openCriteriaBadges(request.open_criteria).map((b, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {b}
                </span>
              ))}
            </div>
            {request.open_criteria.free_text && (
              <p className="text-sm text-slate-600 italic mt-3">&ldquo;{request.open_criteria.free_text}&rdquo;</p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {request.budget_sek && (
              <span>Budget: max {request.budget_sek} kr/flaska</span>
            )}
            {request.quantity_bottles && (
              <span>{request.quantity_bottles} flaskor</span>
            )}
            {request.delivery_date_requested && (
              <span>Leverans: {new Date(request.delivery_date_requested).toLocaleDateString('sv-SE')}</span>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Skapad {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: sv })}
        </p>
      </div>

      {/* Status section — hide entirely while PENDING_REVIEW since no
          assignments exist yet and the banner above already explains
          what's happening. */}
      {request.status !== 'PENDING_REVIEW' && request.status !== 'REJECTED' && (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            {request.request_type === 'open' ? 'Leverantörer som tävlar om affären' : 'Leverantörer som fått förfrågan'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {request.assignments.length} leverantörer • {request.offers_count} har svarat med offert
          </p>
        </div>

        {request.assignments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>Förfrågan har inte skickats till några leverantörer ännu.</p>
            <p className="text-sm mt-1">Detta sker automatiskt inom kort.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {request.assignments.map((assignment) => (
              <div
                key={assignment.supplier_id}
                className={`px-6 py-4 flex items-center justify-between ${getStatusBg(assignment.status)}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{assignment.supplier_name}</p>
                    <p className="text-xs text-gray-500">
                      Skickad {formatDistanceToNow(new Date(assignment.sent_at), { addSuffix: true, locale: sv })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {getStatusIcon(assignment.status)}
                  <span className={`font-medium ${
                    assignment.status === 'RESPONDED' ? 'text-green-700' :
                    assignment.status === 'VIEWED' ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {getStatusText(assignment.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* CTA if offers exist */}
      {request.offers_count > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-medium text-green-900">
              {request.offers_count} offert{request.offers_count > 1 ? 'er' : ''} att granska
            </p>
            <p className="text-sm text-green-700">
              Leverantörer har svarat på din förfrågan
            </p>
          </div>
          <button
            onClick={() => router.push(`/dashboard/offers?request_id=${request.id}`)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Se offerter
          </button>
        </div>
      )}
    </div>
  );
}
