/**
 * Winefeed Logo Component
 *
 * CSS-rendered diamond logo matching grafisk profil
 * Colors: Crème #E8DFC4, Rosé #E8B4B8, Vinröd #7A1B2D
 */

import { cn } from '@/lib/utils';

interface WinefeedLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

const sizes = {
  sm: { diamond: 'w-2.5 h-2.5', text: 'text-lg', tagline: 'text-[8px]', gap: 'mr-2' },
  md: { diamond: 'w-3 h-3', text: 'text-2xl', tagline: 'text-[9px]', gap: 'mr-3' },
  lg: { diamond: 'w-4 h-4', text: 'text-3xl', tagline: 'text-[10px]', gap: 'mr-4' },
};

export function WinefeedLogo({
  size = 'md',
  showText = true,
  showTagline = false,
  className
}: WinefeedLogoProps) {
  const s = sizes[size];

  return (
    <div className={cn('inline-flex items-center', className)}>
      {/* Diamond shapes */}
      <div className={cn('flex items-center', s.gap)}>
        <span
          className={cn(s.diamond, 'rotate-45 -mr-1')}
          style={{ backgroundColor: '#E8DFC4' }}
        />
        <span
          className={cn(s.diamond, 'rotate-45 -mr-1 opacity-85')}
          style={{ backgroundColor: '#E8B4B8' }}
        />
        <span
          className={cn(s.diamond, 'rotate-45')}
          style={{ backgroundColor: '#7A1B2D' }}
        />
      </div>

      {showText && (
        <div>
          <span className={cn(s.text, 'font-sans')} style={{ color: '#7A1B2D' }}>
            <span className="font-bold">wine</span>
            <span className="font-light">feed</span>
          </span>
          {showTagline && (
            <p
              className={cn(s.tagline, 'tracking-[0.2em] uppercase mt-0.5')}
              style={{ color: '#b89a9e' }}
            >
              SOURCE & SERVE
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function WinefeedLogoDiamonds({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <span
        className="w-3 h-3 rotate-45 -mr-1"
        style={{ backgroundColor: '#E8DFC4' }}
      />
      <span
        className="w-3.5 h-3.5 rotate-45 -mr-1 opacity-85"
        style={{ backgroundColor: '#E8B4B8' }}
      />
      <span
        className="w-3 h-3 rotate-45"
        style={{ backgroundColor: '#7A1B2D' }}
      />
    </div>
  );
}
