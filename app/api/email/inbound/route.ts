/**
 * INBOUND EMAIL WEBHOOK
 *
 * POST /api/email/inbound - Receive inbound email replies from producers
 *
 * Security:
 * - Protected by x-wf-inbound-secret header (env: INBOUND_EMAIL_SECRET)
 * - No session auth required (producers don't log in)
 * - Uses service role via iorPortfolioService
 *
 * Expected payload (compatible with common email webhook providers):
 * {
 *   to: string,           // e.g., "reply+WF-abc123@winefeed.se"
 *   from: string,         // e.g., "producer@example.com"
 *   subject: string,      // May contain [WF:token]
 *   text: string,         // Plain text body
 *   html?: string,        // HTML body (optional)
 *   attachments?: Array<{ name, url, size, type }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateInboundSecret } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';
import { extractThreadToken } from '@/lib/ior-email-provider';

export async function POST(request: NextRequest) {
  try {
    // Validate secret
    if (!validateInboundSecret(request)) {
      console.warn('[API] Inbound email rejected: invalid or missing secret');
      return NextResponse.json(
        { error: 'Forbidden - invalid or missing x-wf-inbound-secret' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Extract required fields
    const { to, from, subject, text, html, attachments } = body;

    if (!from || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: from, text' },
        { status: 400 }
      );
    }

    // Extract thread token from to address, subject, or body
    const tokenSources = [to, subject, text].filter(Boolean).join(' ');
    const threadToken = extractThreadToken(tokenSources);

    if (!threadToken) {
      console.warn('[API] Inbound email: no thread token found in:', { to, subject: subject?.substring(0, 50) });
      return NextResponse.json(
        { error: 'No thread token found in email. Cannot route to case.' },
        { status: 400 }
      );
    }

    // Extract sender name from "Name <email>" format or use email
    let senderName = from;
    let senderEmail = from;
    const emailMatch = from.match(/^(.+?)\s*<(.+)>$/);
    if (emailMatch) {
      senderName = emailMatch[1].trim();
      senderEmail = emailMatch[2].trim();
    }

    // Process inbound email
    const result = await iorPortfolioService.ingestInboundEmail({
      threadToken,
      senderEmail,
      senderName,
      subject,
      content: text,
      contentHtml: html,
      attachments: attachments || [],
    });

    if (!result) {
      console.warn('[API] Inbound email: thread not found for token:', threadToken);
      return NextResponse.json(
        { error: 'Thread not found for token' },
        { status: 404 }
      );
    }

    console.log('[API] Inbound email processed:', {
      case_id: result.case_id,
      message_id: result.message_id,
      from: senderEmail,
    });

    return NextResponse.json({
      success: true,
      case_id: result.case_id,
      message_id: result.message_id,
    });
  } catch (error) {
    console.error('[API] POST /api/email/inbound error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
