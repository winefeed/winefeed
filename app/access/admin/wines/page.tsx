'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

type WineStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

interface Wine {
  id: string;
  producer_id: string | null;
  name: string;
  wine_type: string;
  vintage: number | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  appellation: string | null;
  description: string | null;
  price_indication: string | null;
  image_url: string | null;
  status: WineStatus;
  producer?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

interface Producer {
  id: string;
  name: string;
}

interface WineFormData {
  name: string;
  producer_name: string;
  wine_type: string;
  vintage: string; // string for form, converted to number|null
  country: string;
  region: string;
  grape: string;
  appellation: string;
  description: string;
  price_sek: string;
  image_url: string;
  status: WineStatus;
}

type StatusFilter = 'ALL' | WineStatus;

const WINE_TYPES = ['red', 'white', 'rosé', 'sparkling', 'orange', 'fortified', 'dessert'];

const WINE_TYPE_LABELS: Record<string, string> = {
  red: 'Rött',
  white: 'Vitt',
  rosé: 'Rosé',
  sparkling: 'Mousserande',
  orange: 'Orange',
  fortified: 'Starkvin',
  dessert: 'Dessertvin',
};

const STATUS_LABELS: Record<WineStatus, string> = {
  DRAFT: 'Utkast',
  ACTIVE: 'Aktiv',
  ARCHIVED: 'Arkiverad',
};

const STATUS_COLORS: Record<WineStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-200 text-gray-600',
};

// ============================================================================
// Suggestion data
// ============================================================================

const COUNTRIES = [
  'Argentina', 'Australien', 'Chile', 'Frankrike', 'Georgien',
  'Grekland', 'Italien', 'Nya Zeeland', 'Portugal', 'Spanien',
  'Sydafrika', 'Tyskland', 'Ungern', 'USA', 'Österrike',
];

const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  'Frankrike': ['Bordeaux', 'Bourgogne', 'Rhône', 'Loire', 'Alsace', 'Champagne', 'Languedoc', 'Provence', 'Jura', 'Savoie', 'Sud-Ouest'],
  'Italien': ['Toscana', 'Piemonte', 'Veneto', 'Sicilien', 'Puglia', 'Lombardiet', 'Abruzzo', 'Sardinien', 'Friuli', 'Kampanien', 'Emilia-Romagna'],
  'Spanien': ['Rioja', 'Ribera del Duero', 'Priorat', 'Galicien', 'Penedès', 'Jerez', 'Rueda', 'Navarra', 'Toro', 'Jumilla'],
  'Portugal': ['Douro', 'Alentejo', 'Dão', 'Vinho Verde', 'Bairrada', 'Lisboa'],
  'Tyskland': ['Mosel', 'Rheingau', 'Pfalz', 'Baden', 'Franken', 'Nahe', 'Rheinhessen'],
  'Österrike': ['Wachau', 'Kamptal', 'Kremstal', 'Burgenland', 'Steiermark', 'Wien'],
  'Australien': ['Barossa Valley', 'McLaren Vale', 'Hunter Valley', 'Margaret River', 'Yarra Valley', 'Adelaide Hills'],
  'Nya Zeeland': ['Marlborough', 'Central Otago', 'Hawke\'s Bay', 'Martinborough', 'Waipara'],
  'Chile': ['Maipo Valley', 'Colchagua', 'Casablanca', 'Maule', 'Bío-Bío', 'Aconcagua'],
  'Argentina': ['Mendoza', 'Salta', 'Patagonia', 'San Juan', 'Uco Valley'],
  'Sydafrika': ['Stellenbosch', 'Swartland', 'Franschhoek', 'Constantia', 'Walker Bay', 'Elgin'],
  'USA': ['Napa Valley', 'Sonoma', 'Willamette Valley', 'Paso Robles', 'Santa Barbara', 'Finger Lakes'],
  'Georgien': ['Kakheti', 'Kartli', 'Imereti'],
  'Grekland': ['Santorini', 'Naoussa', 'Nemea', 'Kreta', 'Makedonien'],
  'Ungern': ['Tokaj', 'Eger', 'Villány', 'Szekszárd'],
};

const GRAPES = [
  // Röda
  'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah', 'Grenache',
  'Tempranillo', 'Sangiovese', 'Nebbiolo', 'Gamay', 'Malbec',
  'Mourvèdre', 'Barbera', 'Zinfandel', 'Carignan', 'Primitivo',
  'Cabernet Franc', 'Petit Verdot', 'Touriga Nacional', 'Mencía', 'Nero d\'Avola',
  'Aglianico', 'Corvina', 'Dolcetto', 'Pinotage', 'Tannat',
  // Vita
  'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Pinot Grigio', 'Gewürztraminer',
  'Chenin Blanc', 'Viognier', 'Sémillon', 'Grüner Veltliner', 'Albariño',
  'Muscadet', 'Torrontés', 'Marsanne', 'Roussanne', 'Verdejo',
  'Trebbiano', 'Garganega', 'Fiano', 'Vermentino', 'Assyrtiko',
];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function emptyForm(): WineFormData {
  return {
    name: '',
    producer_name: '',
    wine_type: 'red',
    vintage: '',
    country: '',
    region: '',
    grape: '',
    appellation: '',
    description: '',
    price_sek: '',
    image_url: '',
    status: 'DRAFT',
  };
}

