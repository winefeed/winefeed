'use client';

import { ReactNode, useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  children?: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  icon?: 'help' | 'info';
  className?: string;
}

/**
 * Reusable help tooltip component for explaining terms and features
 * Use this for MOQ, provorder, and other wine industry terms
 */
export function HelpTooltip({
  content,
  children,
  side = 'top',
  icon = 'help',
  className = ''
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrows = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2',
    left: 'right-[-4px] top-1/2 -translate-y-1/2',
    right: 'left-[-4px] top-1/2 -translate-y-1/2',
  };

  const IconComponent = icon === 'help' ? HelpCircle : Info;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsVisible(!isVisible);
        }}
        className="cursor-help p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Visa hjälptext"
      >
        {children || <IconComponent className="h-4 w-4" />}
      </button>
      {isVisible && (
        <div
          className={`absolute ${positions[side]} z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-[250px] text-left`}
          role="tooltip"
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${arrows[side]}`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Inline help text for form fields - appears below the field
 */
export function HelpText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground mt-1 ${className}`}>
      {children}
    </p>
  );
}

/**
 * Info box for important explanations - more prominent than help text
 */
export function InfoBox({
  title,
  children,
  variant = 'info'
}: {
  title?: string;
  children: ReactNode;
  variant?: 'info' | 'warning' | 'success';
}) {
  const variants = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };

  const icons = {
    info: <Info className="h-4 w-4 flex-shrink-0" />,
    warning: <Info className="h-4 w-4 flex-shrink-0" />,
    success: <Info className="h-4 w-4 flex-shrink-0" />,
  };

  return (
    <div className={`rounded-lg border p-3 ${variants[variant]}`}>
      <div className="flex gap-2">
        {icons[variant]}
        <div className="text-sm">
          {title && <p className="font-medium mb-1">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Glossary definitions for wine industry terms
 */
export const GLOSSARY = {
  moq: 'Minsta orderantal (MOQ) är det minsta antalet flaskor du måste beställa av ett vin. Detta sätts av leverantören.',
  provorder: 'Provorder låter dig beställa färre flaskor än MOQ mot en extra avgift. Perfekt för att testa ett nytt vin innan större inköp.',
  vintage: 'Årgång (vintage) är det år druvorna skördades. NV betyder "Non-Vintage" - en blandning av flera årgångar.',
  franco: 'Franco betyder att frakten ingår i priset. Du betalar inget extra för leverans.',
  leadtime: 'Ledtid är antal dagar från beställning till leverans. Vissa viner skickas direkt från producenten i EU.',
  exMoms: 'Ex moms betyder att priset visas utan moms (25%). Momsen läggs till vid fakturering.',
  winRate: 'Andelen av dina skickade offerter som accepteras av restauranger.',
  responseRate: 'Andelen förfrågningar du svarar på. Hög svarsfrekvens ger bättre synlighet.',
};
