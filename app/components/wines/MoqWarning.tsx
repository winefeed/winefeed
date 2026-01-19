'use client';

/**
 * MOQ Warning Component
 *
 * Displays a warning when requested quantity is below minimum order quantity.
 * Provides a button to adjust quantity to meet MOQ.
 */

import { useState } from 'react';

export interface MoqWarningProps {
  requestedQuantity: number;
  moq: number;
  unit?: 'bottles' | 'cases';
  onAdjust?: (newQuantity: number) => Promise<void>;
  disabled?: boolean;
}

export function MoqWarning({
  requestedQuantity,
  moq,
  unit = 'bottles',
  onAdjust,
  disabled = false,
}: MoqWarningProps) {
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Don't show warning if quantity meets MOQ
  if (requestedQuantity >= moq) {
    return null;
  }

  const unitLabel = unit === 'cases' ? 'kartonger' : 'flaskor';
  const difference = moq - requestedQuantity;

  const handleAdjust = async () => {
    if (!onAdjust || disabled) return;

    setIsAdjusting(true);
    try {
      await onAdjust(moq);
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-amber-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex-1">
          {/* Warning text */}
          <p className="text-sm font-medium text-amber-800">
            Minsta order: {moq} {unitLabel}
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Du frågade om {requestedQuantity} {unitLabel}. Lägg till {difference} {unitLabel} för att nå minsta orderkvantitet.
          </p>

          {/* Adjust button */}
          {onAdjust && (
            <button
              type="button"
              onClick={handleAdjust}
              disabled={disabled || isAdjusting}
              className="mt-3 inline-flex items-center rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdjusting ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Justerar...
                </>
              ) : (
                `Justera till ${moq} ${unitLabel}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function MoqWarningCompact({
  requestedQuantity,
  moq,
  unit = 'bottles',
}: Pick<MoqWarningProps, 'requestedQuantity' | 'moq' | 'unit'>) {
  if (requestedQuantity >= moq) {
    return null;
  }

  const unitLabel = unit === 'cases' ? 'krt' : 'fl';

  return (
    <span className="inline-flex items-center gap-1 text-sm text-amber-600">
      <svg
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      Min: {moq} {unitLabel}
    </span>
  );
}
