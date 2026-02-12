/**
 * RESTAURANT SETTINGS PAGE
 *
 * /dashboard/settings
 *
 * Manage restaurant profile, notifications, and delivery addresses
 */

'use client';

import { useEffect, useState } from 'react';
import { Building2, MapPin, Plus, Pencil, Trash2, Star, Check, X, Bell, Mail, User, Shield, Save, Receipt, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone: string;
  org_number: string;
  city: string;
  address: string;
  postal_code: string;
  contact_person?: string;
  // Billing fields
  billing_email?: string;
  billing_contact_person?: string;
  billing_contact_phone?: string;
  billing_address?: string;
  billing_postal_code?: string;
  billing_city?: string;
  billing_reference?: string;
  // Wine profile
  cuisine_type?: string[];
  price_segment?: string;
  wine_preference_notes?: string;
}

interface DeliveryAddress {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  contact_name: string | null;
  contact_phone: string | null;
  delivery_instructions: string | null;
  is_default: boolean;
}

interface NotificationSettings {
  email_new_offer: boolean;
  email_offer_reminder: boolean;
  email_order_status: boolean;
  email_frequency: 'immediate' | 'daily' | 'weekly';
}

type SettingsTab = 'account' | 'notifications' | 'addresses';

export default function SettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restaurant edit state
  const [editingRestaurant, setEditingRestaurant] = useState(false);
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    email: '',
    phone: '',
    org_number: '',
    contact_person: '',
    address: '',
    postal_code: '',
    city: '',
  });
  const [savingRestaurant, setSavingRestaurant] = useState(false);

  // Billing edit state
  const [editingBilling, setEditingBilling] = useState(false);
  const [billingForm, setBillingForm] = useState({
    billing_email: '',
    billing_contact_person: '',
    billing_contact_phone: '',
    billing_address: '',
    billing_postal_code: '',
    billing_city: '',
    billing_reference: '',
    use_same_address: true,
  });
  const [savingBilling, setSavingBilling] = useState(false);

  // Wine profile state
  const [editingWineProfile, setEditingWineProfile] = useState(false);
  const [wineProfileForm, setWineProfileForm] = useState({
    cuisine_type: [] as string[],
    price_segment: '',
    wine_preference_notes: '',
  });
  const [savingWineProfile, setSavingWineProfile] = useState(false);

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_new_offer: true,
    email_offer_reminder: true,
    email_order_status: true,
    email_frequency: 'immediate',
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Address form state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    contact_name: '',
    contact_phone: '',
    delivery_instructions: '',
    is_default: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [restaurantRes, addressesRes] = await Promise.all([
        fetch('/api/me/restaurant'),
        fetch('/api/me/addresses'),
      ]);

      if (restaurantRes.ok) {
        const data = await restaurantRes.json();
        setRestaurant(data);
        // Initialize form with current data
        setRestaurantForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          org_number: data.org_number || '',
          contact_person: data.contact_person || '',
          address: data.address || '',
          postal_code: data.postal_code || '',
          city: data.city || '',
        });
        // Initialize wine profile form
        setWineProfileForm({
          cuisine_type: data.cuisine_type || [],
          price_segment: data.price_segment || '',
          wine_preference_notes: data.wine_preference_notes || '',
        });
        // Initialize billing form
        const hasBillingAddress = data.billing_address || data.billing_postal_code || data.billing_city;
        setBillingForm({
          billing_email: data.billing_email || '',
          billing_contact_person: data.billing_contact_person || '',
          billing_contact_phone: data.billing_contact_phone || '',
          billing_address: data.billing_address || '',
          billing_postal_code: data.billing_postal_code || '',
          billing_city: data.billing_city || '',
          billing_reference: data.billing_reference || '',
          use_same_address: !hasBillingAddress,
        });
      }

      if (addressesRes.ok) {
        const data = await addressesRes.json();
        setAddresses(data.addresses || []);
      }

      // Fetch notification settings
      const notificationsRes = await fetch('/api/me/notifications');
      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications({
          email_new_offer: data.email_new_offer ?? true,
          email_offer_reminder: data.email_offer_reminder ?? true,
          email_order_status: data.email_order_status ?? true,
          email_frequency: data.email_frequency ?? 'immediate',
        });
      }
    } catch (err) {
      setError('Kunde inte ladda data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRestaurant = async () => {
    setSavingRestaurant(true);
    try {
      const res = await fetch('/api/me/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restaurantForm),
      });

      if (res.ok) {
        const data = await res.json();
        setRestaurant(data);
        setEditingRestaurant(false);
        toast.success('Restauranginformation sparad');
      }
    } catch (err) {
      toast.error('Kunde inte spara');
    } finally {
      setSavingRestaurant(false);
    }
  };

  const handleSaveBilling = async () => {
    setSavingBilling(true);
    try {
      const billingData = billingForm.use_same_address
        ? {
            billing_email: billingForm.billing_email,
            billing_contact_person: billingForm.billing_contact_person,
            billing_contact_phone: billingForm.billing_contact_phone,
            billing_reference: billingForm.billing_reference,
            billing_address: null,
            billing_postal_code: null,
            billing_city: null,
          }
        : {
            billing_email: billingForm.billing_email,
            billing_contact_person: billingForm.billing_contact_person,
            billing_contact_phone: billingForm.billing_contact_phone,
            billing_reference: billingForm.billing_reference,
            billing_address: billingForm.billing_address,
            billing_postal_code: billingForm.billing_postal_code,
            billing_city: billingForm.billing_city,
          };

      const res = await fetch('/api/me/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billingData),
      });

      if (res.ok) {
        const data = await res.json();
        setRestaurant(data);
        setEditingBilling(false);
        toast.success('Faktureringsuppgifter sparade');
      }
    } catch (err) {
      toast.error('Kunde inte spara faktureringsuppgifter');
    } finally {
      setSavingBilling(false);
    }
  };

  const handleSaveWineProfile = async () => {
    setSavingWineProfile(true);
    try {
      const res = await fetch('/api/me/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuisine_type: wineProfileForm.cuisine_type.length > 0 ? wineProfileForm.cuisine_type : null,
          price_segment: wineProfileForm.price_segment || null,
          wine_preference_notes: wineProfileForm.wine_preference_notes || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRestaurant(data);
        setEditingWineProfile(false);
        toast.success('Vinprofil sparad');
      }
    } catch (err) {
      toast.error('Kunde inte spara vinprofil');
    } finally {
      setSavingWineProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const res = await fetch('/api/me/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }
      toast.success('Notis-inställningar sparade');
    } catch (err) {
      toast.error('Kunde inte spara notis-inställningar');
    } finally {
      setSavingNotifications(false);
    }
  };

  const resetForm = () => {
    setFormData({
      label: '',
      address_line1: '',
      address_line2: '',
      postal_code: '',
      city: '',
      contact_name: '',
      contact_phone: '',
      delivery_instructions: '',
      is_default: false,
    });
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const handleEditAddress = (address: DeliveryAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      postal_code: address.postal_code,
      city: address.city,
      contact_name: address.contact_name || '',
      contact_phone: address.contact_phone || '',
      delivery_instructions: address.delivery_instructions || '',
      is_default: address.is_default,
    });
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!formData.label || !formData.address_line1 || !formData.postal_code || !formData.city) {
      return;
    }

    setSaving(true);

    try {
      const url = editingAddress
        ? `/api/me/addresses/${editingAddress.id}`
        : '/api/me/addresses';

      const method = editingAddress ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchData();
        resetForm();
      }
    } catch (err) {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Vill du ta bort denna leveransadress?')) return;

    try {
      const res = await fetch(`/api/me/addresses/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      // Handle error
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/me/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      // Handle error
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-48 bg-muted rounded"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'account' as const, label: 'Kontoinformation', icon: Building2 },
    { id: 'notifications' as const, label: 'Notiser', icon: Bell },
    { id: 'addresses' as const, label: 'Leveransadresser', icon: MapPin },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Inställningar</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Restaurant Info */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Restauranginformation</h2>
              </div>
              {!editingRestaurant && (
                <Button variant="outline" size="sm" onClick={() => setEditingRestaurant(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Redigera
                </Button>
              )}
            </div>

            {editingRestaurant ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rest_name">Restaurangnamn *</Label>
                    <Input
                      id="rest_name"
                      value={restaurantForm.name}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org_number">Organisationsnummer</Label>
                    <Input
                      id="org_number"
                      placeholder="XXXXXX-XXXX"
                      value={restaurantForm.org_number}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, org_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Kontaktperson</Label>
                    <Input
                      id="contact_person"
                      placeholder="Anna Andersson"
                      value={restaurantForm.contact_person}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      placeholder="08-123 45 67"
                      value={restaurantForm.phone}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="rest_email">E-postadress</Label>
                    <Input
                      id="rest_email"
                      type="email"
                      placeholder="info@restaurang.se"
                      value={restaurantForm.email}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, email: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="rest_address">Gatuadress</Label>
                    <Input
                      id="rest_address"
                      placeholder="Storgatan 1"
                      value={restaurantForm.address}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rest_postal">Postnummer</Label>
                    <Input
                      id="rest_postal"
                      placeholder="123 45"
                      value={restaurantForm.postal_code}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, postal_code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rest_city">Stad</Label>
                    <Input
                      id="rest_city"
                      placeholder="Stockholm"
                      value={restaurantForm.city}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, city: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button variant="ghost" onClick={() => setEditingRestaurant(false)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleSaveRestaurant} disabled={savingRestaurant}>
                    {savingRestaurant ? 'Sparar...' : 'Spara ändringar'}
                  </Button>
                </div>
              </div>
            ) : restaurant ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Namn</span>
                  <p className="font-medium">{restaurant.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Orgnr</span>
                  <p className="font-medium">{restaurant.org_number || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Kontaktperson</span>
                  <p className="font-medium">{restaurant.contact_person || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Telefon</span>
                  <p className="font-medium">{restaurant.phone || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">E-post</span>
                  <p className="font-medium">{restaurant.email || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Adress</span>
                  <p className="font-medium">
                    {restaurant.address ? `${restaurant.address}, ${restaurant.postal_code} ${restaurant.city}` : '–'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Ingen restauranginformation hittades.</p>
            )}
          </div>

          {/* Billing Info */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Faktureringsuppgifter</h2>
              </div>
              {!editingBilling && (
                <Button variant="outline" size="sm" onClick={() => setEditingBilling(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Redigera
                </Button>
              )}
            </div>

            {editingBilling ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="billing_email">E-post för fakturor *</Label>
                    <Input
                      id="billing_email"
                      type="email"
                      placeholder="faktura@restaurang.se"
                      value={billingForm.billing_email}
                      onChange={(e) => setBillingForm({ ...billingForm, billing_email: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Hit skickas alla fakturor</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_contact">Kontaktperson ekonomi</Label>
                    <Input
                      id="billing_contact"
                      placeholder="Erik Ekonomsson"
                      value={billingForm.billing_contact_person}
                      onChange={(e) => setBillingForm({ ...billingForm, billing_contact_person: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_phone">Telefon ekonomi</Label>
                    <Input
                      id="billing_phone"
                      placeholder="08-123 45 67"
                      value={billingForm.billing_contact_phone}
                      onChange={(e) => setBillingForm({ ...billingForm, billing_contact_phone: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="billing_reference">Er referens / Kostnadsställe</Label>
                    <Input
                      id="billing_reference"
                      placeholder="T.ex. PO-nummer, projektkod"
                      value={billingForm.billing_reference}
                      onChange={(e) => setBillingForm({ ...billingForm, billing_reference: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Visas på fakturan om angivet</p>
                  </div>
                </div>

                {/* Billing address toggle */}
                <div className="pt-4 border-t">
                  <label className="flex items-center gap-2 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={billingForm.use_same_address}
                      onChange={(e) => setBillingForm({ ...billingForm, use_same_address: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Samma fakturaadress som restaurangadress</span>
                  </label>

                  {!billingForm.use_same_address && (
                    <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="billing_address">Fakturaadress</Label>
                        <Input
                          id="billing_address"
                          placeholder="Ekonomigatan 1"
                          value={billingForm.billing_address}
                          onChange={(e) => setBillingForm({ ...billingForm, billing_address: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_postal">Postnummer</Label>
                        <Input
                          id="billing_postal"
                          placeholder="123 45"
                          value={billingForm.billing_postal_code}
                          onChange={(e) => setBillingForm({ ...billingForm, billing_postal_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_city">Stad</Label>
                        <Input
                          id="billing_city"
                          placeholder="Stockholm"
                          value={billingForm.billing_city}
                          onChange={(e) => setBillingForm({ ...billingForm, billing_city: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button variant="ghost" onClick={() => setEditingBilling(false)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleSaveBilling} disabled={savingBilling}>
                    {savingBilling ? 'Sparar...' : 'Spara ändringar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">E-post för fakturor</span>
                  <p className="font-medium">{restaurant?.billing_email || restaurant?.email || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Kontaktperson ekonomi</span>
                  <p className="font-medium">{restaurant?.billing_contact_person || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Telefon ekonomi</span>
                  <p className="font-medium">{restaurant?.billing_contact_phone || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Er referens</span>
                  <p className="font-medium">{restaurant?.billing_reference || '–'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Fakturaadress</span>
                  <p className="font-medium">
                    {restaurant?.billing_address
                      ? `${restaurant.billing_address}, ${restaurant.billing_postal_code} ${restaurant.billing_city}`
                      : restaurant?.address
                      ? `${restaurant.address}, ${restaurant.postal_code} ${restaurant.city} (samma som restaurang)`
                      : '–'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Wine Profile */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Wine className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Vinprofil</h2>
                  <p className="text-sm text-muted-foreground">Hjälper vår AI att ge bättre vinförslag</p>
                </div>
              </div>
              {!editingWineProfile && (
                <Button variant="outline" size="sm" onClick={() => setEditingWineProfile(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Redigera
                </Button>
              )}
            </div>

            {editingWineProfile ? (
              <div className="space-y-5">
                {/* Cuisine type pills */}
                <div className="space-y-2">
                  <Label>Kökskategori</Label>
                  <p className="text-xs text-muted-foreground">Välj en eller flera som beskriver er restaurang</p>
                  <div className="flex flex-wrap gap-2">
                    {['Svensk', 'Italiensk', 'Fransk', 'Japansk', 'Spansk', 'Nordisk', 'Fusion', 'Asiatisk', 'Amerikansk', 'Mellanöstern'].map((cuisine) => {
                      const selected = wineProfileForm.cuisine_type.includes(cuisine);
                      return (
                        <button
                          key={cuisine}
                          type="button"
                          onClick={() => {
                            setWineProfileForm(prev => ({
                              ...prev,
                              cuisine_type: selected
                                ? prev.cuisine_type.filter(c => c !== cuisine)
                                : [...prev.cuisine_type, cuisine],
                            }));
                          }}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            selected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:border-primary/50'
                          }`}
                        >
                          {cuisine}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price segment radio */}
                <div className="space-y-2">
                  <Label>Prissegment</Label>
                  <div className="flex gap-3">
                    {[
                      { value: 'casual', label: 'Casual' },
                      { value: 'mid-range', label: 'Mellansegment' },
                      { value: 'fine-dining', label: 'Fine dining' },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                          wineProfileForm.price_segment === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="price_segment"
                          value={opt.value}
                          checked={wineProfileForm.price_segment === opt.value}
                          onChange={() => setWineProfileForm({ ...wineProfileForm, price_segment: opt.value })}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Wine preference notes */}
                <div className="space-y-2">
                  <Label htmlFor="wine_notes">Vinpreferenser</Label>
                  <Textarea
                    id="wine_notes"
                    placeholder="T.ex. Vi gillar naturviner och eleganta Barolo. Vår vinlista fokuserar på små producenter från Italien och Frankrike."
                    rows={3}
                    value={wineProfileForm.wine_preference_notes}
                    onChange={(e) => setWineProfileForm({ ...wineProfileForm, wine_preference_notes: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Beskriv fritt vad ni letar efter — detta vägs in som mjuk preferens i vinförslagen</p>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button variant="ghost" onClick={() => {
                    setEditingWineProfile(false);
                    setWineProfileForm({
                      cuisine_type: restaurant?.cuisine_type || [],
                      price_segment: restaurant?.price_segment || '',
                      wine_preference_notes: restaurant?.wine_preference_notes || '',
                    });
                  }}>
                    Avbryt
                  </Button>
                  <Button onClick={handleSaveWineProfile} disabled={savingWineProfile}>
                    {savingWineProfile ? 'Sparar...' : 'Spara vinprofil'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Kök</span>
                  <p className="font-medium">
                    {restaurant?.cuisine_type?.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {restaurant.cuisine_type.map(c => (
                          <span key={c} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{c}</span>
                        ))}
                      </span>
                    ) : '–'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Segment</span>
                  <p className="font-medium">
                    {restaurant?.price_segment
                      ? { casual: 'Casual', 'mid-range': 'Mellansegment', 'fine-dining': 'Fine dining' }[restaurant.price_segment] || restaurant.price_segment
                      : '–'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase tracking-wide mb-1">Vinpreferenser</span>
                  <p className="font-medium">{restaurant?.wine_preference_notes || '–'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Security section placeholder */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Säkerhet</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="font-medium">Lösenord</p>
                  <p className="text-sm text-muted-foreground">Senast ändrat: Okänt</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Byt lösenord
                </Button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">Tvåfaktorsautentisering</p>
                  <p className="text-sm text-muted-foreground">Extra säkerhet för ditt konto</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Kommer snart</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">E-postnotiser</h2>
          </div>

          <div className="space-y-6">
            {/* Notification toggles */}
            <div className="space-y-4">
              <label className="flex items-center justify-between py-3 border-b border-border cursor-pointer">
                <div>
                  <p className="font-medium">Nya offerter</p>
                  <p className="text-sm text-muted-foreground">Få e-post när en leverantör skickar en offert</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_new_offer}
                  onChange={(e) => setNotifications({ ...notifications, email_new_offer: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between py-3 border-b border-border cursor-pointer">
                <div>
                  <p className="font-medium">Påminnelser</p>
                  <p className="text-sm text-muted-foreground">Påminnelse om obesvarade offerter efter 48h</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_offer_reminder}
                  onChange={(e) => setNotifications({ ...notifications, email_offer_reminder: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between py-3 border-b border-border cursor-pointer">
                <div>
                  <p className="font-medium">Orderstatus</p>
                  <p className="text-sm text-muted-foreground">Uppdateringar om dina beställningar</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_order_status}
                  onChange={(e) => setNotifications({ ...notifications, email_order_status: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </label>
            </div>

            {/* Frequency */}
            <div className="pt-4">
              <Label className="text-base font-medium mb-3 block">Sammanfattningsfrekvens</Label>
              <div className="space-y-2">
                {[
                  { value: 'immediate', label: 'Omedelbart', desc: 'Skicka e-post direkt när något händer' },
                  { value: 'daily', label: 'Daglig sammanfattning', desc: 'En sammanfattning varje morgon kl 08:00' },
                  { value: 'weekly', label: 'Veckovis sammanfattning', desc: 'En sammanfattning varje måndag' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      notifications.email_frequency === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={option.value}
                      checked={notifications.email_frequency === option.value}
                      onChange={() => setNotifications({ ...notifications, email_frequency: option.value as any })}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
                <Save className="h-4 w-4 mr-2" />
                {savingNotifications ? 'Sparar...' : 'Spara inställningar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Addresses Tab */}
      {activeTab === 'addresses' && (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Leveransadresser</h2>
          </div>
          {!showAddressForm && (
            <Button
              size="sm"
              onClick={() => setShowAddressForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Lägg till
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Spara leveransadresser för att snabbt välja dem när du skapar förfrågningar.
        </p>

        {/* Address List */}
        {addresses.length === 0 && !showAddressForm ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Inga leveransadresser sparade</p>
            <p className="text-sm">Lägg till en adress för snabbare beställning</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`p-4 rounded-lg border ${
                  address.is_default ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{address.label}</span>
                      {address.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Standard
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {address.postal_code} {address.city}
                    </p>
                    {address.contact_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Kontakt: {address.contact_name} {address.contact_phone && `(${address.contact_phone})`}
                      </p>
                    )}
                    {address.delivery_instructions && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        &ldquo;{address.delivery_instructions}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!address.is_default && (
                      <button
                        onClick={() => handleSetDefault(address.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        title="Sätt som standard"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditAddress(address)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(address.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Radera adress"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Address Form */}
        {showAddressForm && (
          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">
              {editingAddress ? 'Redigera leveransadress' : 'Ny leveransadress'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="label">Namn på adressen *</Label>
                <Input
                  id="label"
                  placeholder="T.ex. Huvudrestaurang, Eventlokal"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="address_line1">Gatuadress *</Label>
                <Input
                  id="address_line1"
                  placeholder="Storgatan 1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postnummer *</Label>
                <Input
                  id="postal_code"
                  placeholder="123 45"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Stad *</Label>
                <Input
                  id="city"
                  placeholder="Stockholm"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Kontaktperson</Label>
                <Input
                  id="contact_name"
                  placeholder="Anna Andersson"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefon</Label>
                <Input
                  id="contact_phone"
                  placeholder="070-123 45 67"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="delivery_instructions">Leveransinstruktioner</Label>
                <Textarea
                  id="delivery_instructions"
                  placeholder="T.ex. Ring på vid bakdörren, leverans mellan 10-14"
                  rows={2}
                  value={formData.delivery_instructions}
                  onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Använd som standardadress</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetForm}>
                Avbryt
              </Button>
              <Button
                onClick={handleSaveAddress}
                disabled={saving || !formData.label || !formData.address_line1 || !formData.postal_code || !formData.city}
              >
                {saving ? 'Sparar...' : editingAddress ? 'Uppdatera' : 'Spara'}
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
