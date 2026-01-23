'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

// Filter configuration - easily extensible for future filters
type FilterType = 'certification' | 'region' | 'grape' | 'style';

interface FilterOption {
  id: string;
  label: string;
  type: FilterType;
  description?: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    id: 'ekologiskt',
    label: 'Ekologiskt',
    type: 'certification',
    description: 'Certifierat ekologiskt vin',
  },
  {
    id: 'biodynamiskt',
    label: 'Biodynamiskt',
    type: 'certification',
    description: 'Certifierat biodynamiskt vin',
  },
  {
    id: 'veganskt',
    label: 'Veganskt',
    type: 'certification',
    description: 'Certifierat veganskt vin',
  },
  // Future filters can be added here:
  // { id: 'italien', label: 'Italien', type: 'region' },
  // { id: 'frankrike', label: 'Frankrike', type: 'region' },
  // { id: 'pinot-noir', label: 'Pinot Noir', type: 'grape' },
];

// Quick-select wine type tags
const WINE_TYPE_TAGS = [
  { id: 'rött', label: '🍷 Rött', text: 'rödvin' },
  { id: 'vitt', label: '🥂 Vitt', text: 'vitt vin' },
  { id: 'rosé', label: '🌸 Rosé', text: 'rosévin' },
  { id: 'mousserande', label: '🍾 Mousserande', text: 'mousserande vin' },
  { id: 'champagne', label: '✨ Champagne', text: 'champagne' },
  { id: 'dessert', label: '🍯 Dessert', text: 'dessertvin' },
];

const requestSchema = z.object({
  fritext: z.string().min(1, 'Beskriv vad du söker'),
  budget_per_flaska: z.coerce
    .number()
    .min(50, 'Budget måste vara minst 50 kr')
    .max(5000, 'Budget får max vara 5000 kr'),
  antal_flaskor: z.coerce
    .number()
    .min(1, 'Minst 1 flaska')
    .max(1000, 'Max 1000 flaskor'),
  leverans_senast: z.string().optional(),
  specialkrav: z.array(z.string()).optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestFormProps {
  onSuccess?: (requestId: string) => void;
}

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      budget_per_flaska: 200,
      antal_flaskor: 24,
      fritext: '',
    },
  });

  const fritextValue = watch('fritext');

  // Add wine type tag to fritext
  const addWineTypeTag = (text: string) => {
    const currentText = fritextValue || '';
    const newText = currentText ? `${currentText} ${text}` : text;
    setValue('fritext', newText);
  };

  // Toggle filter selection
  const toggleFilter = (filterId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  // Remove filter
  const removeFilter = (filterId: string) => {
    setSelectedFilters((prev) => prev.filter((id) => id !== filterId));
  };

  // Get filter label by id
  const getFilterLabel = (filterId: string) => {
    return FILTER_OPTIONS.find((f) => f.id === filterId)?.label || filterId;
  };

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Include selected filters in the request
      const requestData = {
        ...data,
        specialkrav: selectedFilters.length > 0 ? selectedFilters : undefined,
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
      // Spara suggestions i sessionStorage så resultatsidan kan hämta dem
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
      <div className="space-y-2">
        <Label htmlFor="fritext">Beskriv vad du behöver</Label>
        <Textarea
          id="fritext"
          placeholder="Behöver 20 flaskor italienska rödviner till vår nya pasta-meny. Budget 150-250 kr/flaska. Leverans inom 2 veckor."
          rows={4}
          {...register('fritext')}
        />

        {/* Quick-select wine type tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {WINE_TYPE_TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addWineTypeTag(tag.text)}
              className="px-3 py-1.5 text-sm rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors"
            >
              {tag.label}
            </button>
          ))}
        </div>

        {errors.fritext && (
          <p className="text-sm text-destructive">{errors.fritext.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
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

        <div className="space-y-2">
          <Label htmlFor="budget_per_flaska">Maxbudget per flaska (kr ex moms)</Label>
          <Input
            id="budget_per_flaska"
            type="number"
            placeholder="200"
            {...register('budget_per_flaska')}
          />
          {errors.budget_per_flaska && (
            <p className="text-sm text-destructive">{errors.budget_per_flaska.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leverans_senast">Leverans senast (valfritt)</Label>
        <Input
          id="leverans_senast"
          type="date"
          {...register('leverans_senast')}
        />
      </div>

      {/* Certification Filters */}
      <div className="space-y-3">
        <div>
          <Label>Certifieringar (valfritt)</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Filtrera viner baserat på certifieringar
          </p>
        </div>

        {/* Checkboxes */}
        <div className="flex flex-wrap gap-3">
          {FILTER_OPTIONS.filter((f) => f.type === 'certification').map((filter) => (
            <label
              key={filter.id}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <input
                type="checkbox"
                checked={selectedFilters.includes(filter.id)}
                onChange={(e) => toggleFilter(filter.id)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm">{filter.label}</span>
            </label>
          ))}
        </div>

        {/* Selected Filters as Chips */}
        {selectedFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground self-center">
              Valda filter:
            </span>
            {selectedFilters.map((filterId) => (
              <Badge
                key={filterId}
                variant="secondary"
                className="flex items-center gap-1.5 pl-3 pr-2 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <span>{getFilterLabel(filterId)}</span>
                <button
                  type="button"
                  onClick={() => removeFilter(filterId)}
                  className="hover:text-destructive transition-colors"
                  aria-label={`Ta bort ${getFilterLabel(filterId)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 border border-destructive bg-destructive/10 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Tidsförvänttan */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-3">
          ⏱️ Tar ca 30 sekunder
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
        {isLoading ? 'Hämtar förslag...' : 'Få offertförslag'}
      </Button>

      {/* Mikro-trygghet */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Du får jämförbara vinförslag och kontaktuppgifter till leverantörer. Ingen förpliktelse.
        </p>
      </div>
    </form>
  );
}
