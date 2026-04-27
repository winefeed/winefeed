'use client';

/**
 * Editorial form-byggblock för publika sidor (login, signup, kontakt etc.).
 * Matchar landningssidans designprofil från design_handoff_landing/.
 *
 * Använd så här:
 *   <EditorialFormShell title="Logga in" subtitle="Logga in för att fortsätta">
 *     <EditorialFormError message={error} />
 *     <EditorialField label="E-post" htmlFor="email">
 *       <EditorialInput id="email" name="email" type="email" required ... />
 *     </EditorialField>
 *     <EditorialPrimaryButton type="submit">Logga in</EditorialPrimaryButton>
 *   </EditorialFormShell>
 */

import { ReactNode, InputHTMLAttributes, ButtonHTMLAttributes, forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function EditorialFormPage({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#fbfaf7] text-[#161412] font-[family-name:var(--font-inter)] min-h-screen flex flex-col">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form card with editorial title/subtitle
// ---------------------------------------------------------------------------

export function EditorialFormShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center py-12 sm:py-16 px-5 sm:px-8">
      <div className="w-full max-w-[460px]">
        <div className="text-center mb-10 flex flex-col gap-3 items-center">
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">{eyebrow}</p>
          )}
          <h1
            className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] text-[#161412]"
            style={{ fontSize: 'clamp(36px, 4.5vw, 48px)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] leading-[1.55] text-[#828181] max-w-[42ch]">{subtitle}</p>
          )}
        </div>

        <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-7 sm:p-8">
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-[#828181]">{footer}</div>}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper (label + input)
// ---------------------------------------------------------------------------

export function EditorialField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[#161412] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-[#828181]">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

interface EditorialInputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
}

export const EditorialInput = forwardRef<HTMLInputElement, EditorialInputProps>(
  function EditorialInput({ leadingIcon, className = '', ...props }, ref) {
    return (
      <div className="relative">
        {leadingIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#828181]">
            {leadingIcon}
          </div>
        )}
        <input
          ref={ref}
          {...props}
          className={`block w-full h-11 px-4 ${leadingIcon ? 'pl-11' : ''} bg-white border border-[#d8d4d3] rounded-[10px] text-[15px] text-[#161412] placeholder-[#828181] focus:outline-none focus:border-[#722F37] focus:ring-2 focus:ring-[#722F37]/20 transition-colors disabled:opacity-50 ${className}`}
        />
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

export const EditorialTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function EditorialTextarea({ className = '', ...props }, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className={`block w-full px-4 py-3 bg-white border border-[#d8d4d3] rounded-[10px] text-[15px] text-[#161412] placeholder-[#828181] focus:outline-none focus:border-[#722F37] focus:ring-2 focus:ring-[#722F37]/20 transition-colors resize-y ${className}`}
      />
    );
  },
);

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function EditorialPrimaryButton({
  children,
  className = '',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'md' | 'lg' }) {
  const height = size === 'lg' ? 'h-[52px] px-6 text-[15px]' : 'h-11 px-5 text-sm';
  return (
    <button
      {...props}
      className={`w-full inline-flex items-center justify-center gap-2 ${height} rounded-[10px] bg-[#722F37] text-white font-medium hover:bg-[#6B1818] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function EditorialSecondaryButton({
  children,
  className = '',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'md' | 'lg' }) {
  const height = size === 'lg' ? 'h-[52px] px-6 text-[15px]' : 'h-11 px-5 text-sm';
  return (
    <button
      {...props}
      className={`w-full inline-flex items-center justify-center gap-2 ${height} rounded-[10px] bg-white text-[#722F37] border border-[#d8d4d3] font-medium hover:border-[#722F37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline link (för "Glömt lösenord", "Skapa konto" etc.)
// ---------------------------------------------------------------------------

export function EditorialInlineLink({
  children,
  className = '',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      className={`text-[#722F37] font-medium hover:underline ${className}`}
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

export function EditorialFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-5 p-3.5 rounded-[10px] bg-[#fef2f2] border border-[#fecaca] text-sm text-[#991b1b] flex items-start gap-2.5">
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Divider with centered label ("eller")
// ---------------------------------------------------------------------------

export function EditorialDivider({ label }: { label?: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[#d8d4d3]" />
      </div>
      {label && (
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-white text-[#828181]">{label}</span>
        </div>
      )}
    </div>
  );
}
