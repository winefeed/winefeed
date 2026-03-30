/**
 * Integration test helpers
 *
 * Shared utilities for integration tests that require a running local server.
 */

const SERVER_URL = 'http://localhost:3000';

/**
 * Check if the local dev server is running.
 * Returns true if reachable, false otherwise.
 */
export async function isServerRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(SERVER_URL, { signal: controller.signal });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Skip message for when the server is not available.
 */
export const SKIP_MESSAGE = 'Skipped: local dev server not running on localhost:3000';
