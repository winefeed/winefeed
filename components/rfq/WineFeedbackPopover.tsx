'use client';

/**
 * WineFeedbackPopover — inline dislike widget for the results page.
 *
 * A small thumbs-down icon that, on click, expands to show 4 structured
 * feedback options. Clicking one sends a POST to /api/wine-feedback and
 * visually marks the wine as "not for me" (grayed out). The popover
 * collapses automatically after selection.
 *
 * Intentionally minimal: no textarea, no multi-select, no undo. The
 * goal is zero-friction signal capture, not a survey.
 */

import { useState } from 'react';
import { ThumbsDown, Check } from 'lucide-react';

interface Props {
  wineId: string;
  supplierId: string;
  requestId?: string;
  onFeedbackGiven?: (feedbackType: string) => void;
}

const FEEDBACK_OPTIONS: Array<{ type: string; label: string; emoji: string }> = [
  { type: 'too_expensive', label: 'För dyrt', emoji: '💰' },
  { type: 'wrong_style', label: 'Fel stil', emoji: '🎨' },
  { type: 'wrong_region', label: 'Fel region', emoji: '🗺️' },
  { type: 'already_tried', label: 'Redan provat', emoji: '🔄' },
];

export function WineFeedbackPopover({ wineId, supplierId, requestId, onFeedbackGiven }: Props) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSelect(feedbackType: string) {
    setSending(true);
    try {
      const res = await fetch('/api/wine-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wine_id: wineId,
          supplier_id: supplierId,
          feedback_type: feedbackType,
          request_id: requestId || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(feedbackType);
        setOpen(false);
        onFeedbackGiven?.(feedbackType);
      }
    } catch {
      // Fail silently — feedback is non-critical
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="Feedback registrerad">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
        title="Inte rätt för oss"
        aria-label="Ge feedback på detta vin"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Popover */}
          <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 min-w-[160px]">
            {FEEDBACK_OPTIONS.map(opt => (
              <button
                key={opt.type}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(opt.type);
                }}
                disabled={sending}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 text-left"
              >
                <span className="text-base leading-none">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
