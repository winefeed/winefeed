'use client';

import { useState, useEffect, useCallback } from 'react';
import { draftStorage, DraftWineItem, DraftList } from '@/lib/draft-storage';

/**
 * Hook för att använda draft-listan i React-komponenter
 */
export function useDraftList() {
  const [list, setList] = useState<DraftList>({ items: [], created_at: '', updated_at: '' });
  const [isStale, setIsStale] = useState(false);

  // Ladda initial data
  useEffect(() => {
    setList(draftStorage.load());
    setIsStale(draftStorage.isStale());

    // Lyssna på ändringar
    const handleUpdate = (event: CustomEvent<DraftList>) => {
      setList(event.detail);
      setIsStale(draftStorage.isStale());
    };

    window.addEventListener('draft-list-updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('draft-list-updated', handleUpdate as EventListener);
    };
  }, []);

  const addItem = useCallback((item: Omit<DraftWineItem, 'added_at'>) => {
    draftStorage.addItem(item);
  }, []);

  const removeItem = useCallback((wineId: string) => {
    draftStorage.removeItem(wineId);
  }, []);

  const updateQuantity = useCallback((wineId: string, quantity: number) => {
    draftStorage.updateQuantity(wineId, quantity);
  }, []);

  const clear = useCallback(() => {
    draftStorage.clear();
  }, []);

  const hasItem = useCallback((wineId: string) => {
    return list.items.some(i => i.wine_id === wineId);
  }, [list.items]);

  const getGroupedBySupplier = useCallback(() => {
    return draftStorage.getGroupedBySupplier();
  }, []);

  return {
    items: list.items,
    count: list.items.length,
    isStale,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    hasItem,
    getGroupedBySupplier,
  };
}
