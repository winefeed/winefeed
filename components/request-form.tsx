'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const requestSchema = z.object({
  fritext: z.string().min(10, 'Beskriv dina behov mer detaljerat (minst 10 tecken)'),
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      budget_per_flaska: 200,
      antal_flaskor: 20,
    },
  });

  const onSubmit = async (data: RequestFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
            placeholder="20"
            {...register('antal_flaskor')}
          />
          {errors.antal_flaskor && (
            <p className="text-sm text-destructive">{errors.antal_flaskor.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget_per_flaska">Maxbudget per flaska (kr)</Label>
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

      <div className="space-y-2">
        <Label>Specialkrav (valfritt)</Label>
        <p className="text-xs text-muted-foreground">
          Exempel: naturvin, låg alkohol, specifik region, fast pris
        </p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="ekologiskt" className="rounded" />
            <span className="text-sm">Ekologiskt</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="biodynamiskt" className="rounded" />
            <span className="text-sm">Biodynamiskt</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="veganskt" className="rounded" />
            <span className="text-sm">Veganskt</span>
          </label>
        </div>
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
