'use client';

/**
 * useActor Hook - Client-side Actor Context
 *
 * Fetches and caches the current user's actor context from /api/me/actor.
 * Provides tenant_id, user_id, roles, and entity IDs.
 *
 * Usage:
 *   const { actor, loading, error } = useActor();
 *   if (actor) {
 *     // Use actor.tenant_id, actor.user_id, actor.roles, etc.
 *   }
 */

import { useState, useEffect, useCallback } from 'react';

export type ActorRole = 'RESTAURANT' | 'SELLER' | 'IOR' | 'ADMIN';

export interface ActorContext {
  tenant_id: string;
  user_id: string;
  roles: ActorRole[];
  restaurant_id?: string;
  supplier_id?: string;
  importer_id?: string;
  user_email?: string;
}

interface UseActorResult {
  actor: ActorContext | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasRole: (role: ActorRole) => boolean;
  hasAnyRole: (roles: ActorRole[]) => boolean;
}

// Simple in-memory cache to avoid refetching on every component mount
let cachedActor: ActorContext | null = null;
let cachePromise: Promise<ActorContext | null> | null = null;

async function fetchActorFromAPI(): Promise<ActorContext | null> {
  const response = await fetch('/api/me/actor', {
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null; // Not authenticated
    }
    throw new Error('Failed to fetch actor context');
  }

  return response.json();
}

export function useActor(): UseActorResult {
  const [actor, setActor] = useState<ActorContext | null>(cachedActor);
  const [loading, setLoading] = useState(!cachedActor);
  const [error, setError] = useState<string | null>(null);

  const fetchActor = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      // Use cached value if available and not forcing refresh
      if (!force && cachedActor) {
        setActor(cachedActor);
        setLoading(false);
        return;
      }

      // Deduplicate concurrent requests
      if (!force && cachePromise) {
        const result = await cachePromise;
        setActor(result);
        setLoading(false);
        return;
      }

      // Fetch from API
      cachePromise = fetchActorFromAPI();
      const result = await cachePromise;

      cachedActor = result;
      cachePromise = null;

      setActor(result);
    } catch (err: any) {
      console.error('Failed to fetch actor:', err);
      setError(err.message || 'Kunde inte ladda användarprofil');
      cachePromise = null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    cachedActor = null;
    await fetchActor(true);
  }, [fetchActor]);

  const hasRole = useCallback((role: ActorRole): boolean => {
    return actor?.roles.includes(role) ?? false;
  }, [actor]);

  const hasAnyRole = useCallback((roles: ActorRole[]): boolean => {
    return roles.some(role => actor?.roles.includes(role)) ?? false;
  }, [actor]);

  useEffect(() => {
    fetchActor();
  }, [fetchActor]);

  return {
    actor,
    loading,
    error,
    refetch,
    hasRole,
    hasAnyRole
  };
}

// Helper to clear cache (useful for logout)
export function clearActorCache() {
  cachedActor = null;
  cachePromise = null;
}
