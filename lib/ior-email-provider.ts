/**
 * IOR EMAIL PROVIDER
 *
 * Abstraction for sending producer communication emails.
 * Implements provider pattern for easy switching between:
 * - Stub (development/testing)
 * - Resend (production)
 *
 * Features:
 * - Thread token injection for reply routing [WF:<token>]
 * - Fail-safe error handling
 * - Logging for debugging
 */

import { sendEmail } from './email-service';

// ============================================================================
// TYPES
// ============================================================================

export interface IOREmailMessage {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  threadToken: string;  // Token for reply routing [WF:<token>]
  caseId: string;
  producerName?: string;
}

export interface IOREmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IOREmailProvider {
  send(message: IOREmailMessage): Promise<IOREmailResult>;
}

// ============================================================================
// STUB PROVIDER (Development/Testing)
// ============================================================================

/**
 * Stub email provider - logs to console instead of sending
 * Used when IOR_EMAIL_PROVIDER=stub or in development
 */
class StubEmailProvider implements IOREmailProvider {
  async send(message: IOREmailMessage): Promise<IOREmailResult> {
    const subjectWithToken = this.injectThreadToken(message.subject, message.threadToken);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  📧 IOR EMAIL (STUB MODE)                                    ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  To: ${message.to.padEnd(54)}║`);
    console.log(`║  Subject: ${subjectWithToken.substring(0, 50).padEnd(50)}║`);
    console.log(`║  Case ID: ${message.caseId.padEnd(50)}║`);
    console.log(`║  Thread Token: ${message.threadToken.padEnd(45)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  Body Preview:                                               ║');
    const bodyLines = message.body.substring(0, 200).split('\n').slice(0, 4);
    for (const line of bodyLines) {
      console.log(`║  ${line.substring(0, 58).padEnd(58)}║`);
    }
    if (message.body.length > 200) {
      console.log('║  ...                                                         ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Simulate successful send
    return {
      success: true,
      messageId: `stub-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  private injectThreadToken(subject: string, token: string): string {
    return `${subject} [WF:${token}]`;
  }
}

// ============================================================================
// RESEND PROVIDER (Production)
// ============================================================================

/**
 * Resend email provider - uses existing email-service.ts
 * Used when IOR_EMAIL_PROVIDER=resend
 */
class ResendEmailProvider implements IOREmailProvider {
  async send(message: IOREmailMessage): Promise<IOREmailResult> {
    const subjectWithToken = this.injectThreadToken(message.subject, message.threadToken);

    // Build HTML body if not provided
    const htmlBody = message.bodyHtml || this.textToHtml(message.body, message.threadToken);

    // Build text body with reply instructions
    const textBody = this.appendReplyInstructions(message.body, message.threadToken);

    try {
      const result = await sendEmail({
        to: message.to,
        subject: subjectWithToken,
        html: htmlBody,
        text: textBody,
      });

      if (result.success) {
        return {
          success: true,
          messageId: `resend-${Date.now()}`,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error',
        };
      }
    } catch (error) {
      console.error('[IOR Email] Resend error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private injectThreadToken(subject: string, token: string): string {
    return `${subject} [WF:${token}]`;
  }

  private textToHtml(text: string, threadToken: string): string {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">${escapedText}</div>
    <div class="footer">
      <p>Reply to this email to continue the conversation.</p>
      <p style="color: #999; font-size: 10px;">Reference: WF:${threadToken}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private appendReplyInstructions(text: string, threadToken: string): string {
    return `${text}

---
Reply to this email to continue the conversation.
Reference: WF:${threadToken}`;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Get configured email provider
 *
 * Configuration via IOR_EMAIL_PROVIDER env var:
 * - 'stub' (default): Console logging only
 * - 'resend': Send via Resend API
 */
export function getIOREmailProvider(): IOREmailProvider {
  const provider = process.env.IOR_EMAIL_PROVIDER || 'stub';

  switch (provider) {
    case 'resend':
      return new ResendEmailProvider();
    case 'stub':
    default:
      return new StubEmailProvider();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a unique thread token for email reply routing
 * Format: WF-<8 char random string>
 */
export function generateThreadToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'WF-';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Extract thread token from email subject or body
 * Looks for pattern [WF:<token>]
 *
 * @param text - Email subject, body, or "to" address
 * @returns Thread token or null if not found
 */
export function extractThreadToken(text: string): string | null {
  // Pattern: [WF:xxxx] or WF:xxxx or reply+WF-xxxx@
  const patterns = [
    /\[WF:([a-zA-Z0-9-]+)\]/,        // [WF:token]
    /\bWF:([a-zA-Z0-9-]+)\b/,         // WF:token
    /reply\+WF-([a-zA-Z0-9-]+)@/i,    // reply+WF-token@domain
    /\bWF-([a-zA-Z0-9-]+)\b/,         // WF-token
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Normalize to WF-xxx format
      const token = match[1];
      return token.startsWith('WF-') ? token : `WF-${token}`;
    }
  }

  return null;
}

/**
 * Build reply-to address with embedded token
 * Example: reply+WF-abc123@winefeed.se
 */
export function buildReplyToAddress(threadToken: string): string {
  const domain = process.env.IOR_EMAIL_REPLY_DOMAIN || 'winefeed.se';
  return `reply+${threadToken}@${domain}`;
}
