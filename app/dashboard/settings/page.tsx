/**
 * RESTAURANT SETTINGS PAGE
 *
 * /dashboard/settings
 *
 * Manage restaurant profile, notifications, and delivery addresses
 */

'use client';

import { useEffect, useState } from 'react';
import { Building2, MapPin, Plus, Pencil, Trash2, Star, Check, X, Bell, Mail, User, Shield, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
      }

      if (addressesRes.ok) {
        const data = await addressesRes.json();
        setAddresses(data.addresses || []);
      }

      // TODO: Fetch notification settings from API
      // For now using defaults
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
      }
    } catch (err) {
      // Handle error
    } finally {
      setSavingRestaurant(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      // TODO: Save to API
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate save
      // Show success
    } catch (err) {
      // Handle error
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
