'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewImportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    restaurant_id: '',
    importer_id: '',
    delivery_location_id: '',
    supplier_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/imports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': '00000000-0000-0000-0000-000000000001',
          'x-user-id': '00000000-0000-0000-0000-000000000001'
        },
        body: JSON.stringify({
          restaurant_id: formData.restaurant_id,
          importer_id: formData.importer_id,
          delivery_location_id: formData.delivery_location_id,
          supplier_id: formData.supplier_id || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create import case');
      }

      const data = await response.json();
      router.push(`/imports/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/10 via-background to-secondary/10">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📦</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Import Case</h1>
              <p className="text-sm text-primary-foreground/80">Skapa nytt importärende</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form Section */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Skapa Import Case
            </h2>
            <p className="text-muted-foreground">
              Fyll i alla obligatoriska fält för att skapa ett nytt importärende
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">❌ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Restaurant ID */}
            <div className="space-y-2">
              <Label htmlFor="restaurant_id">Restaurant ID *</Label>
              <Input
                id="restaurant_id"
                type="text"
                required
                placeholder="UUID för restaurang"
                value={formData.restaurant_id}
                onChange={(e) => setFormData({ ...formData, restaurant_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                UUID för den restaurang som ska ta emot importen
              </p>
            </div>

            {/* Importer ID */}
            <div className="space-y-2">
              <Label htmlFor="importer_id">Importer ID *</Label>
              <Input
                id="importer_id"
                type="text"
                required
                placeholder="UUID för importör"
                value={formData.importer_id}
                onChange={(e) => setFormData({ ...formData, importer_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                UUID för den godkända importör som hanterar importen
              </p>
            </div>

            {/* Delivery Location ID */}
            <div className="space-y-2">
              <Label htmlFor="delivery_location_id">Delivery Location ID *</Label>
              <Input
                id="delivery_location_id"
                type="text"
                required
                placeholder="UUID för leveransplats"
                value={formData.delivery_location_id}
                onChange={(e) => setFormData({ ...formData, delivery_location_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                UUID för godkänd direkt leveransplats (DDL)
              </p>
            </div>

            {/* Supplier ID (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier ID (valfri)</Label>
              <Input
                id="supplier_id"
                type="text"
                placeholder="UUID för leverantör (valfri)"
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Valfritt: UUID för specifik leverantör
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Skapar...' : 'Skapa Import Case'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Avbryt
              </Button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-6 bg-muted/30 border border-border rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Tips för att hitta ID:n</p>
              <p className="mb-3">
                Du behöver UUID:n för restaurang, importör och leveransplats. Dessa finns i respektive system.
              </p>
              <p className="text-xs">
                För test kan du använda: <code className="bg-muted px-2 py-1 rounded">11111111-1111-1111-1111-111111111111</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
