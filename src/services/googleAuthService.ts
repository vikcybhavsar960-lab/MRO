import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BrandMasterItem,
  Customer,
  EmailRfqItem,
  ExtractedEmailItem,
  ProductItem,
  Vendor,
} from '../types';
import { fetchApi } from '../utils/apiClient';
import { isStaticSpaFallbackResponse } from '../utils/staticSpaRuntime';
import { appendSyncLog, loadEmailConfig, saveEmailConfig, loadEmailRfqs, saveEmailRfqs } from './emailRfqService';
import {
  buildSafeEmailDiagnostic,
  extractGmailMessageContent,
  formatDiagnosticLines,
  parseEmailRequirementWithCatalogue,
  parseSpreadsheetBufferToEmailItems,
} from './emailRequirementPipeline';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// In-memory token cache (NEVER in localStorage/sessionStorage per security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain access token from Google sign in');
    }
    cachedAccessToken = credential.accessToken;

    // Update email config state
    const cfg = loadEmailConfig();
    cfg.isConnected = true;
    cfg.connectedAt = new Date().toISOString();
    cfg.emailAddress = result.user.email || cfg.emailAddress;
    cfg.status = 'CONNECTED';
    saveEmailConfig(cfg);

    appendSyncLog({
      provider: 'GMAIL',
      status: 'SUCCESS',
      messagesFound: 0,
      newDraftsCreated: 0,
      duplicatesSkipped: 0,
      details: `Google Workspace authorized for ${result.user.email}`,
    });

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  const cfg = loadEmailConfig();
  cfg.isConnected = false;
  cfg.status = 'DISCONNECTED';
  saveEmailConfig(cfg);
};

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const binary = atob(normalized + '='.repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export interface GmailSyncContext {
  customers?: Customer[];
  products?: ProductItem[];
  brands?: BrandMasterItem[];
  vendors?: Vendor[];
}

// Sync real emails from Gmail API with full recursive MIME body + attachment retrieval & catalogue verification
export const fetchAndSyncGmailMessages = async (
  onProgress?: (msg: string) => void,
  syncContext?: GmailSyncContext
): Promise<{ success: boolean; newCount: number; message: string; diagnosticLines?: string[] }> => {
  const token = cachedAccessToken;
  const cfg = loadEmailConfig();

  if (!token) {
    const diag = buildSafeEmailDiagnostic({
      emailReceived: false,
      messageRetrieved: false,
      parserStarted: false,
      extractedItemCount: 0,
      parserEngine: 'GMAIL_OAUTH_REQUIRED',
      notes: 'No active Google Workspace Gmail OAuth session in memory. Click "Email Settings -> Connect with Google Workspace" to authorize live mailbox retrieval, or use "Parse Email Text / Upload Attachment".',
    });

    appendSyncLog({
      provider: 'GMAIL',
      status: 'ERROR',
      messagesFound: 0,
      newDraftsCreated: 0,
      duplicatesSkipped: 0,
      details: `${formatDiagnosticLines(diag).join(' | ')} — Gmail OAuth session required.`,
    });

    return {
      success: false,
      newCount: 0,
      message:
        'Gmail is not actively authorized in this browser session. Open Email Settings -> Connect with Google Workspace to fetch live emails (or use Parse Email Text / Upload Attachment).',
      diagnosticLines: formatDiagnosticLines(diag),
    };
  }

  try {
    onProgress?.('Querying Gmail API for procurement, requirement & RFQ emails...');

    const query = encodeURIComponent(
      'in:inbox (RFQ OR Enquiry OR Inquiry OR Requirement OR Quotation OR Quote OR Spares OR Material OR MCB OR Bearing OR Valve OR Motor)'
    );
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) {
      if (listRes.status === 401) {
        cachedAccessToken = null;
      }
      throw new Error(`Gmail API HTTP ${listRes.status}: ${listRes.statusText}`);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      appendSyncLog({
        provider: 'GMAIL',
        status: 'SUCCESS',
        messagesFound: 0,
        newDraftsCreated: 0,
        duplicatesSkipped: 0,
        details: 'Email Received: NO | Message Retrieved: NO | Parser Started: NO — No matching requirement emails found.',
      });
      return { success: true, newCount: 0, message: 'No new requirement emails found in inbox.' };
    }

    const currentRfqs = loadEmailRfqs();
    let newDraftCount = 0;
    let dupCount = 0;
    let lastDiagLines: string[] = [];

    for (const m of messages.slice(0, 6)) {
      onProgress?.(`Retrieving full email message ${m.id}...`);
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      // Recursively extract headers, plain text, HTML body, and ALL nested attachments
      const extracted = extractGmailMessageContent(msgData);

      // Deduplicate strictly by Gmail messageId
      const alreadyExists = currentRfqs.some((r) => r.messageId === extracted.messageId);
      if (alreadyExists) {
        dupCount++;
        continue;
      }

      // Retrieve & parse supported attachments (Excel, CSV, PDF, JPG, JPEG, PNG, WEBP)
      const attachmentItems: ExtractedEmailItem[] = [];
      const inlineAiAttachments: Array<{ name: string; mimeType: string; base64Data: string }> = [];
      const attachmentMeta: Array<{ name: string; size: string; type: string; extractedCount?: number }> = [];
      let retrievedAttachmentFiles = 0;

      for (const att of extracted.attachments.slice(0, 5)) {
        const lowerName = att.filename.toLowerCase();
        const isExcelOrCsv = /\.(xlsx|xls|csv)$/i.test(lowerName) || /spreadsheet|excel|csv/i.test(att.mimeType);
        const isPdfOrImage =
          /\.(pdf|jpg|jpeg|png|webp)$/i.test(lowerName) ||
          /^(application\/pdf|image\/(jpeg|jpg|png|webp))$/i.test(att.mimeType);

        let attExtractedCount = 0;

        if ((isExcelOrCsv || isPdfOrImage) && att.attachmentId && att.size <= 10 * 1024 * 1024) {
          try {
            onProgress?.(`Downloading attachment "${att.filename}"...`);
            const attRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}/attachments/${encodeURIComponent(att.attachmentId)}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (attRes.ok) {
              const attJson = await attRes.json();
              if (attJson?.data) {
                retrievedAttachmentFiles++;
                const bytes = base64UrlToUint8Array(attJson.data);
                if (isExcelOrCsv) {
                  const parsedSheetItems = parseSpreadsheetBufferToEmailItems(bytes, {
                    subject: extracted.subject,
                    brands: syncContext?.brands || [],
                    products: syncContext?.products || [],
                    vendors: syncContext?.vendors || [],
                  });
                  attExtractedCount = parsedSheetItems.length;
                  attachmentItems.push(...parsedSheetItems);
                } else if (isPdfOrImage) {
                  inlineAiAttachments.push({
                    name: att.filename,
                    mimeType:
                      att.mimeType ||
                      (lowerName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
                    base64Data: uint8ArrayToBase64(bytes),
                  });
                }
              }
            }
          } catch (attErr) {
            console.warn(`[Gmail Sync] Attachment retrieval skipped for ${att.filename}:`, attErr);
          }
        }

        attachmentMeta.push({
          name: att.filename,
          size: att.size ? `${Math.max(1, Math.round(att.size / 1024))} KB` : 'Attached',
          type: att.mimeType || 'Document',
          extractedCount: attExtractedCount,
        });
      }

      onProgress?.(`Parsing "${extracted.subject}" & matching ERP Brand Catalogue...`);

      // Attempt server-side Gemini multimodal extraction (body + PDF/Image attachments) if Express backend is present
      let aiExtracted: any = null;
      let parserEngine = 'DETERMINISTIC_CATALOGUE_MATCHER';
      try {
        const extRes = await fetchApi('/api/extract-email-rfq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailSubject: extracted.subject,
            senderEmail: extracted.senderEmail,
            senderName: extracted.senderName,
            emailBody: extracted.combinedBodyText,
            attachments: attachmentMeta.map((a) => ({ name: a.name, type: a.type })),
            inlineAttachments: inlineAiAttachments.slice(0, 3),
          }),
          timeoutMs: 45000,
        });
        if (!isStaticSpaFallbackResponse(extRes) && extRes.ok) {
          const extJson = await extRes.json().catch(() => null);
          if (extJson?.extracted) {
            aiExtracted = extJson.extracted;
            parserEngine = `AI_${extJson.modelUsed || 'GEMINI'}+CATALOGUE_MATCHER`;
          }
        }
      } catch (err) {
        console.warn('[Gmail Sync] Server AI extraction unavailable; using deterministic + catalogue matcher:', err);
      }

      // ALWAYS combine Email Body + Attachments + AI Extraction + Existing ERP Brand/Product Catalogue
      const parsed = parseEmailRequirementWithCatalogue({
        rawText: extracted.combinedBodyText,
        subject: extracted.subject,
        senderEmail: extracted.senderEmail,
        senderName: extracted.senderName,
        customers: syncContext?.customers || [],
        products: syncContext?.products || [],
        brands: syncContext?.brands || [],
        vendors: syncContext?.vendors || [],
        attachmentItems,
        attachmentCount: extracted.attachments.length,
        aiItems: Array.isArray(aiExtracted?.detectedItems) ? aiExtracted.detectedItems : undefined,
        parserEngine,
      });

      const diagnostic = {
        ...parsed.diagnostic,
        attachmentRetrieved:
          extracted.attachments.length > 0 && retrievedAttachmentFiles > 0 ? ('YES' as const) : ('NO' as const),
        attachmentsExtractedCount: attachmentItems.length + inlineAiAttachments.length,
      };
      lastDiagLines = formatDiagnosticLines(diagnostic);

      const newEmailItem: EmailRfqItem = {
        id: `EML-${Date.now().toString().slice(-6)}-${newDraftCount + 1}`,
        messageId: extracted.messageId,
        senderEmail: extracted.senderEmail,
        senderName: extracted.senderName,
        companyName: aiExtracted?.companyName || parsed.companyName || extracted.senderName || 'Email Sender',
        contactPerson: aiExtracted?.contactPerson || parsed.contactPerson || extracted.senderName,
        mobile: aiExtracted?.mobile || parsed.mobile || '',
        subject: extracted.subject,
        receivedDate: extracted.receivedDate,
        bodySnippet: (msgData.snippet || extracted.combinedBodyText.slice(0, 180)).trim(),
        fullBodyText: extracted.combinedBodyText,
        htmlBodyText: extracted.htmlBody || undefined,
        detectedItems: parsed.items,
        matchedCustomerId: parsed.matchedCustomer?.id,
        status: parsed.items.length > 0 ? 'DRAFT_READY' : 'NEEDS_ATTENTION',
        attachments: attachmentMeta,
        deliveryTerms: aiExtracted?.deliveryLocation || parsed.deliveryTerms,
        paymentTerms: aiExtracted?.paymentTerms || parsed.paymentTerms,
        remarks: aiExtracted?.remarks || 'Synced from Google Workspace Gmail inbox',
        diagnostic,
      };

      currentRfqs.unshift(newEmailItem);
      newDraftCount++;
    }

    saveEmailRfqs(currentRfqs);
    cfg.lastSyncedAt = new Date().toISOString();
    saveEmailConfig(cfg);

    appendSyncLog({
      provider: 'GMAIL',
      status: 'SUCCESS',
      messagesFound: messages.length,
      newDraftsCreated: newDraftCount,
      duplicatesSkipped: dupCount,
      details: `${lastDiagLines.join(' | ')} — ${newDraftCount} new requirement draft(s), ${dupCount} duplicate(s) skipped.`,
    });

    return {
      success: true,
      newCount: newDraftCount,
      message: `Sync complete: ${newDraftCount} new requirement draft(s) extracted (${dupCount} already imported). Open any email to auto-fill the Requirement Form.`,
      diagnosticLines: lastDiagLines,
    };
  } catch (error: any) {
    console.error('Gmail Sync Error:', error);
    appendSyncLog({
      provider: 'GMAIL',
      status: 'ERROR',
      messagesFound: 0,
      newDraftsCreated: 0,
      duplicatesSkipped: 0,
      details: error?.message || 'Sync failed due to network or authentication issue.',
    });
    return {
      success: false,
      newCount: 0,
      message: error?.message || 'Failed to sync emails from Gmail.',
    };
  }
};
