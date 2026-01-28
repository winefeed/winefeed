/**
 * DRAFT STORAGE SERVICE
 *
 * Abstraktion för att hantera "Spara till lista"-funktionalitet.
 * Använder localStorage för MVP - kan enkelt bytas till API/DB senare.
 */

export interface DraftWineItem {
  wine_id: string;
  wine_name: string;
  producer: string;
  country: string;
  region?: string;
  vintage?: number;
  color?: string;
  supplier_id: string;
  supplier_name: string;
  quantity: number;
  moq: number;
  price_sek: number;
  stock?: number;
  lead_time_days?: number;
  added_at: string;
  // Provorder fields
  provorder?: boolean;
  provorder_fee?: number;
}

export interface DraftList {
  items: DraftWineItem[];
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'winefeed_draft_wines';
const MAX_AGE_DAYS = 7;

/**
 * Draft storage med abstraktion för enkel framtida migration till DB
 */
export const draftStorage = {
  /**
   * Hämta alla sparade viner
   */
  load(): DraftList {
    if (typeof window === 'undefined') {
      return { items: [], created_at: '', updated_at: '' };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { items: [], created_at: '', updated_at: '' };
      }

      const data = JSON.parse(stored) as DraftList;
      return data;
    } catch {
      return { items: [], created_at: '', updated_at: '' };
    }
  },

  /**
   * Spara hela listan
   */
  save(items: DraftWineItem[]): void {
    if (typeof window === 'undefined') return;

    const existing = this.load();
    const now = new Date().toISOString();

    const data: DraftList = {
      items,
      created_at: existing.created_at || now,
      updated_at: now,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Dispatch event för att uppdatera UI
    window.dispatchEvent(new CustomEvent('draft-list-updated', { detail: data }));
  },

  /**
   * Lägg till ett vin i listan
   */
  addItem(item: Omit<DraftWineItem, 'added_at'>): void {
    const list = this.load();

    // Kolla om vinet redan finns
    const existingIndex = list.items.findIndex(i => i.wine_id === item.wine_id);

    const newItem: DraftWineItem = {
      ...item,
      added_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Uppdatera existerande
      list.items[existingIndex] = newItem;
    } else {
      // Lägg till nytt
      list.items.push(newItem);
    }

    this.save(list.items);
  },

  /**
   * Ta bort ett vin från listan
   */
  removeItem(wineId: string): void {
    const list = this.load();
    const filtered = list.items.filter(i => i.wine_id !== wineId);
    this.save(filtered);
  },

  /**
   * Uppdatera antal för ett vin
   */
  updateQuantity(wineId: string, quantity: number): void {
    const list = this.load();
    const item = list.items.find(i => i.wine_id === wineId);
    if (item) {
      item.quantity = quantity;
      this.save(list.items);
    }
  },

  /**
   * Rensa hela listan
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('draft-list-updated', { detail: { items: [] } }));
  },

  /**
   * Kolla om listan är äldre än MAX_AGE_DAYS
   */
  isStale(): boolean {
    const list = this.load();
    if (!list.created_at) return false;

    const created = new Date(list.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

    return diffDays > MAX_AGE_DAYS;
  },

  /**
   * Hämta antal items
   */
  getCount(): number {
    return this.load().items.length;
  },

  /**
   * Gruppera viner per leverantör
   */
  getGroupedBySupplier(): Map<string, { supplier_name: string; items: DraftWineItem[]; total_quantity: number; meets_moq: boolean }> {
    const list = this.load();
    const grouped = new Map<string, { supplier_name: string; items: DraftWineItem[]; total_quantity: number; meets_moq: boolean }>();

    for (const item of list.items) {
      const existing = grouped.get(item.supplier_id);

      if (existing) {
        existing.items.push(item);
        existing.total_quantity += item.quantity;
      } else {
        grouped.set(item.supplier_id, {
          supplier_name: item.supplier_name,
          items: [item],
          total_quantity: item.quantity,
          meets_moq: true, // Will be calculated below
        });
      }
    }

    // Beräkna MOQ-status per grupp (provorder-viner räknas alltid som OK)
    for (const [, group] of grouped) {
      group.meets_moq = group.items.every(item =>
        item.moq === 0 || item.quantity >= item.moq || item.provorder === true
      );
    }

    return grouped;
  },

  /**
   * Kolla om ett vin finns i listan
   */
  hasItem(wineId: string): boolean {
    const list = this.load();
    return list.items.some(i => i.wine_id === wineId);
  },
};
