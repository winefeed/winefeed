'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Wine, MapPin, Package, Calendar, CheckCircle, ArrowLeft, Send, Plus, Building2 } from 'lucide-react';

// Wine color options - matches database enum (wine_color)
// Valid values: red, white, rose, sparkling, orange, fortified
const WINE_COLORS = [
  { value: 'all', label: 'Alla typer', emoji: '🍷' },
  { value: 'sparkling', label: 'Mousserande', emoji: '🍾' },
  { value: 'white', label: 'Vitt', emoji: '🥂' },
  { value: 'rose', label: 'Rosé', emoji: '🌸' },
  { value: 'orange', label: 'Orange', emoji: '🍊' },
  { value: 'red', label: 'Rött', emoji: '🍷' },
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

// Common grape varieties (alphabetically sorted)
const GRAPE_VARIETIES = [
  { value: 'all', label: 'Alla druvor' },
  { value: 'Cabernet Sauvignon', label: 'Cabernet Sauvignon' },
  { value: 'Chardonnay', label: 'Chardonnay' },
  { value: 'Chenin Blanc', label: 'Chenin Blanc' },
  { value: 'Merlot', label: 'Merlot' },
  { value: 'Nebbiolo', label: 'Nebbiolo' },
  { value: 'Pinot Grigio', label: 'Pinot Grigio' },
  { value: 'Pinot Noir', label: 'Pinot Noir' },
  { value: 'Riesling', label: 'Riesling' },
  { value: 'Sangiovese', label: 'Sangiovese' },
  { value: 'Sauvignon Blanc', label: 'Sauvignon Blanc' },
  { value: 'Syrah', label: 'Syrah/Shiraz' },
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
  leverans_ort: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  description: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface SavedAddress {
  id: string;
  label: string;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  is_default: boolean;
}

interface RequestFormProps {
  onSuccess?: (requestId: string) => void;
}

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingData, setPendingData] = useState<RequestFormData | null>(null);
  const [supplierMessage, setSupplierMessage] = useState('');
  const [prefillLoaded, setPrefillLoaded] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'manual'>('manual');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [sendToSuppliers, setSendToSuppliers] = useState(true); // Default checked

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
      leverans_ort: '',
      description: '',
    },
  });

  const selectedColor = watch('color');

  // Prefill delivery city from restaurant profile and fetch saved addresses
  useEffect(() => {
    if (prefillLoaded) return;

    async function fetchInitialData() {
      try {
        // Fetch saved addresses
        const addressRes = await fetch('/api/me/addresses');
        if (addressRes.ok) {
          const addressData = await addressRes.json();
          setSavedAddresses(addressData.addresses || []);

          // If there's a default address, select it
          const defaultAddr = addressData.addresses?.find((a: SavedAddress) => a.is_default);
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setValue('leverans_ort', defaultAddr.city);
          }
        }

        // If no default address, try to get city from restaurant profile
        if (!watch('leverans_ort')) {
          const res = await fetch('/api/me/restaurant');
          if (res.ok) {
            const data = await res.json();
            if (data.city) {
              setValue('leverans_ort', data.city);
            }
          }
        }
      } catch (err) {
        // Silently fail - user can enter manually
      } finally {
        setPrefillLoaded(true);
      }
    }

    fetchInitialData();
  }, [prefillLoaded, setValue, watch]);

  const toggleCertification = (certId: string) => {
    setSelectedCertifications((prev) =>
      prev.includes(certId)
        ? prev.filter((id) => id !== certId)
        : [...prev, certId]
    );
  };

  // Handle address selection
  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);

    if (addressId === 'manual') {
      // Keep current value or clear
      return;
    }

    const address = savedAddresses.find((a) => a.id === addressId);
    if (address) {
      setValue('leverans_ort', address.city);
    }
  };

  // Save new address
  const handleSaveAddress = async () => {
    const currentCity = watch('leverans_ort');
    if (!currentCity || !newAddressLabel.trim()) return;

    try {
      const res = await fetch('/api/me/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newAddressLabel.trim(),
          address_line1: currentCity, // Simplified - just city for now
          postal_code: '000 00', // Placeholder
          city: currentCity,
          is_default: savedAddresses.length === 0, // First address is default
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedAddresses((prev) => [...prev, data.address]);
        setSelectedAddressId(data.address.id);
        setShowAddAddress(false);
        setNewAddressLabel('');
      }
    } catch (err) {
      // Silently fail
    }
  };

  // Show confirmation modal instead of submitting directly
  const onSubmit = async (data: RequestFormData) => {
    setPendingData(data);
    setShowConfirmation(true);
    setError(null);
  };

  // Actually submit the request after confirmation
  const handleConfirmedSubmit = async () => {
    if (!pendingData) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build the request with structured data
      const requestData = {
        // Structured filters (for SQL)
        color: pendingData.color === 'all' ? null : pendingData.color,
        budget_max: pendingData.budget_max,
        antal_flaskor: pendingData.antal_flaskor,
        country: pendingData.country === 'all' ? null : pendingData.country,
        grape: pendingData.grape === 'all' ? null : pendingData.grape,
        leverans_senast: pendingData.leverans_senast || null,
        leverans_ort: pendingData.leverans_ort, // Delivery city for shipping calculation
        certifications: selectedCertifications.length > 0 ? selectedCertifications : null,
        // Free text for AI ranking
        description: pendingData.description || null,
        // Message to suppliers (new field)
        supplier_message: supplierMessage || null,
        // Send to suppliers flag - only dispatch if user confirms
        send_to_suppliers: sendToSuppliers,
        // Legacy field - build fritext from structured data for backwards compatibility
        fritext: buildFritext(pendingData, selectedCertifications),
        budget_per_flaska: pendingData.budget_max, // Legacy field
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
      setShowConfirmation(false);
      onSuccess?.(result.request_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel');
    } finally {
      setIsLoading(false);
    }
  };

  // Get labels for display
  const getColorLabel = (value: string) => WINE_COLORS.find(c => c.value === value)?.label || value;
  const getColorEmoji = (value: string) => WINE_COLORS.find(c => c.value === value)?.emoji || '';
  const getCountryLabel = (value: string) => WINE_COUNTRIES.find(c => c.value === value)?.label || value;
  const getGrapeLabel = (value: string) => GRAPE_VARIETIES.find(g => g.value === value)?.label || value;

  // Confirmation Modal
  if (showConfirmation && pendingData) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Bekräfta din förfrågan</h2>
          <button
            onClick={() => setShowConfirmation(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            Vad du söker
          </h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Wine type */}
            <div>
              <span className="text-gray-500">Vintyp:</span>
              <p className="font-medium">
                {getColorEmoji(pendingData.color)} {getColorLabel(pendingData.color)}
              </p>
            </div>

            {/* Budget */}
            <div>
              <span className="text-gray-500">Max budget:</span>
              <p className="font-medium">{pendingData.budget_max} kr/flaska</p>
            </div>

            {/* Quantity */}
            <div>
              <span className="text-gray-500">Antal:</span>
              <p className="font-medium">{pendingData.antal_flaskor} flaskor</p>
            </div>

            {/* Country */}
            {pendingData.country && pendingData.country !== 'all' && (
              <div>
                <span className="text-gray-500">Land:</span>
                <p className="font-medium">{getCountryLabel(pendingData.country)}</p>
              </div>
            )}

            {/* Grape */}
            {pendingData.grape && pendingData.grape !== 'all' && (
              <div>
                <span className="text-gray-500">Druva:</span>
                <p className="font-medium">{getGrapeLabel(pendingData.grape)}</p>
              </div>
            )}

            {/* Certifications */}
            {selectedCertifications.length > 0 && (
              <div className="col-span-2">
                <span className="text-gray-500">Certifieringar:</span>
                <div className="flex gap-2 mt-1">
                  {selectedCertifications.map(cert => (
                    <span key={cert} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {CERTIFICATIONS.find(c => c.id === cert)?.label || cert}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {pendingData.description && (
            <div className="pt-3 border-t border-gray-200">
              <span className="text-gray-500 text-sm">Övriga önskemål:</span>
              <p className="text-sm mt-1">{pendingData.description}</p>
            </div>
          )}
        </div>

        {/* Delivery info */}
        <div className="bg-gray-50 rounded-lg p-5 space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Leverans
          </h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Leveransort:</span>
              <p className="font-medium">{pendingData.leverans_ort}</p>
            </div>

            {pendingData.leverans_senast && (
              <div>
                <span className="text-gray-500">Senast:</span>
                <p className="font-medium">
                  {new Date(pendingData.leverans_senast).toLocaleDateString('sv-SE')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Send to suppliers checkbox */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendToSuppliers}
              onChange={(e) => setSendToSuppliers(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary h-5 w-5"
            />
            <div>
              <span className="font-medium text-gray-900">
                Skicka till leverantörer för att få offerter
              </span>
              <p className="text-sm text-muted-foreground mt-1">
                Inget beställs nu - du får offerter att jämföra och kan välja själv
              </p>
            </div>
          </label>
        </div>

        {/* Message to suppliers - only show if sending to suppliers */}
        {sendToSuppliers && (
          <div className="space-y-2">
            <Label htmlFor="supplier_message">Meddelande till leverantörer (valfritt)</Label>
            <Textarea
              id="supplier_message"
              value={supplierMessage}
              onChange={(e) => setSupplierMessage(e.target.value)}
              placeholder="T.ex. 'Vi planerar en vinprovning för 20 gäster'"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Detta meddelande visas för alla leverantörer som får din förfrågan
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 border border-destructive bg-destructive/10 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowConfirmation(false)}
            className="flex-1"
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ändra
          </Button>
          <Button
            type="button"
            onClick={handleConfirmedSubmit}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              'Skickar...'
            ) : sendToSuppliers ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Skicka till leverantörer
              </>
            ) : (
              <>
                <Wine className="h-4 w-4 mr-2" />
                Visa vinförslag
              </>
            )}
          </Button>
        </div>

        {/* Trust text */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {sendToSuppliers
              ? 'Din förfrågan skickas till utvalda leverantörer. Ingen förpliktelse.'
              : 'Du får vinförslag baserat på dina kriterier. Ingen förfrågan skickas.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Wine Color Selection */}
      <div className="space-y-3">
        <Label>Vintyp</Label>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
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
        <Label htmlFor="budget_max">Max budget per flaska (SEK ex moms)</Label>
        <Input
          id="budget_max"
          type="number"
          step="10"
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

      {/* Delivery Location */}
      <div className="space-y-3">
        <Label>Leveransort (valfritt)</Label>

        {/* Saved addresses selector */}
        {savedAddresses.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => handleAddressSelect(addr.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    selectedAddressId === addr.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{addr.label}</span>
                  <span className="text-muted-foreground">({addr.city})</span>
                  {addr.is_default && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Standard</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleAddressSelect('manual')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  selectedAddressId === 'manual'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <MapPin className="h-4 w-4" />
                <span>Annan ort</span>
              </button>
            </div>
          </div>
        )}

        {/* Manual input (always shown if manual selected or no saved addresses) */}
        {(selectedAddressId === 'manual' || savedAddresses.length === 0) && (
          <div className="space-y-2">
            <Input
              id="leverans_ort"
              type="text"
              placeholder="T.ex. Stockholm, Malmö, Göteborg"
              {...register('leverans_ort')}
            />

            {/* Save address option */}
            {watch('leverans_ort') && !showAddAddress && (
              <button
                type="button"
                onClick={() => setShowAddAddress(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Spara som leveransadress
              </button>
            )}

            {showAddAddress && (
              <div className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg">
                <Input
                  type="text"
                  placeholder="Namn på adressen (t.ex. Huvudrestaurang)"
                  value={newAddressLabel}
                  onChange={(e) => setNewAddressLabel(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAddress}
                  disabled={!newAddressLabel.trim()}
                >
                  Spara
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddAddress(false);
                    setNewAddressLabel('');
                  }}
                >
                  Avbryt
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {savedAddresses.length > 0
            ? 'Välj en sparad adress eller ange annan ort'
            : 'Du kan ange leveransort nu eller senare när du valt viner'}
        </p>
        {errors.leverans_ort && (
          <p className="text-sm text-destructive">{errors.leverans_ort.message}</p>
        )}
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
        Granska och skicka
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

  // Delivery location
  if (data.leverans_ort) {
    parts.push(`leverans till ${data.leverans_ort}`);
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
