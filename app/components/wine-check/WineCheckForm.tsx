/**
 * WINE CHECK FORM
 *
 * Input form for Wine Check
 * - Wine name (required)
 * - Vintage (optional)
 * - Submit button with loading state
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WineCheckFormProps {
  name: string;
  vintage: string;
  onChangeName: (name: string) => void;
  onChangeVintage: (vintage: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  hideVintage?: boolean;
  compact?: boolean;
}

export function WineCheckForm({
  name,
  vintage,
  onChangeName,
  onChangeVintage,
  onSubmit,
  loading = false,
  hideVintage = false,
  compact = false
}: WineCheckFormProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && name.trim()) {
      onSubmit();
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* Wine Name Input */}
      <div className="space-y-1.5">
        <Label htmlFor="wine-name">
          Vinnamn *
        </Label>
        <Input
          id="wine-name"
          type="text"
          placeholder="t.ex. Château Margaux"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
      </div>

      {/* Vintage Input (optional) */}
      {!hideVintage && (
        <div className="space-y-1.5">
          <Label htmlFor="vintage">
            Årgång (valfritt)
          </Label>
          <Input
            id="vintage"
            type="text"
            placeholder="t.ex. 2015"
            value={vintage}
            onChange={(e) => onChangeVintage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={onSubmit}
        disabled={loading || !name.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
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
            Kontrollerar...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Kontrollera vin
          </>
        )}
      </Button>
    </div>
  );
}