function wineToForm(w: Wine): WineFormData {
  const priceParts = w.price_indication?.match(/(\d+)/);
  return {
    name: w.name,
    producer_name: w.producer?.name || '',
    wine_type: w.wine_type,
    vintage: w.vintage !== null ? String(w.vintage) : 'NV',
    country: w.country || '',
    region: w.region || '',
    grape: w.grape || '',
    appellation: w.appellation || '',
    description: w.description || '',
    price_sek: priceParts ? priceParts[1] : '',
    image_url: w.image_url || '',
    status: w.status,
  };
}

// ============================================================================
// Component
// ============================================================================

export default function AdminWinesPage() {
  const [wines, setWines] = useState<Wine[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [form, setForm] = useState<WineFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const fetchWines = useCallback(async (q?: string, status?: StatusFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ admin: '1' });
      if (q) params.set('q', q);
      if (status && status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/admin/access/wines?${params}`);
      if (res.status === 401) {
        window.location.href = '/login?redirect=/access/admin/wines';
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch wines');
      const data = await res.json();
      setWines(data.data || []);
      setTotal(data.total || 0);
      if (data.producers) setProducers(data.producers);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWines(search, statusFilter);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchWines(search, statusFilter);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const activeCount = wines.filter(w => w.status === 'ACTIVE').length;
  const draftCount = wines.filter(w => w.status === 'DRAFT').length;
  const archivedCount = wines.filter(w => w.status === 'ARCHIVED').length;

  // Modal handlers
  function openCreate() {
    setEditingWine(null);
    setForm(emptyForm());
    setFormErrors([]);
    setModalOpen(true);
  }

  function openEdit(wine: Wine) {
    setEditingWine(wine);
    setForm(wineToForm(wine));
    setFormErrors([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingWine(null);
    setFormErrors([]);
  }

  async function handleSave() {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Namn krävs');
    if (!form.wine_type.trim()) errors.push('Typ krävs');
    if (!form.country.trim()) errors.push('Land krävs');
    if (!form.region.trim()) errors.push('Region krävs');
    if (form.vintage && form.vintage !== 'NV') {
      const v = Number(form.vintage);
      if (isNaN(v) || v < 1900 || v > 2099) errors.push('Årgång måste vara 1900–2099 eller NV');
    }
    if (form.price_sek) {
      const p = Number(form.price_sek);
      if (isNaN(p) || p < 0) errors.push('Pris måste vara >= 0');
    }
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    setFormErrors([]);

    const body = {
      name: form.name.trim(),
      producer_name: form.producer_name.trim() || null,
      wine_type: form.wine_type,
      vintage: form.vintage === 'NV' || !form.vintage ? null : Number(form.vintage),
      country: form.country.trim(),
      region: form.region.trim(),
      grape: form.grape.trim() || null,
      appellation: form.appellation.trim() || null,
      description: form.description.trim() || null,
      price_sek: form.price_sek ? Number(form.price_sek) : null,
      image_url: form.image_url.trim() || null,
      status: form.status,
    };

    try {
      let res: Response;
      if (editingWine) {
        res = await fetch(`/api/admin/access/wines/${editingWine.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/admin/access/wines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setFormErrors(data.errors || [data.error || 'Något gick fel']);
        return;
      }

      closeModal();
      showToast(editingWine ? 'Vinet har uppdaterats' : 'Vinet har skapats');
      await fetchWines(search, statusFilter);
    } catch (err: any) {
      setFormErrors([err.message]);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(wine: Wine) {
    if (!confirm(`Arkivera "${wine.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/access/wines/${wine.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Något gick fel');
        return;
      }
      showToast('Vinet har arkiverats');
      await fetchWines(search, statusFilter);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRestore(wine: Wine) {
    try {
      const res = await fetch(`/api/admin/access/wines/${wine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Något gick fel');
        return;
      }
      showToast('Vinet har återställts som utkast');
      await fetchWines(search, statusFilter);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Viner</h1>
          <p className="text-sm text-gray-500 mt-1">Hantera vinkatalogen</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm bg-[#722F37] text-white rounded-lg hover:bg-[#5c2630] transition-colors font-medium"
        >
          Nytt vin
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Totalt"
          value={total}
          color="bg-gray-50 border-gray-200 text-gray-800"
          onClick={() => setStatusFilter('ALL')}
        />
        <StatCard
          label="Aktiva"
          value={activeCount}
          color="bg-green-50 border-green-200 text-green-800"
          onClick={() => setStatusFilter('ACTIVE')}
        />
        <StatCard
          label="Utkast"
          value={draftCount}
          color="bg-yellow-50 border-yellow-200 text-yellow-800"
          onClick={() => setStatusFilter('DRAFT')}
        />
        <StatCard
          label="Arkiverade"
          value={archivedCount}
          color="bg-gray-50 border-gray-200 text-gray-500"
          onClick={() => setStatusFilter('ARCHIVED')}
        />
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Sök vin, druva, region..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as StatusFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              statusFilter === key
                ? 'bg-[#722F37] text-white border-[#722F37]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {key === 'ALL' ? 'Alla' : STATUS_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      {loading && wines.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Laddar viner...</div>
      ) : wines.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Inga viner matchar filtret</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Namn</th>
                <th className="px-4 py-3 font-medium text-gray-600">Årgång</th>
                <th className="px-4 py-3 font-medium text-gray-600">Typ</th>
                <th className="px-4 py-3 font-medium text-gray-600">Land / Region</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Uppdaterad</th>
                <th className="px-4 py-3 font-medium text-gray-600">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {wines.map((wine) => (
                <tr
                  key={wine.id}
                  className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${
                    wine.status === 'ARCHIVED' ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{wine.name}</div>
                    <div className="text-xs text-gray-500">
                      {[wine.producer?.name, wine.grape].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {wine.vintage || 'NV'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {WINE_TYPE_LABELS[wine.wine_type] || wine.wine_type}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {[wine.country, wine.region].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[wine.status]}`}>
                      {STATUS_LABELS[wine.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(wine.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(wine)}
                        className="text-xs text-[#722F37] hover:underline font-medium"
                      >
                        Redigera
                      </button>
                      {wine.status !== 'ARCHIVED' ? (
                        <button
                          onClick={() => handleArchive(wine)}
                          className="text-xs text-gray-500 hover:text-red-600 hover:underline"
                        >
                          Arkivera
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(wine)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Återställ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <WineModal
          form={form}
          setForm={setForm}
          editing={!!editingWine}
          saving={saving}
          errors={formErrors}
          producers={producers}
          onSave={handleSave}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components (defined outside main component to avoid re-render issues)
// ============================================================================

function StatCard({ label, value, color, onClick }: {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <div
      className={`border rounded-lg px-4 py-3 ${color} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}

function ComboInput({ value, onChange, suggestions, placeholder, label, required }: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  label: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = value
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
    : suggestions;

  const showDropdown = open && focused && filtered.length > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 12).map(s => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WineModal({ form, setForm, editing, saving, errors, producers, onSave, onCancel }: {
  form: WineFormData;
  setForm: (f: WineFormData) => void;
  editing: boolean;
  saving: boolean;
  errors: string[];
  producers: Producer[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const vintageOptions = ['NV', ...Array.from({ length: 61 }, (_, i) => String(2030 - i))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? 'Redigera vin' : 'Nytt vin'}
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Namn *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
              placeholder="t.ex. Château Margaux"
            />
          </div>

          {/* Producer */}
          <ComboInput
            label="Producent"
            value={form.producer_name}
            onChange={(v) => setForm({ ...form, producer_name: v })}
            suggestions={producers.map(p => p.name)}
            placeholder="t.ex. Domaine de la Romanée-Conti"
          />

          {/* Type + Vintage row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ *</label>
              <select
                value={form.wine_type}
                onChange={(e) => setForm({ ...form, wine_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37] bg-white"
              >
                {WINE_TYPES.map(t => (
                  <option key={t} value={t}>{WINE_TYPE_LABELS[t] || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Årgång</label>
              <select
                value={form.vintage}
                onChange={(e) => setForm({ ...form, vintage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37] bg-white"
              >
                <option value="">Välj...</option>
                {vintageOptions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Country + Region row */}
          <div className="grid grid-cols-2 gap-4">
            <ComboInput
              label="Land"
              required
              value={form.country}
              onChange={(v) => setForm({ ...form, country: v, region: '' })}
              suggestions={COUNTRIES}
              placeholder="t.ex. Frankrike"
            />
            <ComboInput
              label="Region"
              required
              value={form.region}
              onChange={(v) => setForm({ ...form, region: v })}
              suggestions={REGIONS_BY_COUNTRY[form.country] || []}
              placeholder="t.ex. Bordeaux"
            />
          </div>

          {/* Grape */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Druva</label>
            <input
              type="text"
              value={form.grape}
              onChange={(e) => setForm({ ...form, grape: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
              placeholder="t.ex. Cabernet Sauvignon, Merlot"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pris (kr)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.price_sek}
              onChange={(e) => setForm({ ...form, price_sek: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
              placeholder="t.ex. 250"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37] resize-none"
              placeholder="Kort beskrivning av vinet..."
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bild-URL</label>
            <input
              type="text"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
              placeholder="https://..."
            />
            <p className="text-xs text-gray-400 mt-1">Klistra in en URL till en bild. Bilduppladdning kommer i v2.</p>
          </div>

          {/* Status toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex gap-2">
              {(['DRAFT', 'ACTIVE'] as WineStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    form.status === s
                      ? 'bg-[#722F37] text-white border-[#722F37]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-[#722F37] text-white rounded-lg hover:bg-[#5c2630] disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Sparar...' : editing ? 'Spara ändringar' : 'Skapa vin'}
          </button>
        </div>
      </div>
    </div>
  );
}
