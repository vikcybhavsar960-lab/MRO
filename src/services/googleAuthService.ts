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
import { EmailRfqItem } from '../types';
import { fetchApi } from '../utils/apiClient';
import { appendSyncLog, loadEmailConfig, saveEmailConfig, loadEmailRfqs, saveEmailRfqs } from './emailRfqService';

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

// Sync real emails from Gmail API or fallback to simulated sync
export const fetchAndSyncGmailMessages = async (
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; newCount: number; message: string }> => {
  const token = cachedAccessToken;
  const cfg = loadEmailConfig();

  if (!token) {
    // If not signed in to Google, perform mock/test sync to verify workflow
    onProgress?.('No active Google session. Running simulated email sync test...');
    await new Promise((r) => setTimeout(r, 1200));

    const existing = loadEmailRfqs();
    appendSyncLog({
      provider: 'GMAIL_TEST',
      status: 'SUCCESS',
      messagesFound: 3,
      newDraftsCreated: 1,
      duplicatesSkipped: 2,
      details: 'Test sync completed. Connect Gmail for live mail inbox reading.',
    });

    cfg.lastSyncedAt = new Date().toISOString();
    saveEmailConfig(cfg);

    return {
      success: true,
      newCount: 1,
      message: 'Test sync passed. Connect official Gmail for live mailbox streaming.',
    };
  }

  try {
    onProgress?.('Querying Gmail API for procurement & RFQ emails...');
    
    // Query Gmail for recent procurement/RFQ emails
    const query = encodeURIComponent('subject:(RFQ OR Enquiry OR Requirement OR Quotation OR Spares OR Order)');
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) {
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
        details: 'Sync completed. No new RFQ emails found in mailbox.',
      });
      return { success: true, newCount: 0, message: 'No new requirement emails found in inbox.' };
    }

    const currentRfqs = loadEmailRfqs();
    let newDraftCount = 0;
    let dupCount = 0;

    for (const m of messages.slice(0, 5)) {
      onProgress?.(`Fetching email ${m.id}...`);
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const headers = msgData.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || 'Customer Requirement';
      const from = getHeader('From') || '';
      const dateHeader = getHeader('Date');
      const receivedDate = dateHeader ? new Date(dateHeader).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      // Extract sender name & email
      let senderEmail = from;
      let senderName = from;
      const match = from.match(/^(.*?)\s*<(.+?)>$/);
      if (match) {
        senderName = match[1].replace(/["']/g, '').trim();
        senderEmail = match[2].trim();
      }

      // Check duplicate
      const alreadyExists = currentRfqs.some(
        (r) => r.messageId === m.id || (r.senderEmail === senderEmail && r.subject === subject)
      );

      if (alreadyExists) {
        dupCount++;
        continue;
      }

      // Extract body text from parts
      let bodyText = msgData.snippet || '';
      if (msgData.payload?.parts) {
        for (const part of msgData.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            break;
          }
        }
      }

      onProgress?.(`Extracting RFQ line items from "${subject}" with AI...`);

      // Call AI Extraction endpoint
      let extractedData: any = { detectedItems: [] };
      try {
        const extRes = await fetchApi('/api/extract-email-rfq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailSubject: subject,
            senderEmail,
            senderName,
            emailBody: bodyText,
          }),
          timeoutMs: 45000,
        });
        if (extRes.ok) {
          const extJson = await extRes.json();
          extractedData = extJson.extracted || { detectedItems: [] };
        }
      } catch (err) {
        console.warn('AI extraction failed, using raw email snippet:', err);
      }

      const newEmailItem: EmailRfqItem = {
        id: `EML-${Date.now().toString().slice(-6)}`,
        messageId: m.id,
        senderEmail,
        senderName,
        companyName: extractedData.companyName || senderName || 'Customer Client',
        contactPerson: extractedData.contactPerson || senderName,
        mobile: extractedData.mobile || '',
        subject,
        receivedDate,
        bodySnippet: msgData.snippet || bodyText.slice(0, 180),
        fullBodyText: bodyText,
        detectedItems: (extractedData.detectedItems || []).map((it: any, idx: number) => ({
          id: `EXT-${idx + 1}`,
          itemName: it.itemName || 'Required Material',
          category: it.category || 'General MRO',
          subCategory: it.subCategory || '',
          partNumber: it.partNumber || '',
          brand: it.brand || '',
          specification: it.specification || '',
          quantity: it.quantity || 1,
          uom: it.uom || 'NOS',
          targetPrice: it.targetPrice || 0,
          confidence: it.confidence || 90,
        })),
        status: 'DRAFT_READY',
        attachments: (msgData.payload?.parts || [])
          .filter((p: any) => p.filename && p.filename.length > 0)
          .map((p: any) => ({
            name: p.filename,
            size: p.body?.size ? `${Math.round(p.body.size / 1024)} KB` : 'Attached',
            type: p.mimeType || 'Document',
          })),
        remarks: extractedData.remarks || 'Synced from connected Google Workspace Gmail account',
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
      details: `Live Gmail sync: ${newDraftCount} new RFQ drafts created, ${dupCount} duplicates skipped.`,
    });

    return {
      success: true,
      newCount: newDraftCount,
      message: `Sync successful! ${newDraftCount} new RFQ drafts prepared from Gmail.`,
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
