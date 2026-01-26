/**
 * STATE MACHINE MODULE
 *
 * Centralized state transition validation for all entities.
 * Ensures consistent, auditable status changes across the system.
 *
 * Entities:
 * - Request: DRAFT → OPEN → ACCEPTED/CLOSED/CANCELLED
 * - Offer: DRAFT → SENT → ACCEPTED/REJECTED
 * - Order: CONFIRMED → IN_FULFILLMENT → SHIPPED → DELIVERED (+ CANCELLED branch)
 * - Import: NOT_REGISTERED → SUBMITTED → APPROVED/REJECTED
 */

// =============================================================================
// REQUEST STATUS
// =============================================================================

export const REQUEST_STATUSES = ['DRAFT', 'OPEN', 'ACCEPTED', 'CLOSED', 'CANCELLED'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['ACCEPTED', 'CLOSED', 'CANCELLED'],
  ACCEPTED: ['CLOSED'],  // Can close after acceptance (order completed)
  CLOSED: [],            // Terminal
  CANCELLED: [],         // Terminal
};

// =============================================================================
// OFFER STATUS
// =============================================================================

export const OFFER_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type OfferStatus = typeof OFFER_STATUSES[number];

const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ['SENT', 'EXPIRED'],
  SENT: ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
  VIEWED: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],          // Terminal - immutable
  REJECTED: [],          // Terminal
  EXPIRED: [],           // Terminal
};

// =============================================================================
// ORDER STATUS
// =============================================================================

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'IN_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_FULFILLMENT', 'CANCELLED'],
  IN_FULFILLMENT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],         // Terminal
  CANCELLED: [],         // Terminal
};

// =============================================================================
// IMPORT STATUS
// =============================================================================

export const IMPORT_STATUSES = ['NOT_REGISTERED', 'SUBMITTED', 'DOCS_PENDING', 'IN_TRANSIT', 'CLEARED', 'APPROVED', 'REJECTED', 'CLOSED'] as const;
export type ImportStatus = typeof IMPORT_STATUSES[number];

const IMPORT_TRANSITIONS: Record<ImportStatus, ImportStatus[]> = {
  NOT_REGISTERED: ['SUBMITTED'],
  SUBMITTED: ['DOCS_PENDING', 'APPROVED', 'REJECTED'],
  DOCS_PENDING: ['IN_TRANSIT', 'REJECTED'],
  IN_TRANSIT: ['CLEARED', 'REJECTED'],
  CLEARED: ['APPROVED', 'CLOSED'],
  APPROVED: ['CLOSED'],
  REJECTED: ['SUBMITTED'],  // Allow resubmission
  CLOSED: [],               // Terminal
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export class InvalidStatusTransitionError extends Error {
  constructor(
    public entity: string,
    public fromStatus: string,
    public toStatus: string,
    public allowedTransitions: string[]
  ) {
    super(
      `Invalid ${entity} status transition: Cannot change from "${fromStatus}" to "${toStatus}". ` +
      `Allowed transitions from "${fromStatus}": [${allowedTransitions.join(', ') || 'none (terminal state)'}]`
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

export function validateRequestTransition(from: RequestStatus, to: RequestStatus): void {
  const allowed = REQUEST_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError('request', from, to, allowed);
  }
}

export function validateOfferTransition(from: OfferStatus, to: OfferStatus): void {
  const allowed = OFFER_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError('offer', from, to, allowed);
  }
}

export function validateOrderTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError('order', from, to, allowed);
  }
}

export function validateImportTransition(from: ImportStatus, to: ImportStatus): void {
  const allowed = IMPORT_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError('import', from, to, allowed);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get allowed next statuses for an entity
 */
export function getAllowedTransitions(
  entity: 'request' | 'offer' | 'order' | 'import',
  currentStatus: string
): string[] {
  switch (entity) {
    case 'request':
      return REQUEST_TRANSITIONS[currentStatus as RequestStatus] || [];
    case 'offer':
      return OFFER_TRANSITIONS[currentStatus as OfferStatus] || [];
    case 'order':
      return ORDER_TRANSITIONS[currentStatus as OrderStatus] || [];
    case 'import':
      return IMPORT_TRANSITIONS[currentStatus as ImportStatus] || [];
    default:
      return [];
  }
}

/**
 * Check if a status is terminal (no further transitions allowed)
 */
export function isTerminalStatus(
  entity: 'request' | 'offer' | 'order' | 'import',
  status: string
): boolean {
  return getAllowedTransitions(entity, status).length === 0;
}

/**
 * Check if a transition is valid without throwing
 */
export function canTransition(
  entity: 'request' | 'offer' | 'order' | 'import',
  from: string,
  to: string
): boolean {
  return getAllowedTransitions(entity, from).includes(to);
}

// =============================================================================
// STATUS DISPLAY HELPERS
// =============================================================================

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: 'Utkast',
  OPEN: 'Öppen',
  ACCEPTED: 'Accepterad',
  CLOSED: 'Avslutad',
  CANCELLED: 'Avbruten',
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: 'Utkast',
  SENT: 'Skickad',
  VIEWED: 'Visad',
  ACCEPTED: 'Accepterad',
  REJECTED: 'Avvisad',
  EXPIRED: 'Utgången',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Väntar',
  CONFIRMED: 'Bekräftad',
  IN_FULFILLMENT: 'Under hantering',
  SHIPPED: 'Skickad',
  DELIVERED: 'Levererad',
  CANCELLED: 'Avbruten',
};

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  NOT_REGISTERED: 'Ej registrerad',
  SUBMITTED: 'Inskickad',
  DOCS_PENDING: 'Dokument saknas',
  IN_TRANSIT: 'Under transport',
  CLEARED: 'Tullklarerad',
  APPROVED: 'Godkänd',
  REJECTED: 'Avvisad',
  CLOSED: 'Avslutad',
};

/**
 * Get human-readable label for a status
 */
export function getStatusLabel(
  entity: 'request' | 'offer' | 'order' | 'import',
  status: string
): string {
  switch (entity) {
    case 'request':
      return REQUEST_STATUS_LABELS[status as RequestStatus] || status;
    case 'offer':
      return OFFER_STATUS_LABELS[status as OfferStatus] || status;
    case 'order':
      return ORDER_STATUS_LABELS[status as OrderStatus] || status;
    case 'import':
      return IMPORT_STATUS_LABELS[status as ImportStatus] || status;
    default:
      return status;
  }
}
