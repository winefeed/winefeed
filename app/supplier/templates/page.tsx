'use client';

/**
 * SUPPLIER OFFER TEMPLATES
 *
 * /supplier/templates
 *
 * Manage reusable offer templates for quick responses
 *
 * Features:
 * - Create, edit, delete templates
 * - Set default pricing, lead times, notes
 * - Quick-apply templates when responding to requests
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Wine, Clock, X, Save, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ButtonSpinner } from '@/components/ui/spinner';

interface OfferTemplate {
  id: string;
  name: string;
  description: string;
  default_price_sek: number | null;
  lead_time_days: number;
  notes: string;
  wine_type: string | null;
  created_at: string;
}

export default function SupplierTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OfferTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formLeadTime, setFormLeadTime] = useState('14');
  const [formNotes, setFormNotes] = useState('');
  const [formWineType, setFormWineType] = useState('');

  useEffect(() => {
    fetchSupplierAndTemplates();
  }, []);

  async function fetchSupplierAndTemplates() {
    try {
      // Get supplier context
      const supplierRes = await fetch('/api/me/supplier');
      if (!supplierRes.ok) {
        window.location.href = '/supplier/login';
        return;
      }
      const supplierData = await supplierRes.json();
      setSupplierId(supplierData.supplierId);

      // Load templates from localStorage (MVP - in production would be API)
      const storedTemplates = localStorage.getItem(`supplier_templates_${supplierData.supplierId}`);
      if (storedTemplates) {
        setTemplates(JSON.parse(storedTemplates));
      }
    } catch (error) {
      console.error('Failed to fetch supplier:', error);
    } finally {
      setLoading(false);
    }
  }

  const saveTemplates = (newTemplates: OfferTemplate[]) => {
    if (supplierId) {
      localStorage.setItem(`supplier_templates_${supplierId}`, JSON.stringify(newTemplates));
      setTemplates(newTemplates);
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormLeadTime('14');
    setFormNotes('');
    setFormWineType('');
    setShowModal(true);
  };

  const openEditModal = (template: OfferTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormPrice(template.default_price_sek?.toString() || '');
    setFormLeadTime(template.lead_time_days.toString());
    setFormNotes(template.notes);
    setFormWineType(template.wine_type || '');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.warning('Namn saknas', 'Ange ett namn för mallen');
      return;
    }

    setSaving(true);

    const templateData: OfferTemplate = {
      id: editingTemplate?.id || `template_${Date.now()}`,
      name: formName.trim(),
      description: formDescription.trim(),
      default_price_sek: formPrice ? parseInt(formPrice) : null,
      lead_time_days: parseInt(formLeadTime),
      notes: formNotes.trim(),
      wine_type: formWineType || null,
      created_at: editingTemplate?.created_at || new Date().toISOString(),
    };

    let newTemplates: OfferTemplate[];
    if (editingTemplate) {
      newTemplates = templates.map(t => t.id === editingTemplate.id ? templateData : t);
    } else {
      newTemplates = [...templates, templateData];
    }

    saveTemplates(newTemplates);
    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = (templateId: string) => {
    if (confirm('Är du säker på att du vill ta bort denna mall?')) {
      const newTemplates = templates.filter(t => t.id !== templateId);
      saveTemplates(newTemplates);
    }
  };

  const duplicateTemplate = (template: OfferTemplate) => {
    const newTemplate: OfferTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      name: `${template.name} (kopia)`,
      created_at: new Date().toISOString(),
    };
    saveTemplates([...templates, newTemplate]);
  };

  const WINE_TYPES = [
    { value: '', label: 'Alla typer' },
    { value: 'red', label: 'Rött vin' },
    { value: 'white', label: 'Vitt vin' },
    { value: 'rose', label: 'Rosévin' },
    { value: 'sparkling', label: 'Mousserande' },
    { value: 'fortified', label: 'Starkvin' },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offertmallar</h1>
          <p className="text-gray-500 mt-1">
            Skapa och hantera mallar för snabbare offertsvar
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Ny mall
        </button>
      </div>

      {/* Templates Grid */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateTemplate(template)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Duplicera"
                  >
                    <Copy className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Redigera"
                  >
                    <Edit2 className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Ta bort"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {template.default_price_sek && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Pris:</span>
                    <span className="font-medium text-green-600">{template.default_price_sek} kr/fl</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{template.lead_time_days} dagars leveranstid</span>
                </div>

                {template.wine_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wine className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {WINE_TYPES.find(t => t.value === template.wine_type)?.label}
                    </span>
                  </div>
                )}

                {template.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 italic">&ldquo;{template.notes}&rdquo;</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wine className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Inga mallar ännu</h3>
          <p className="text-gray-500 mb-6">
            Skapa din första mall för att snabba upp dina offertsvar.
          </p>
          <button
            onClick={openCreateModal}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Skapa mall
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-medium text-green-800 mb-2">Tips för effektiva mallar</h3>
        <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
          <li>Skapa olika mallar för olika vintyper (rött, vitt, mousserande)</li>
          <li>Sätt standardpriser baserat på dina vanligaste prispunkter</li>
          <li>Inkludera standardinformation om leverans och betalning i anteckningarna</li>
          <li>Använd beskrivande namn så du snabbt hittar rätt mall</li>
        </ul>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTemplate ? 'Redigera mall' : 'Ny offertmall'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mallnamn *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="T.ex. Standard rödvin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Valfri beskrivning av mallen"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Wine type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vintyp (valfritt)
                </label>
                <select
                  value={formWineType}
                  onChange={(e) => setFormWineType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {WINE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Standardpris (SEK per flaska)
                </label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="Lämna tomt för att ange vid offert"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Lead time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leveranstid (dagar)
                </label>
                <select
                  value={formLeadTime}
                  onChange={(e) => setFormLeadTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="7">7 dagar</option>
                  <option value="14">14 dagar</option>
                  <option value="21">21 dagar</option>
                  <option value="30">30 dagar</option>
                  <option value="45">45 dagar</option>
                  <option value="60">60 dagar</option>
                  <option value="90">90 dagar</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Standardanteckningar
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="T.ex. leverans- och betalningsvillkor"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <ButtonSpinner className="text-white" />
                    Sparar...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingTemplate ? 'Spara ändringar' : 'Skapa mall'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
