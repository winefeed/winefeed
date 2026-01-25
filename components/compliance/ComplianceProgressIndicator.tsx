/**
 * COMPLIANCE PROGRESS INDICATOR
 *
 * Step progress bar for import case compliance.
 * Shows current step and completion status.
 */

import { Check, Circle, AlertCircle, Loader2 } from 'lucide-react';

export interface ComplianceStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  description?: string;
}

interface ComplianceProgressIndicatorProps {
  steps: ComplianceStep[];
  compact?: boolean;
}

export function ComplianceProgressIndicator({
  steps,
  compact = false,
}: ComplianceProgressIndicatorProps) {
  if (compact) {
    // Compact horizontal version
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.id} className="flex items-center">
              <StepDot status={step.status} size="sm" />
              {!isLast && (
                <div
                  className={`w-4 h-0.5 ${
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Full version with labels
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div
              key={step.id}
              className={`flex items-center ${isLast ? '' : 'flex-1'}`}
            >
              <div className="flex flex-col items-center">
                <StepDot status={step.status} size="md" />
                <span
                  className={`mt-2 text-xs font-medium text-center max-w-[80px] ${
                    step.status === 'completed'
                      ? 'text-green-700'
                      : step.status === 'current'
                      ? 'text-blue-700'
                      : step.status === 'error'
                      ? 'text-red-700'
                      : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-20px] ${
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StepDotProps {
  status: ComplianceStep['status'];
  size: 'sm' | 'md';
}

function StepDot({ status, size }: StepDotProps) {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';

  switch (status) {
    case 'completed':
      return (
        <div
          className={`${sizeClasses} rounded-full bg-green-500 flex items-center justify-center`}
          title="Klart"
        >
          <Check className={`${iconSize} text-white`} />
        </div>
      );
    case 'current':
      return (
        <div
          className={`${sizeClasses} rounded-full bg-blue-500 flex items-center justify-center animate-pulse`}
          title="Pågående"
        >
          <Loader2 className={`${iconSize} text-white animate-spin`} />
        </div>
      );
    case 'error':
      return (
        <div
          className={`${sizeClasses} rounded-full bg-red-500 flex items-center justify-center`}
          title="Fel"
        >
          <AlertCircle className={`${iconSize} text-white`} />
        </div>
      );
    default:
      return (
        <div
          className={`${sizeClasses} rounded-full bg-gray-200 flex items-center justify-center`}
          title="Väntande"
        >
          <Circle className={`${iconSize} text-gray-400`} />
        </div>
      );
  }
}

/**
 * Helper to generate steps for an import case
 */
export function getImportCaseSteps(importCase: {
  status: string;
  has_identifiers?: boolean;
  has_shipment?: boolean;
  has_required_fields?: boolean;
  has_document?: boolean;
}): ComplianceStep[] {
  const steps: ComplianceStep[] = [];

  // Step 1: Product identifiers
  steps.push({
    id: 'identifiers',
    label: 'Produktdata',
    status: importCase.has_identifiers ? 'completed' :
            importCase.status === 'NOT_REGISTERED' ? 'current' : 'pending',
    description: 'GTIN/LWIN, ABV, volym, ursprung',
  });

  // Step 2: Shipment linked (if applicable)
  if (importCase.has_shipment !== undefined) {
    steps.push({
      id: 'shipment',
      label: 'Leverans',
      status: importCase.has_shipment ? 'completed' :
              importCase.has_identifiers ? 'current' : 'pending',
      description: 'Leveransinfo länkad',
    });
  }

  // Step 3: Required fields complete
  steps.push({
    id: 'fields',
    label: 'Komplett data',
    status: importCase.has_required_fields ? 'completed' :
            (importCase.has_identifiers && (importCase.has_shipment ?? true)) ? 'current' : 'pending',
    description: 'Alla obligatoriska fält ifyllda',
  });

  // Step 4: Document generated
  steps.push({
    id: 'document',
    label: 'Dokument',
    status: importCase.has_document ? 'completed' :
            importCase.has_required_fields ? 'current' : 'pending',
    description: '5369-dokument genererat',
  });

  // Step 5: Submitted/Approved
  const terminalStatuses = ['SUBMITTED', 'APPROVED', 'COMPLETED'];
  steps.push({
    id: 'submitted',
    label: importCase.status === 'APPROVED' || importCase.status === 'COMPLETED' ? 'Godkänd' : 'Inskickad',
    status: importCase.status === 'APPROVED' || importCase.status === 'COMPLETED' ? 'completed' :
            importCase.status === 'SUBMITTED' ? 'current' :
            importCase.status === 'REJECTED' ? 'error' : 'pending',
    description: 'Skickad till Systembolaget',
  });

  return steps;
}

/**
 * Simple completion percentage
 */
export function getCompletionPercentage(steps: ComplianceStep[]): number {
  const completed = steps.filter(s => s.status === 'completed').length;
  return Math.round((completed / steps.length) * 100);
}
