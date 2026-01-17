/**
 * STEP INDICATOR COMPONENT
 *
 * Shows the restaurant user journey flow
 * Helps first-time users understand the process
 */

'use client';

interface Step {
  number: number;
  title: string;
  status: 'completed' | 'active' | 'upcoming';
}

interface StepIndicatorProps {
  currentStep: number;
  compact?: boolean;
}

const STEPS: Omit<Step, 'status'>[] = [
  { number: 1, title: 'Skapa request' },
  { number: 2, title: 'Få offerter' },
  { number: 3, title: 'Acceptera' },
  { number: 4, title: 'Följ order' },
];

export function StepIndicator({ currentStep, compact = false }: StepIndicatorProps) {
  const steps: Step[] = STEPS.map((step) => ({
    ...step,
    status: step.number < currentStep ? 'completed' : step.number === currentStep ? 'active' : 'upcoming',
  }));

  if (compact) {
    // Compact version - just show text
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex items-center gap-2">
            <span className={step.status === 'active' ? 'text-primary font-medium' : ''}>
              {step.number}. {step.title}
            </span>
            {idx < steps.length - 1 && <span>→</span>}
          </div>
        ))}
      </div>
    );
  }

  // Full version - with visual indicators
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              {/* Circle */}
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold text-sm mb-2 ${
                  step.status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : step.status === 'active'
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {step.status === 'completed' ? '✓' : step.number}
              </div>

              {/* Label */}
              <div
                className={`text-xs font-medium text-center ${
                  step.status === 'active' ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </div>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mt-[-20px] ${
                  step.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/30'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
