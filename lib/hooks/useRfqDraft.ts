'use client';

import { useState, useCallback } from 'react';

export interface RfqDraft {
  // Step 1 - Entry
  freeText: string;
  wineType: string;
  deliveryCity?: string;

  // Step 2 - Refine (required for send)
  budget: number | null;
  quantity: number | null;

  // Meta
  requestId?: string; // Set after initial suggestions request
  status: 'draft' | 'suggestions' | 'ready' | 'sent';
}

const INITIAL_DRAFT: RfqDraft = {
  freeText: '',
  wineType: 'all',
  deliveryCity: undefined,
  budget: null,
  quantity: null,
  status: 'draft',
};

export function useRfqDraft() {
  const [draft, setDraft] = useState<RfqDraft>(INITIAL_DRAFT);

  const updateDraft = useCallback((updates: Partial<RfqDraft>) => {
    setDraft((prev) => {
      const newDraft = { ...prev, ...updates };

      // Auto-update status based on fields
      if (newDraft.budget && newDraft.quantity && newDraft.status === 'suggestions') {
        newDraft.status = 'ready';
      } else if (newDraft.requestId && (!newDraft.budget || !newDraft.quantity)) {
        newDraft.status = 'suggestions';
      }

      return newDraft;
    });
  }, []);

  const setFreeText = useCallback((text: string) => {
    updateDraft({ freeText: text });
  }, [updateDraft]);

  const setWineType = useCallback((type: string) => {
    updateDraft({ wineType: type });
  }, [updateDraft]);

  const setDeliveryCity = useCallback((city: string | undefined) => {
    updateDraft({ deliveryCity: city });
  }, [updateDraft]);

  const setBudget = useCallback((budget: number | null) => {
    updateDraft({ budget });
  }, [updateDraft]);

  const setQuantity = useCallback((quantity: number | null) => {
    updateDraft({ quantity });
  }, [updateDraft]);

  const setRequestId = useCallback((id: string) => {
    updateDraft({ requestId: id, status: 'suggestions' });
  }, [updateDraft]);

  const markAsSent = useCallback(() => {
    updateDraft({ status: 'sent' });
  }, [updateDraft]);

  const reset = useCallback(() => {
    setDraft(INITIAL_DRAFT);
  }, []);

  // Validation
  const canViewSuggestions = draft.freeText.trim().length > 0 || draft.wineType !== 'all';
  const canSend = draft.budget !== null && draft.quantity !== null && draft.budget > 0 && draft.quantity > 0;
  const missingFields = {
    budget: draft.budget === null,
    quantity: draft.quantity === null,
  };

  return {
    draft,
    updateDraft,
    setFreeText,
    setWineType,
    setDeliveryCity,
    setBudget,
    setQuantity,
    setRequestId,
    markAsSent,
    reset,
    // Validation
    canViewSuggestions,
    canSend,
    missingFields,
  };
}
