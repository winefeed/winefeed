/**
 * IOR MESSAGE TEMPLATES
 *
 * Pre-defined templates for common producer communications.
 * Templates define subject, body, and variable placeholders.
 *
 * Usage:
 *   const template = getTemplate('price_update_request');
 *   const rendered = renderTemplate(template, { producer_contact: 'Maria', market: 'Sweden' });
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'pricing' | 'logistics' | 'quality' | 'general';
  subject: string;
  body: string;
  variables: string[];  // Placeholders like {{producer_contact}}
  sla_days?: number;    // Default SLA for due_at calculation
}

// ============================================================================
// TEMPLATES
// ============================================================================

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'price_update_request',
    name: 'Price Update Request',
    category: 'pricing',
    subject: 'Request for Updated Price List - {{market}}',
    body: `Dear {{producer_contact}},

We are preparing for the upcoming season and would like to request your updated price list for the {{market}} market.

Please include:
- Current vintage availability
- Ex-cellar prices in EUR
- Minimum order quantities
- Expected delivery lead times

We look forward to hearing from you.

Best regards,
{{sender_name}}
{{company_name}}`,
    variables: ['producer_contact', 'market', 'sender_name', 'company_name'],
    sla_days: 14,
  },
  {
    id: 'delivery_eta_inquiry',
    name: 'Delivery ETA Inquiry',
    category: 'logistics',
    subject: 'Delivery Status Inquiry - Order {{order_ref}}',
    body: `Dear {{producer_contact}},

We would like to inquire about the delivery status of order {{order_ref}}.

Could you please provide:
- Current shipment status
- Expected dispatch date
- Estimated arrival date
- Tracking information (if available)

Thank you for your assistance.

Best regards,
{{sender_name}}
{{company_name}}`,
    variables: ['producer_contact', 'order_ref', 'sender_name', 'company_name'],
    sla_days: 3,
  },
  {
    id: 'quality_feedback',
    name: 'Quality Feedback',
    category: 'quality',
    subject: 'Product Quality Feedback - {{product_name}}',
    body: `Dear {{producer_contact}},

We wanted to share feedback regarding {{product_name}} ({{vintage}}).

{{feedback_details}}

Please let us know if you would like to discuss this further or if you need any additional information.

Best regards,
{{sender_name}}
{{company_name}}`,
    variables: ['producer_contact', 'product_name', 'vintage', 'feedback_details', 'sender_name', 'company_name'],
    sla_days: 7,
  },
  {
    id: 'document_request',
    name: 'Document Request',
    category: 'logistics',
    subject: 'Document Request - {{document_type}}',
    body: `Dear {{producer_contact}},

We kindly request the following document(s) for {{order_ref}}:

{{document_type}}

This is required for customs clearance / compliance purposes.

Please send the document(s) at your earliest convenience.

Best regards,
{{sender_name}}
{{company_name}}`,
    variables: ['producer_contact', 'order_ref', 'document_type', 'sender_name', 'company_name'],
    sla_days: 5,
  },
  {
    id: 'allocation_inquiry',
    name: 'Allocation Inquiry',
    category: 'pricing',
    subject: 'Allocation Inquiry - {{vintage}} Vintage',
    body: `Dear {{producer_contact}},

We are interested in securing our allocation for the {{vintage}} vintage.

Could you please provide information on:
- Expected release date
- Allocated quantities for our market
- Pricing (if available)
- Any new releases or special cuvées

We appreciate your partnership and look forward to your response.

Best regards,
{{sender_name}}
{{company_name}}`,
    variables: ['producer_contact', 'vintage', 'sender_name', 'company_name'],
    sla_days: 21,
  },
  {
    id: 'general_inquiry',
    name: 'General Inquiry',
    category: 'general',
    subject: '{{subject_line}}',
    body: `Dear {{producer_contact}},

{{message_body}}

Best regards,
{{sender_name}}
{{company_name}}`,
    variables: ['producer_contact', 'subject_line', 'message_body', 'sender_name', 'company_name'],
    sla_days: 14,
  },
];

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get all templates, optionally filtered by category
 */
export function getTemplates(category?: string): MessageTemplate[] {
  if (!category) {
    return MESSAGE_TEMPLATES;
  }
  return MESSAGE_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get templates grouped by category
 */
export function getTemplatesGrouped(): Record<string, MessageTemplate[]> {
  const grouped: Record<string, MessageTemplate[]> = {};

  for (const template of MESSAGE_TEMPLATES) {
    if (!grouped[template.category]) {
      grouped[template.category] = [];
    }
    grouped[template.category].push(template);
  }

  return grouped;
}

/**
 * Render template with variable substitution
 *
 * @param template - The template to render
 * @param variables - Key-value pairs for variable substitution
 * @returns Rendered subject and body
 */
export function renderTemplate(
  template: MessageTemplate,
  variables: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  // Replace all variables
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    subject = subject.replace(regex, value || '');
    body = body.replace(regex, value || '');
  }

  // Warn about unreplaced variables in development
  if (process.env.NODE_ENV === 'development') {
    const unresolved = body.match(/\{\{[^}]+\}\}/g);
    if (unresolved) {
      console.warn(`[IOR Templates] Unresolved variables in template ${template.id}:`, unresolved);
    }
  }

  return { subject, body };
}

/**
 * Validate that all required variables are provided
 */
export function validateTemplateVariables(
  template: MessageTemplate,
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const variable of template.variables) {
    if (!variables[variable] || variables[variable].trim() === '') {
      missing.push(variable);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Calculate due date based on template SLA
 */
export function calculateDueDate(template: MessageTemplate): Date | null {
  if (!template.sla_days) {
    return null;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + template.sla_days);
  return dueDate;
}
