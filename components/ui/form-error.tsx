'use client';

import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FormErrorSummaryProps {
  errors: Record<string, { message?: string } | undefined>;
  className?: string;
}

// Maps field names to Swedish labels
const fieldLabels: Record<string, string> = {
  color: 'Vintyp',
  budget_max: 'Budget',
  antal_flaskor: 'Antal flaskor',
  country: 'Land',
  grape: 'Druva',
  leverans_senast: 'Leveransdatum',
  leverans_ort: 'Leveransort',
  description: 'Beskrivning',
  price: 'Pris',
  quantity: 'Antal',
  name: 'Namn',
  email: 'E-post',
};

export function FormErrorSummary({ errors, className }: FormErrorSummaryProps) {
  const [dismissed, setDismissed] = useState(false);

  const errorList = Object.entries(errors)
    .filter(([_, error]) => error?.message)
    .map(([field, error]) => ({
      field,
      label: fieldLabels[field] || field,
      message: error!.message!,
    }));

  if (errorList.length === 0 || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-red-50 border border-red-200 rounded-lg p-4 mb-4',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Vänligen korrigera följande {errorList.length === 1 ? 'fel' : 'fel'}:
          </h3>
          <ul className="mt-2 text-sm text-red-700 space-y-1">
            {errorList.map(({ field, label, message }) => (
              <li key={field} className="flex gap-1">
                <span className="font-medium">{label}:</span>
                <span>{message}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-500 hover:text-red-700 p-1"
          aria-label="Stäng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: { message?: string };
  className?: string;
}

export function FormField({ children, error, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {children}
      {error?.message && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error.message}
        </p>
      )}
    </div>
  );
}

// Utility to add error border to input className
export function inputErrorClass(hasError: boolean): string {
  return hasError
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : '';
}
