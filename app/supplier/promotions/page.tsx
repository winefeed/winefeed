'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Check,
  X,
  Loader2,
  AlertCircle,
  Crown,
  Star,
  Zap
} from 'lucide-react';

interface SponsoredCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sponsor_cap: number;
  price_monthly_sek: number;
  price_yearly_sek: number;
  active_slot_count: number;
  is_full: boolean;
}

interface SponsoredSlot {
  id: string;
  category_id: string;
  slot_type: 'INCLUDED' | 'PURCHASED';
  status: string;
  starts_at: string;
  category?: SponsoredCategory;
}

interface Entitlement {
  included_slots: number;
  purchased_slots: number;
  total_slots: number;
  used_slots: number;
  remaining_slots: number;
}

export default function PromotionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get('checkout');
  const checkoutCategory = searchParams.get('category');

  const [categories, setCategories] = useState<SponsoredCategory[]>([]);
  const [slots, setSlots] = useState<SponsoredSlot[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Show checkout result message
  useEffect(() => {
    if (checkoutStatus === 'success') {
      setSuccessMessage(`Tack för ditt köp! Din sponsrade plats i "${checkoutCategory}" är nu aktiv.`);
    }
  }, [checkoutStatus, checkoutCategory]);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch categories and slots in parallel
        const [categoriesRes, slotsRes] = await Promise.all([
          fetch('/api/sponsored/categories'),
          fetch('/api/sponsored/slots')
        ]);

        if (!categoriesRes.ok || !slotsRes.ok) {
          throw new Error('Kunde inte ladda data');
        }

        const categoriesData = await categoriesRes.json();
        const slotsData = await slotsRes.json();

        setCategories(categoriesData.categories || []);
        setSlots(slotsData.slots || []);
        setEntitlement(slotsData.entitlement || null);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Check if supplier has slot in category
  const hasSlotInCategory = (categoryId: string) => {
    return slots.some(s => s.category_id === categoryId && s.status === 'ACTIVE');
  };

  // Get slot for category
  const getSlotForCategory = (categoryId: string) => {
    return slots.find(s => s.category_id === categoryId && s.status === 'ACTIVE');
  };

  // Assign slot (use entitlement)
  const handleAssignSlot = async (categoryId: string) => {
    if (!entitlement || entitlement.remaining_slots <= 0) {
      setError('Du har inga lediga platser. Köp fler platser nedan.');
      return;
    }

    setActionLoading(categoryId);
    setError(null);

    try {
      const res = await fetch('/api/sponsored/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte tilldela plats');
      }

      // Refresh data
      const slotsRes = await fetch('/api/sponsored/slots');
      const slotsData = await slotsRes.json();
      setSlots(slotsData.slots || []);
      setEntitlement(slotsData.entitlement || null);

      setSuccessMessage('Din sponsrade plats är nu aktiv!');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Unassign slot
  const handleUnassignSlot = async (slotId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna sponsrade plats?')) {
      return;
    }

    setActionLoading(slotId);
    setError(null);

    try {
      const res = await fetch(`/api/sponsored/slots/${slotId}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte ta bort plats');
      }

      // Refresh data
      const slotsRes = await fetch('/api/sponsored/slots');
      const slotsData = await slotsRes.json();
      setSlots(slotsData.slots || []);
      setEntitlement(slotsData.entitlement || null);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Purchase slot
  const handlePurchaseSlot = async (categoryId: string) => {
    setActionLoading(`purchase-${categoryId}`);
    setError(null);

    try {
      const res = await fetch('/api/sponsored/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId,
          billing_period: 'monthly'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte skapa betalning');
      }

      // Redirect to Stripe
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }

    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7B1E1E]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Sponsrade Platser
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Öka din synlighet i kategorier
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Få en framträdande plats i kategorierna du vill synas i.
            Begränsade platser per kategori garanterar exklusivitet.
          </p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-800">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 text-sm underline mt-1"
              >
                Stäng
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 text-sm underline mt-1"
              >
                Stäng
              </button>
            </div>
          </div>
        )}

        {/* Entitlement Card */}
        {entitlement && (
          <div className="max-w-2xl mx-auto mb-12 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Dina sponsrade platser</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {entitlement.included_slots > 0 && (
                    <span className="text-amber-600">
                      {entitlement.included_slots} inkluderad i Premium
                    </span>
                  )}
                  {entitlement.included_slots > 0 && entitlement.purchased_slots > 0 && ' + '}
                  {entitlement.purchased_slots > 0 && (
                    <span>{entitlement.purchased_slots} köpta</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#7B1E1E]">
                  {entitlement.remaining_slots}
                </div>
                <div className="text-sm text-gray-500">lediga av {entitlement.total_slots}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#7B1E1E] h-2 rounded-full transition-all"
                  style={{
                    width: `${entitlement.total_slots > 0
                      ? (entitlement.used_slots / entitlement.total_slots) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Slots */}
        {slots.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Dina aktiva platser</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-white p-4 rounded-xl border-2 border-amber-200 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                        <h3 className="font-semibold text-gray-900">
                          {slot.category?.name || 'Kategori'}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {slot.slot_type === 'INCLUDED' ? 'Inkluderad i Premium' : 'Köpt'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Aktiv sedan {new Date(slot.starts_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnassignSlot(slot.id)}
                      disabled={actionLoading === slot.id}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Ta bort plats"
                    >
                      {actionLoading === slot.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <X className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Categories */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tillgängliga kategorier</h2>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">Inga kategorier tillgängliga just nu.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => {
                const hasSlot = hasSlotInCategory(category.id);
                const existingSlot = getSlotForCategory(category.id);
                const canUseEntitlement = entitlement && entitlement.remaining_slots > 0;

                return (
                  <div
                    key={category.id}
                    className={`bg-white rounded-xl shadow-sm overflow-hidden border ${
                      hasSlot ? 'border-amber-300' : 'border-gray-200'
                    }`}
                  >
                    {/* Category header */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {category.name}
                        </h3>
                        {hasSlot && (
                          <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-full">
                            Aktiv
                          </span>
                        )}
                      </div>

                      {category.description && (
                        <p className="text-sm text-gray-500 mb-4">
                          {category.description}
                        </p>
                      )}

                      {/* Slots status */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex -space-x-1">
                          {[...Array(category.sponsor_cap)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded-full border-2 border-white ${
                                i < category.active_slot_count
                                  ? 'bg-amber-400'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">
                          {category.active_slot_count}/{category.sponsor_cap} platser upptagna
                        </span>
                      </div>

                      {/* Price */}
                      {!hasSlot && (
                        <div className="text-sm text-gray-600 mb-4">
                          <span className="font-semibold text-lg text-gray-900">
                            {category.price_monthly_sek.toLocaleString('sv-SE')} kr
                          </span>
                          <span className="text-gray-500">/månad</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-6 pb-6">
                      {hasSlot ? (
                        <button
                          onClick={() => existingSlot && handleUnassignSlot(existingSlot.id)}
                          disabled={actionLoading === existingSlot?.id}
                          className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                        >
                          {actionLoading === existingSlot?.id ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Tar bort...
                            </span>
                          ) : (
                            'Ta bort plats'
                          )}
                        </button>
                      ) : category.is_full ? (
                        <button
                          disabled
                          className="w-full py-2 px-4 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed text-sm"
                        >
                          Fullbokad
                        </button>
                      ) : canUseEntitlement ? (
                        <button
                          onClick={() => handleAssignSlot(category.id)}
                          disabled={actionLoading === category.id}
                          className="w-full py-2 px-4 bg-[#7B1E1E] text-white rounded-lg hover:bg-[#6B1818] transition-colors text-sm disabled:opacity-50"
                        >
                          {actionLoading === category.id ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Tilldelar...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center">
                              <Check className="w-4 h-4 mr-2" />
                              Använd ledig plats
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchaseSlot(category.id)}
                          disabled={actionLoading === `purchase-${category.id}`}
                          className="w-full py-2 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors text-sm disabled:opacity-50"
                        >
                          {actionLoading === `purchase-${category.id}` ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Förbereder betalning...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center">
                              <Zap className="w-4 h-4 mr-2" />
                              Köp plats
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Premium upsell */}
        {entitlement && entitlement.included_slots === 0 && (
          <div className="mt-12 p-8 bg-gradient-to-r from-amber-50 to-amber-100 rounded-2xl border border-amber-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Uppgradera till Premium
                </h3>
                <p className="text-gray-600 mb-4">
                  Med Premium får du 1 sponsrad plats inkluderad, plus högsta sökprioritet,
                  konkurrentanalys och dedikerad support.
                </p>
                <button
                  onClick={() => router.push('/supplier/pricing')}
                  className="bg-amber-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  Se alla planer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.back()}
            className="text-[#7B1E1E] hover:underline"
          >
            ← Tillbaka
          </button>
        </div>
      </div>
    </div>
  );
}
