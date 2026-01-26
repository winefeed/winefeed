'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Loader2,
  AlertCircle,
  Users,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Sponsor {
  slot_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_email: string | null;
  slot_type: 'INCLUDED' | 'PURCHASED';
  starts_at: string;
}

interface SponsoredCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sponsor_cap: number;
  price_monthly_sek: number;
  price_yearly_sek: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  is_active: boolean;
  created_at: string;
  active_slot_count: number;
  available_slots: number;
  is_full: boolean;
  sponsors: Sponsor[];
}

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  sponsor_cap: number;
  price_monthly_sek: number;
  price_yearly_sek: number;
  stripe_price_id_monthly: string;
  stripe_price_id_yearly: string;
  is_active: boolean;
}

const defaultFormData: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  sponsor_cap: 3,
  price_monthly_sek: 1500,
  price_yearly_sek: 15000,
  stripe_price_id_monthly: '',
  stripe_price_id_yearly: '',
  is_active: true
};

export default function AdminSponsoredCategoriesPage() {
  const [categories, setCategories] = useState<SponsoredCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SponsoredCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Expanded categories (to show sponsors)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/sponsored-categories');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch categories');
      }

      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(defaultFormData);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (category: SponsoredCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      sponsor_cap: category.sponsor_cap,
      price_monthly_sek: category.price_monthly_sek,
      price_yearly_sek: category.price_yearly_sek,
      stripe_price_id_monthly: category.stripe_price_id_monthly || '',
      stripe_price_id_yearly: category.stripe_price_id_yearly || '',
      is_active: category.is_active
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const url = editingCategory
        ? `/api/admin/sponsored-categories/${editingCategory.id}`
        : '/api/admin/sponsored-categories';

      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          stripe_price_id_monthly: formData.stripe_price_id_monthly || null,
          stripe_price_id_yearly: formData.stripe_price_id_yearly || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save category');
      }

      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: SponsoredCategory) => {
    if (!confirm(`Är du säker på att du vill ta bort "${category.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sponsored-categories/${category.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete category');
      }

      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (category: SponsoredCategory) => {
    try {
      const res = await fetch(`/api/admin/sponsored-categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !category.is_active })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update category');
      }

      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[åä]/g, 'a')
      .replace(/[ö]/g, 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#7B1E1E]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Sparkles className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sponsrade Kategorier</h1>
            <p className="text-gray-500 text-sm">Hantera kategorier för sponsrade platser</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg hover:bg-[#6B1818] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ny kategori
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Categories Table */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Inga kategorier</h3>
          <p className="text-gray-500 mb-6">Skapa din första sponsrade kategori för att komma igång.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg hover:bg-[#6B1818]"
          >
            <Plus className="w-4 h-4" />
            Skapa kategori
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platser</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pris/månad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((category) => (
                <>
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleExpand(category.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedCategories.has(category.id) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{category.name}</p>
                          <p className="text-xs text-gray-500">/{category.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1">
                          {[...Array(category.sponsor_cap)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-5 h-5 rounded-full border-2 border-white ${
                                i < category.active_slot_count
                                  ? 'bg-amber-400'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-sm ${category.is_full ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                          {category.active_slot_count}/{category.sponsor_cap}
                          {category.is_full && ' (Full)'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">
                        {category.price_monthly_sek.toLocaleString('sv-SE')} kr
                      </p>
                      {category.price_yearly_sek > 0 && (
                        <p className="text-xs text-gray-500">
                          {category.price_yearly_sek.toLocaleString('sv-SE')} kr/år
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                          category.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {category.is_active ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            Aktiv
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            Inaktiv
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(category)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Redigera"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Ta bort"
                          disabled={category.active_slot_count > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Sponsors row */}
                  {expandedCategories.has(category.id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="ml-8">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">
                              Sponsorer ({category.sponsors.length})
                            </span>
                          </div>
                          {category.sponsors.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">Inga sponsorer ännu</p>
                          ) : (
                            <div className="space-y-2">
                              {category.sponsors.map((sponsor) => (
                                <div
                                  key={sponsor.slot_id}
                                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                                >
                                  <div>
                                    <p className="font-medium text-gray-900">{sponsor.supplier_name}</p>
                                    <p className="text-xs text-gray-500">{sponsor.supplier_email}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      sponsor.slot_type === 'INCLUDED'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {sponsor.slot_type === 'INCLUDED' ? 'Premium' : 'Köpt'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Sedan {new Date(sponsor.starts_at).toLocaleDateString('sv-SE')}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Redigera kategori' : 'Ny kategori'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: editingCategory ? formData.slug : generateSlug(e.target.value)
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent"
                  placeholder="t.ex. Burgundy"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent font-mono text-sm"
                  placeholder="burgundy"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Används i URL:er. Endast a-z, 0-9 och bindestreck.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent"
                  rows={2}
                  placeholder="Valfri beskrivning..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max sponsorer
                  </label>
                  <input
                    type="number"
                    value={formData.sponsor_cap}
                    onChange={(e) => setFormData({ ...formData, sponsor_cap: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent"
                    min={1}
                    max={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pris/månad (SEK)
                  </label>
                  <input
                    type="number"
                    value={formData.price_monthly_sek}
                    onChange={(e) => setFormData({ ...formData, price_monthly_sek: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pris/år (SEK)
                </label>
                <input
                  type="number"
                  value={formData.price_yearly_sek}
                  onChange={(e) => setFormData({ ...formData, price_yearly_sek: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent"
                  min={0}
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Stripe Price IDs (valfritt)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Månadsvis</label>
                    <input
                      type="text"
                      value={formData.stripe_price_id_monthly}
                      onChange={(e) => setFormData({ ...formData, stripe_price_id_monthly: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent font-mono text-sm"
                      placeholder="price_xxx"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Årsvis</label>
                    <input
                      type="text"
                      value={formData.stripe_price_id_yearly}
                      onChange={(e) => setFormData({ ...formData, stripe_price_id_yearly: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7B1E1E] focus:border-transparent font-mono text-sm"
                      placeholder="price_xxx"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#7B1E1E] border-gray-300 rounded focus:ring-[#7B1E1E]"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Aktiv (synlig för leverantörer)
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[#7B1E1E] text-white rounded-lg hover:bg-[#6B1818] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sparar...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingCategory ? 'Spara ändringar' : 'Skapa kategori'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
