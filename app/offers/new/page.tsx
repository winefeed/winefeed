/**
 * CREATE NEW OFFER PAGE - PILOT LOOP 1.0
 *
 * DB-driven: Creates offer via POST /api/offers and redirects to editor
 *
 * Flow:
 * 1. User fills form (restaurant_id, title, currency)
 * 2. Initialize 2 empty line items
 * 3. POST to /api/offers
 * 4. Redirect to /offers/[id]
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewOfferPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState('');
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('SEK');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!restaurantId.trim()) {
      setError('Restaurant ID is required');
      return;
    }

    setLoading(true);

    try {
      // Create offer with 2 empty line items
      const response = await fetch('/api/offers', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          title: title || undefined,
          currency: currency || 'SEK',
          lines: [
            {
              line_no: 1,
              name: '',
              vintage: null,
              quantity: 1,
              offered_unit_price_ore: null,
              bottle_ml: 750
            },
            {
              line_no: 2,
              name: '',
              vintage: null,
              quantity: 1,
              offered_unit_price_ore: null,
              bottle_ml: 750
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create offer');
      }

      const data = await response.json();

      // Redirect to offer editor
      router.push(`/offers/${data.offer_id}`);
    } catch (err: any) {
      console.error('Failed to create offer:', err);
      setError(err.message || 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📝</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ny Offert</h1>
              <p className="text-sm text-primary-foreground/80">Skapa multi-line offert</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Restaurant ID */}
            <div>
              <label htmlFor="restaurant-id" className="block text-sm font-medium text-foreground mb-2">
                Restaurant ID <span className="text-destructive">*</span>
              </label>
              <input
                id="restaurant-id"
                type="text"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                placeholder="UUID för restaurant"
                required
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Restaurant som skapar denna offert
              </p>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                Titel
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="T.ex. Veckovinsval, Specialerbjudande..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              />
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-foreground mb-2">
                Valuta
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              >
                <option value="SEK">SEK - Svenska kronor</option>
                <option value="EUR">EUR - Euro</option>
                <option value="USD">USD - US Dollar</option>
              </select>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">ℹ️ Vad händer nu?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Offert skapas med 2 tomma rader</li>
                <li>Du redirectas till editor</li>
                <li>Du kan lägga till fler rader och fylla i vindetaljer</li>
                <li>Wine Check kan användas för att verifiera viner</li>
              </ul>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-sm text-destructive">
                <p className="font-medium">Fel:</p>
                <p>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Skapar offert...' : '✓ Skapa offert'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                disabled={loading}
                className="px-4 py-3 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
