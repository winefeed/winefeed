/**
 * USE WINE CHECK HOOK
 *
 * Reusable hook for Wine-Searcher Wine Check integration
 * Handles state management, API calls, and validation
 *
 * NO PRICE DATA - Allowlist only
 */

'use client';

import { useState, useCallback } from 'react';
import {
  WineCheckResponse,
  WineCheckResult,
  WineCheckInput,
  assertNoForbiddenFields
} from './types';

interface UseWineCheckOptions {
  onSuccess?: (result: WineCheckResult, mock: boolean) => void;
  onError?: (error: string) => void;
}

interface UseWineCheckReturn {
  // State
  name: string;
  vintage: string;
  loading: boolean;
  error: string | null;
  result: WineCheckResult | null;
  mock: boolean;

  // Actions
  setName: (name: string) => void;
  setVintage: (vintage: string) => void;
  runCheck: (input?: WineCheckInput) => Promise<void>;
  reset: () => void;
}

export function useWineCheck(options: UseWineCheckOptions = {}): UseWineCheckReturn {
  const { onSuccess, onError } = options;

  // State
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WineCheckResult | null>(null);
  const [mock, setMock] = useState(false);

  /**
   * Run Wine Check
   * Fetches wine data from API and validates response
   */
  const runCheck = useCallback(async (input?: WineCheckInput) => {
    const checkName = input?.name || name;
    const checkVintage = input?.vintage || vintage;

    if (!checkName.trim()) {
      setError('Vinnamn krävs');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        name: checkName.trim(),
        ...(checkVintage && { vintage: checkVintage.trim() })
      });

      const response = await fetch(`/api/enrich/wine-searcher/check?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check wine');
      }

      const data: WineCheckResponse = await response.json();

      // SECURITY CHECK 1: Validate response structure
      if (!data.data || typeof data.mock !== 'boolean') {
        throw new Error('Invalid response structure from API');
      }

      // SECURITY CHECK 2: Validate no forbidden fields in data
      assertNoForbiddenFields(data.data, 'API response data');

      // SECURITY CHECK 3: Validate candidates
      if (data.data.candidates && data.data.candidates.length > 0) {
        data.data.candidates.forEach((candidate, idx) => {
          assertNoForbiddenFields(candidate, `candidate[${idx}]`);
        });
      }

      // Success - update state
      setResult(data.data);
      setMock(data.mock);

      if (onSuccess) {
        onSuccess(data.data, data.mock);
      }

    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(errorMessage);

      if (onError) {
        onError(errorMessage);
      }

      // Log security violations
      if (errorMessage.includes('SECURITY_VIOLATION')) {
        console.error('[useWineCheck] SECURITY VIOLATION detected:', err);
      }

    } finally {
      setLoading(false);
    }
  }, [name, vintage, onSuccess, onError]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setName('');
    setVintage('');
    setError(null);
    setResult(null);
    setMock(false);
  }, []);

  return {
    // State
    name,
    vintage,
    loading,
    error,
    result,
    mock,

    // Actions
    setName,
    setVintage,
    runCheck,
    reset
  };
}
