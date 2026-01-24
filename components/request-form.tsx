'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Wine color options - matches database enum
const WINE_COLORS = [
  { value: 'all', label: 'Alla typer', emoji: '🍷' },
  { value: 'sparkling', label: 'Mousserande', emoji: '🍾' },
  { value: 'white', label: 'Vitt', emoji: '🥂' },
  { value: 'rose', label: 'Rosé', emoji: '🌸' },
  { value: 'orange', label: 'Orange', emoji: '🍊' },
  { value: 'red', label: 'Rött', emoji: '🍷' },
  { value: 'sweet', label: 'Sött', emoji: '🍯' },
  { value: 'fortified', label: 'Starkvin', emoji: '🥃' },
] as const;

// Common wine countries
const WINE_COUNTRIES = [
  { value: 'all', label: 'Alla länder' },
  { value: 'France', label: 'Frankrike' },
  { value: 'Italy', label: 'Italien' },
  { value: 'Spain', label: 'Spanien' },
  { value: 'Germany', label: 'Tyskland' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Austria', label: 'Österrike' },
  { value: 'USA', label: 'USA' },
  { value: 'Australia', label: 'Australien' },
  { value: 'New Zealand', label: 'Nya Zeeland' },
  { value: 'Chile', label: 'Chile' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'South Africa', label: 'Sydafrika' },
  { value: 'other', label: 'Övriga länder' },
] as const;

// Common grape varieties
const GRAPE_VARIETIES = [
  { value: 'all', label: 'Alla druvor' },
  // Red grapes
  { value: 'Cabernet Sauvignon', label: 'Cabernet Sauvignon' },
  { value: 'Merlot', label: 'Merlot' },
  { value: 'Pinot Noir', label: 'Pinot Noir' },
  { value: 'Syrah', label: 'Syrah/Shiraz' },
  { value: 'Sangiovese', label: 'Sangiovese' },
  { value: 'Tempranillo', label: 'Tempranillo' },
  { value: 'Nebbiolo', label: 'Nebbiolo' },
  { value: 'Grenache', label: 'Grenache' },
  { value: 'Malbec', label: 'Malbec' },
  { value: 'Zinfandel', label: 'Zinfandel' },
  // White grapes
  { value: 'Chardonnay', label: 'Chardonnay' },
  { value: 'Sauvignon Blanc', label: 'Sauvignon Blanc' },
  { value: 'Riesling', label: 'Riesling' },
  { value: 'Pinot Grigio', label: 'Pinot Grigio' },
  { value: 'Gewürztraminer', label: 'Gewürztraminer' },
  { value: 'Viognier', label: 'Viognier' },
  { value: 'Grüner Veltliner', label: 'Grüner Veltliner' },
  { value: 'Albariño', label: 'Albariño' },
  { value: 'Chenin Blanc', label: 'Chenin Blanc' },
  // Other
  { value: 'other', label: 'Övriga druvor' },
] as const;

// Certifications
const CERTIFICATIONS = [
  { id: 'ekologiskt', label: 'Ekologiskt' },
  { id: 'biodynamiskt', label: 'Biodynamiskt' },
  { id: 'veganskt', label: 'Veganskt' },
] as const;

const requestSchema = z.object({
  color: z.string().min(1, 'Välj vintyp'),
  budget_max: z.coerce
    .number()
    .min(50, 'Budget måste vara minst 50 kr')
    .max(10000, 'Budget får vara högst 10 000 kr'),
  antal_flaskor: z.coerce
    .number()
    .min(1, 'Minst 1 flaska')
    .max(10000, 'Max 10 000 flaskor'),
  country: z.string().optional(),
  grape: z.string().optional(),
  leverans_senast: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  description: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestFormProps {
  onSuccess?: (requestId: string) => void;
}

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      color: 'all',
      budget_max: 200,
      antal_flaskor: 24,
      country: 'all',
      grape: 'all',
      description: '',
    },
  });

  const selectedColor = watch('color');

  const toggleCertification = (certId: string) => {
    setSelectedCertifications((prev) =>
      prev.includes(certId)
        ? prev.filter((id) => id !== certId)
        : [...prev, certId]
    );
  };

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Build the request with structured data
      const requestData = {
        // Structured filters (for SQL)
        color: data.color === 'all' ? null : data.color,
        budget_max: data.budget_max,
        antal_flaskor: data.antal_flaskor,
        country: data.country === 'all' ? null : data.country,
        grape: data.grape === 'all' ? null : data.grape,
        leverans_senast: data.leverans_senast || null,
        certifications: selectedCertifications.length > 0 ? selectedCertifications : null,
        // Free text for AI ranking
        description: data.description || null,
        // Legacy field - build fritext from structured data for backwards compatibility
        fritext: buildFritext(data, selectedCertifications),
        budget_per_flaska: data.budget_max, // Legacy field
        specialkrav: selectedCertifications.length > 0 ? selectedCertifications : undefined,
      };

      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Något gick fel');
      }

      const result = await response.json();
      sessionStorage.setItem('latest-suggestions', JSON.stringify(result.suggestions));
      onSuccess?.(result.request_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Wine Color Selection */}
      <div className="space-y-3">
        <Label>Vintyp</Label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {WINE_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setValue('color', color.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                selectedColor === color.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl">{color.emoji}</span>
              <span className="text-xs font-medium">{color.label}</span>
            </button>
          ))}
        </div>
        {errors.color && (
          <p className="text-sm text-destructive">{errors.color.message}</p>
        )}
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <Label htmlFor="budget_max">Max budget per flaska (kr ex moms)</Label>
        <Input
          id="budget_max"
          type="number"
          placeholder="200"
          {...register('budget_max')}
        />
        {errors.budget_max && (
          <p className="text-sm text-destructive">{errors.budget_max.message}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="antal_flaskor">Antal flaskor</Label>
        <Input
          id="antal_flaskor"
          type="number"
          placeholder="24"
          {...register('antal_flaskor')}
        />
        {errors.antal_flaskor && (
          <p className="text-sm text-destructive">{errors.antal_flaskor.message}</p>
        )}
      </div>

      {/* Country & Grape - collapsible */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="country">Land (valfritt)</Label>
          <select
            id="country"
            {...register('country')}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {WINE_COUNTRIES.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="grape">Druva (valfritt)</Label>
          <select
            id="grape"
            {...register('grape')}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {GRAPE_VARIETIES.map((grape) => (
              <option key={grape.value} value={grape.value}>
                {grape.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Delivery Date */}
      <div className="space-y-2">
        <Label htmlFor="leverans_senast">Leverans senast (valfritt)</Label>
        <Input
          id="leverans_senast"
          type="date"
          {...register('leverans_senast')}
        />
      </div>

      {/* Certifications */}
      <div className="space-y-3">
        <Label>Certifieringar (valfritt)</Label>
        <div className="flex flex-wrap gap-3">
          {CERTIFICATIONS.map((cert) => (
            <label
              key={cert.id}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <input
                type="checkbox"
                checked={selectedCertifications.includes(cert.id)}
                onChange={() => toggleCertification(cert.id)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm">{cert.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Free text description */}
      <div className="space-y-2">
        <Label htmlFor="description">Övriga önskemål (valfritt)</Label>
        <Textarea
          id="description"
          placeholder="T.ex. 'Ska passa till fisk och skaldjur', 'Elegant stil, inte för fruktigt', 'Viner för vinprovning med tema Piemonte'"
          rows={3}
          {...register('description')}
        />
        <p className="text-xs text-muted-foreground">
          Beskriv matpairing, stil eller andra preferenser
        </p>
      </div>

      {error && (
        <div className="p-4 border border-destructive bg-destructive/10 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Info box */}
      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">
          ⏱️ Tar ca 30 sekunder
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Du kan filtrera och förfina resultaten i nästa steg
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
        {isLoading ? 'Hämtar förslag...' : 'Få offertförslag'}
      </Button>

      {/* Trust text */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Du får jämförbara vinförslag. Ingen förpliktelse.
        </p>
      </div>
    </form>
  );
}

// Build fritext from structured data (for backwards compatibility and AI)
function buildFritext(data: RequestFormData, certifications: string[]): string {
  const parts: string[] = [];

  // Color
  const colorLabel = WINE_COLORS.find(c => c.value === data.color)?.label;
  if (data.color && data.color !== 'all') {
    parts.push(colorLabel || data.color);
  }

  // Country
  const countryLabel = WINE_COUNTRIES.find(c => c.value === data.country)?.label;
  if (data.country && data.country !== 'all') {
    parts.push(`från ${countryLabel || data.country}`);
  }

  // Grape
  if (data.grape && data.grape !== 'all') {
    parts.push(`druva: ${data.grape}`);
  }

  // Budget
  if (data.budget_max) {
    parts.push(`max ${data.budget_max} kr/flaska`);
  }

  // Quantity
  if (data.antal_flaskor) {
    parts.push(`${data.antal_flaskor} flaskor`);
  }

  // Certifications
  if (certifications.length > 0) {
    parts.push(certifications.join(', '));
  }

  // Description
  if (data.description) {
    parts.push(data.description);
  }

  return parts.join('. ') || 'Vin';
}
