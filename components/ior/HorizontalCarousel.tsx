/**
 * HORIZONTAL CAROUSEL
 *
 * Netflix-style horizontal scrolling carousel with:
 * - CSS scroll-snap for smooth snapping
 * - Keyboard navigation (arrow keys)
 * - Optional navigation arrows
 * - Touch/swipe support (native)
 */

'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HorizontalCarouselProps {
  /** Section title */
  title: string;
  /** Optional subtitle or count */
  subtitle?: string;
  /** Carousel items */
  children: ReactNode;
  /** Show navigation arrows (default: true on desktop) */
  showArrows?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom empty state component */
  emptyState?: ReactNode;
  /** Whether there are items */
  isEmpty?: boolean;
  /** Optional action button in header */
  action?: ReactNode;
  /** Additional class for container */
  className?: string;
}

export function HorizontalCarousel({
  title,
  subtitle,
  children,
  showArrows = true,
  emptyMessage = 'Inga objekt att visa',
  emptyState,
  isEmpty = false,
  action,
  className,
}: HorizontalCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const cardWidth = 288; // w-72 = 18rem = 288px
    const scrollAmount = cardWidth * 2; // Scroll 2 cards at a time

    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scroll('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scroll('right');
    }
  };

  return (
    <section className={cn('py-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {/* Desktop arrows */}
          {showArrows && !isEmpty && (
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  canScrollLeft
                    ? 'hover:bg-gray-100 text-gray-600'
                    : 'text-gray-300 cursor-not-allowed'
                )}
                aria-label="Scrolla vänster"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  canScrollRight
                    ? 'hover:bg-gray-100 text-gray-600'
                    : 'text-gray-300 cursor-not-allowed'
                )}
                aria-label="Scrolla höger"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Carousel or Empty State */}
      {isEmpty ? (
        <div className="px-4 lg:px-6">
          {emptyState || (
            <div className="py-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              {emptyMessage}
            </div>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className={cn(
            'flex gap-4 overflow-x-auto px-4 lg:px-6 pb-2',
            'scroll-smooth snap-x snap-mandatory',
            'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
          )}
          role="list"
          aria-label={title}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Carousel Item wrapper - ensures proper sizing and snap alignment
 */
export function CarouselItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex-shrink-0 snap-start',
        'w-72', // Fixed width for consistency
        className
      )}
      role="listitem"
    >
      {children}
    </div>
  );
}
