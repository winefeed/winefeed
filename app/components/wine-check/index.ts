/**
 * WINE CHECK MODULE
 *
 * Reusable Wine-Searcher Wine Check integration
 * Export all public components and types
 */

// Main components
export { WineCheckPanel } from './WineCheckPanel';
export { WineCheckForm } from './WineCheckForm';
export { WineCheckResult } from './WineCheckResult';
export { WineCheckCandidates } from './WineCheckCandidates';
export { MockModeBadge, MatchStatusBadge } from './WineCheckBadge';

// Hook
export { useWineCheck } from './useWineCheck';

// Types
export type {
  WineCheckCandidate,
  WineCheckResult as WineCheckResultType,
  WineCheckResponse,
  WineCheckInput,
  MatchStatus
} from './types';

export { assertNoForbiddenFields, assertAllowlistKeys } from './types';
