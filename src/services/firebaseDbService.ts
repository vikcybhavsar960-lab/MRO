import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  collection,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DEFAULT_WORKSPACE_ID,
  WorkspaceWriteContext,
  boundStringList,
  buildEntityDocPayload,
  buildTombstoneDocPayload,
  buildVendorDocPayload,
  emailToInviteId,
  extractEntityRecord,
  isBootstrappedAdminEmail,
  normalizeEmail,
  sanitizeDocId,
  stripUndefinedDeep,
  truncateString,
} from './firebasePayloadHelpers';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(app);
export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();

// Basic identity provider ONLY (never attaches Gmail/Sheets scopes so standard Cloud DB sign-in always succeeds)
const cloudDbProvider = new GoogleAuthProvider();
cloudDbProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudWorkspaceDoc {
  id: string;
  companyName: string;
  ownerUid: string;
  ownerEmail: string;
  memberUids: string[];
  invitedEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type WorkspaceCollectionName =
  | 'vendors'
  | 'customers'
  | 'companies'
  | 'purchaseExecutives'
  | 'products'
  | 'brands'
  | 'categories'
  | 'productTypes'
  | 'vendorProductMappings'
  | 'requirements'
  | 'vendorQuotes'
  | 'quotations'
  | 'customerPos'
  | 'vendorPos'
  | 'proformaInvoices'
  | 'payments'
  | 'dispatches'
  | 'deliveries'
  | 'tombstones'
  | 'settings';

export const ERP_WORKSPACE_COLLECTIONS: WorkspaceCollectionName[] = [
  'vendors',
  'customers',
  'companies',
  'purchaseExecutives',
  'products',
  'brands',
  'categories',
  'productTypes',
  'vendorProductMappings',
  'requirements',
  'vendorQuotes',
  'quotations',
  'customerPos',
  'vendorPos',
  'proformaInvoices',
  'payments',
  'dispatches',
  'deliveries',
  'tombstones',
  'settings',
];

export async function testFirestoreConnection(): Promise<{ reachable: boolean; offline: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { reachable: false, offline: true };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { reachable: true, offline: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Cloud Firestore client could not reach backend immediately; will auto-retry when online.');
      return { reachable: false, offline: true };
    }
    // Expected when /test/connection does not exist or before Google auth completes
    return { reachable: true, offline: false };
  }
}

export function subscribeToCloudAuth(cb: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(firebaseAuth, cb);
}

export async function signInCloudWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(firebaseAuth, cloudDbProvider);
  return result.user;
}

export async function signOutCloud(): Promise<void> {
  await signOut(firebaseAuth);
}

function buildContextFromWorkspace(
  ws: CloudWorkspaceDoc,
  actorUid: string
): WorkspaceWriteContext {
  return {
    workspaceId: ws.id,
    ownerUid: ws.ownerUid,
    createdByUid: actorUid,
    memberUids: ws.memberUids,
    invitedEmails: ws.invitedEmails,
  };
}

export async function ensureWorkspaceAccess(
  companyName = 'MRO Procurement & Solutions ERP'
): Promise<
  | { ok: true; workspace: CloudWorkspaceDoc; user: FirebaseUser; isAdmin: boolean }
  | { ok: false; reason: 'NOT_SIGNED_IN' | 'EMAIL_NOT_VERIFIED' | 'NOT_INVITED' | 'WORKSPACE_NOT_INITIALIZED'; message: string }
> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    return {
      ok: false,
      reason: 'NOT_SIGNED_IN',
      message: 'Sign in with Google to connect permanent Cloud Firestore storage.',
    };
  }
  if (!user.emailVerified) {
    return {
      ok: false,
      reason: 'EMAIL_NOT_VERIFIED',
      message: 'Your Google account email must be verified before accessing the Cloud ERP database.',
    };
  }

  const userEmail = normalizeEmail(user.email);
  const adminFlag = isBootstrappedAdminEmail(userEmail);

  // Ensure /users/{uid} and /users/{uid}/private/info exist cleanly
  const userProfileRef = doc(db, 'users', user.uid);
  const userPrivateRef = doc(db, 'users', user.uid, 'private', 'info');
  try {
    const profileSnap = await getDoc(userProfileRef);
    if (!profileSnap.exists()) {
      await setDoc(userProfileRef, {
        uid: user.uid,
        displayName: truncateString(user.displayName || userEmail.split('@')[0], 120, 'Operator'),
        role: 'MEMBER',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const privateSnap = await getDoc(userPrivateRef);
    if (!privateSnap.exists()) {
      await setDoc(userPrivateRef, {
        uid: user.uid,
        email: truncateString(userEmail, 160, 'user@example.com'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }

  if (adminFlag) {
    const adminRef = doc(db, 'admins', user.uid);
    try {
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email: truncateString(userEmail, 160),
          grantedBy: 'BOOTSTRAPPED_ADMIN',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
    }
  }

  const wsRef = doc(db, 'workspaces', DEFAULT_WORKSPACE_ID);
  let wsSnap;
  try {
    wsSnap = await getDoc(wsRef);
  } catch (err) {
    // Non-admin user probing before they are invited gets permission-denied on workspace root
    if (!adminFlag) {
      return {
        ok: false,
        reason: 'NOT_INVITED',
        message: `Google account (${userEmail}) is not yet invited to the company Cloud Workspace. Ask Admin (vikcybhavsar960@gmail.com) to add your Gmail in Team Access.`,
      };
    }
    handleFirestoreError(err, OperationType.GET, `workspaces/${DEFAULT_WORKSPACE_ID}`);
  }

  if (!wsSnap.exists()) {
    if (!adminFlag) {
      return {
        ok: false,
        reason: 'WORKSPACE_NOT_INITIALIZED',
        message: 'Ask Admin (vikcybhavsar960@gmail.com) to sign in with Google once to initialize the shared Cloud Workspace.',
      };
    }
    const initialWs: CloudWorkspaceDoc = {
      id: DEFAULT_WORKSPACE_ID,
      companyName: truncateString(companyName, 200, 'MRO Procurement ERP'),
      ownerUid: user.uid,
      ownerEmail: userEmail,
      memberUids: [user.uid],
      invitedEmails: boundStringList(['vikcybhavsar960@gmail.com', 'vickybhavsar960@gmail.com', userEmail], 20, true),
    };
    try {
      const batch = writeBatch(db);
      batch.set(wsRef, {
        ...initialWs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'workspaces', DEFAULT_WORKSPACE_ID, 'members', user.uid), {
        uid: user.uid,
        email: userEmail,
        displayName: truncateString(user.displayName || 'Vicky Bhavsar', 120, 'Admin'),
        erpRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return { ok: true, workspace: initialWs, user, isAdmin: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `workspaces/${DEFAULT_WORKSPACE_ID}`);
    }
  }

  const rawWs = wsSnap.data() as CloudWorkspaceDoc;
  const currentMembers = boundStringList(rawWs.memberUids, 20);
  const currentInvites = boundStringList(rawWs.invitedEmails, 20, true);
  const isMemberAlready = currentMembers.includes(user.uid);
  const isInvitedEmail = currentInvites.includes(userEmail);

  if (!adminFlag && !isMemberAlready && !isInvitedEmail && rawWs.ownerUid !== user.uid) {
    return {
      ok: false,
      reason: 'NOT_INVITED',
      message: `Google account (${userEmail}) is not authorized in this workspace. Ask Admin to add it under Team Google Access.`,
    };
  }

  // Atomically claim workspace membership if joining for the first time (or admin joining alternate Gmail)
  if (!isMemberAlready || (adminFlag && !currentInvites.includes(userEmail))) {
    const nextMemberUids = boundStringList([...currentMembers, user.uid], 20);
    const nextInvitedEmails = adminFlag
      ? boundStringList([...currentInvites, userEmail], 20, true)
      : currentInvites;

    const batch = writeBatch(db);
    if (adminFlag) {
      batch.update(wsRef, {
        memberUids: nextMemberUids,
        invitedEmails: nextInvitedEmails,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(wsRef, {
        memberUids: nextMemberUids,
        updatedAt: serverTimestamp(),
      });
    }

    const memberRef = doc(db, 'workspaces', DEFAULT_WORKSPACE_ID, 'members', user.uid);
    batch.set(memberRef, {
      uid: user.uid,
      email: userEmail,
      displayName: truncateString(user.displayName || userEmail.split('@')[0], 120, 'Team User'),
      erpRole: adminFlag ? 'SUPER_ADMIN' : 'PROCUREMENT_EMPLOYEE',
      status: 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      return {
        ok: true,
        workspace: {
          ...rawWs,
          memberUids: nextMemberUids,
          invitedEmails: nextInvitedEmails,
        },
        user,
        isAdmin: adminFlag,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `workspaces/${DEFAULT_WORKSPACE_ID}`);
    }
  }

  return {
    ok: true,
    workspace: {
      ...rawWs,
      memberUids: currentMembers,
      invitedEmails: currentInvites,
    },
    user,
    isAdmin: adminFlag,
  };
}

export async function inviteWorkspaceMemberEmail(
  workspace: CloudWorkspaceDoc,
  rawEmail: string,
  displayName = '',
  erpRole = 'PROCUREMENT_EMPLOYEE'
): Promise<CloudWorkspaceDoc> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Must be signed in to invite teammates.');
  const cleanEmail = normalizeEmail(rawEmail);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid Gmail / Google email address.');
  }
  const nextInvited = boundStringList([...workspace.invitedEmails, cleanEmail], 20, true);
  const wsRef = doc(db, 'workspaces', workspace.id);
  const inviteId = emailToInviteId(cleanEmail);
  const inviteRef = doc(db, 'workspaces', workspace.id, 'invites', inviteId);

  try {
    const batch = writeBatch(db);
    batch.update(wsRef, {
      invitedEmails: nextInvited,
      updatedAt: serverTimestamp(),
    });
    batch.set(inviteRef, {
      id: inviteId,
      email: cleanEmail,
      displayName: truncateString(displayName, 120, cleanEmail.split('@')[0]),
      erpRole: truncateString(erpRole, 64, 'PROCUREMENT_EMPLOYEE'),
      invitedByUid: user.uid,
      status: 'INVITED',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workspaces/${workspace.id}/invites/${inviteId}`);
  }

  // Propagate updated invitedEmails onto existing workspace docs so the new teammate can list everything cleanly
  const updatedWs: CloudWorkspaceDoc = { ...workspace, invitedEmails: nextInvited };
  await propagateAccessListsToWorkspaceDocs(updatedWs).catch((e) =>
    console.warn('[Firestore] Access list propagation warning:', e)
  );
  return updatedWs;
}

export async function removeWorkspaceMemberEmail(
  workspace: CloudWorkspaceDoc,
  rawEmail: string
): Promise<CloudWorkspaceDoc> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Must be signed in to manage teammates.');
  const cleanEmail = normalizeEmail(rawEmail);
  if (isBootstrappedAdminEmail(cleanEmail) || cleanEmail === normalizeEmail(workspace.ownerEmail)) {
    throw new Error('Primary admin email cannot be removed from workspace access.');
  }

  const nextInvited = workspace.invitedEmails.filter((e) => normalizeEmail(e) !== cleanEmail);
  const wsRef = doc(db, 'workspaces', workspace.id);
  const inviteId = emailToInviteId(cleanEmail);
  const inviteRef = doc(db, 'workspaces', workspace.id, 'invites', inviteId);

  try {
    await updateDoc(wsRef, {
      invitedEmails: nextInvited,
      updatedAt: serverTimestamp(),
    });
    const invSnap = await getDoc(inviteRef);
    if (invSnap.exists()) {
      await updateDoc(inviteRef, {
        status: 'REVOKED',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `workspaces/${workspace.id}`);
  }

  const updatedWs: CloudWorkspaceDoc = { ...workspace, invitedEmails: nextInvited };
  await propagateAccessListsToWorkspaceDocs(updatedWs).catch((e) =>
    console.warn('[Firestore] Access list propagation warning:', e)
  );
  return updatedWs;
}

async function propagateAccessListsToWorkspaceDocs(workspace: CloudWorkspaceDoc): Promise<void> {
  const pendingUpdates: Array<{ ref: ReturnType<typeof doc> }> = [];
  for (const colName of ERP_WORKSPACE_COLLECTIONS) {
    const snap = await getDocs(collection(db, 'workspaces', workspace.id, colName));
    snap.forEach((docSnap) => {
      pendingUpdates.push({ ref: docSnap.ref });
    });
  }
  const chunkSize = 350;
  for (let i = 0; i < pendingUpdates.length; i += chunkSize) {
    const chunk = pendingUpdates.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.update(item.ref, {
        memberUids: workspace.memberUids,
        invitedEmails: workspace.invitedEmails,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export async function upsertCloudEntity(
  workspace: CloudWorkspaceDoc,
  collectionName: Exclude<WorkspaceCollectionName, 'tombstones'>,
  rawItem: Record<string, any>
): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || !rawItem?.id) return;
  const ctx = buildContextFromWorkspace(workspace, user.uid);
  const docId = sanitizeDocId(rawItem.id, 'REC');
  const docRef = doc(db, 'workspaces', workspace.id, collectionName, docId);
  const path = `workspaces/${workspace.id}/${collectionName}/${docId}`;

  const payload =
    collectionName === 'vendors'
      ? buildVendorDocPayload(rawItem, ctx)
      : buildEntityDocPayload(rawItem, ctx);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      const updateFields =
        collectionName === 'vendors'
          ? {
              companyName: (payload as any).companyName,
              status: payload.status,
              isDeleted: payload.isDeleted,
              recordData: payload.recordData,
              memberUids: payload.memberUids,
              invitedEmails: payload.invitedEmails,
              updatedAt: serverTimestamp(),
            }
          : {
              title: (payload as any).title,
              status: payload.status,
              isDeleted: payload.isDeleted,
              recordData: payload.recordData,
              memberUids: payload.memberUids,
              invitedEmails: payload.invitedEmails,
              updatedAt: serverTimestamp(),
            };
      // Preserve immutable createdByUid/ownerUid/createdAt
      if (existingData?.ownerUid === workspace.ownerUid) {
        await updateDoc(docRef, updateFields);
        return;
      }
    }
    await setDoc(docRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function upsertCloudEntitiesBatch(
  workspace: CloudWorkspaceDoc,
  collectionName: Exclude<WorkspaceCollectionName, 'tombstones'>,
  items: Array<Record<string, any>>,
  existingIdsInCloud?: Set<string>
): Promise<number> {
  const user = firebaseAuth.currentUser;
  if (!user || !Array.isArray(items) || items.length === 0) return 0;
  const ctx = buildContextFromWorkspace(workspace, user.uid);
  const chunkSize = 350;
  let written = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const rawItem of chunk) {
      if (!rawItem || !rawItem.id) continue;
      const docId = sanitizeDocId(rawItem.id, 'REC');
      const docRef = doc(db, 'workspaces', workspace.id, collectionName, docId);
      const payload =
        collectionName === 'vendors'
          ? buildVendorDocPayload(rawItem, ctx)
          : buildEntityDocPayload(rawItem, ctx);

      if (existingIdsInCloud?.has(docId)) {
        const updateFields =
          collectionName === 'vendors'
            ? {
                companyName: (payload as any).companyName,
                status: payload.status,
                isDeleted: payload.isDeleted,
                recordData: payload.recordData,
                memberUids: payload.memberUids,
                invitedEmails: payload.invitedEmails,
                updatedAt: serverTimestamp(),
              }
            : {
                title: (payload as any).title,
                status: payload.status,
                isDeleted: payload.isDeleted,
                recordData: payload.recordData,
                memberUids: payload.memberUids,
                invitedEmails: payload.invitedEmails,
                updatedAt: serverTimestamp(),
              };
        batch.update(docRef, updateFields);
      } else {
        batch.set(docRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      written++;
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `workspaces/${workspace.id}/${collectionName}`);
    }
  }
  return written;
}

export async function deleteCloudEntity(
  workspace: CloudWorkspaceDoc,
  collectionName: Exclude<WorkspaceCollectionName, 'tombstones'>,
  entityId: string
): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || !entityId) return;
  const docId = sanitizeDocId(entityId, 'REC');
  const docRef = doc(db, 'workspaces', workspace.id, collectionName, docId);
  const path = `workspaces/${workspace.id}/${collectionName}/${docId}`;
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function upsertCloudTombstone(
  workspace: CloudWorkspaceDoc,
  tombstoneId: string,
  deletedIds: string[]
): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) return;
  const ctx = buildContextFromWorkspace(workspace, user.uid);
  const docId = sanitizeDocId(tombstoneId, 'tombstone');
  const docRef = doc(db, 'workspaces', workspace.id, 'tombstones', docId);
  const path = `workspaces/${workspace.id}/tombstones/${docId}`;
  const payload = buildTombstoneDocPayload(docId, deletedIds, ctx);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const existingList = Array.isArray(snap.data()?.deletedIds) ? snap.data().deletedIds : [];
      const merged = boundStringList([...existingList, ...payload.deletedIds], 500);
      await updateDoc(docRef, {
        deletedIds: merged,
        memberUids: payload.memberUids,
        invitedEmails: payload.invitedEmails,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface CloudSnapshotBundle {
  vendors: any[];
  archivedVendors: any[];
  customers: any[];
  companies: any[];
  purchaseExecutives: any[];
  products: any[];
  brands: any[];
  categories: any[];
  productTypes: any[];
  vendorProductMappings: any[];
  requirements: any[];
  vendorQuotes: any[];
  quotations: any[];
  customerPos: any[];
  vendorPos: any[];
  proformaInvoices: any[];
  payments: any[];
  dispatches: any[];
  deliveries: any[];
  settings: Record<string, any>;
  tombstones: Record<string, string[]>;
  existingIdsByCollection: Record<string, Set<string>>;
}

function buildCollectionQuery(
  workspace: CloudWorkspaceDoc,
  colName: WorkspaceCollectionName,
  userEmail: string
) {
  const colRef = collection(db, 'workspaces', workspace.id, colName);
  if (isBootstrappedAdminEmail(userEmail)) {
    return colRef;
  }
  return query(colRef, where('invitedEmails', 'array-contains', normalizeEmail(userEmail)));
}

export async function fetchFullCloudSnapshot(
  workspace: CloudWorkspaceDoc,
  userEmail: string
): Promise<CloudSnapshotBundle> {
  const bundle: CloudSnapshotBundle = {
    vendors: [],
    archivedVendors: [],
    customers: [],
    companies: [],
    purchaseExecutives: [],
    products: [],
    brands: [],
    categories: [],
    productTypes: [],
    vendorProductMappings: [],
    requirements: [],
    vendorQuotes: [],
    quotations: [],
    customerPos: [],
    vendorPos: [],
    proformaInvoices: [],
    payments: [],
    dispatches: [],
    deliveries: [],
    settings: {},
    tombstones: {},
    existingIdsByCollection: {},
  };

  for (const colName of ERP_WORKSPACE_COLLECTIONS) {
    const qRef = buildCollectionQuery(workspace, colName, userEmail);
    const path = `workspaces/${workspace.id}/${colName}`;
    try {
      const snap = await getDocs(qRef);
      const idSet = new Set<string>();
      snap.forEach((docSnap) => {
        idSet.add(docSnap.id);
        const data = docSnap.data();
        if (colName === 'tombstones') {
          bundle.tombstones[docSnap.id] = Array.isArray(data.deletedIds) ? data.deletedIds : [];
        } else if (colName === 'settings') {
          bundle.settings[docSnap.id] = extractEntityRecord(data);
        } else if (colName === 'vendors') {
          const rec = extractEntityRecord<any>(data);
          if (rec) {
            if (rec.isDeleted) {
              bundle.archivedVendors.push(rec);
            } else {
              bundle.vendors.push(rec);
            }
          }
        } else {
          const rec = extractEntityRecord<any>(data);
          if (rec && !rec.isDeleted) {
            (bundle as any)[colName].push(rec);
          }
        }
      });
      bundle.existingIdsByCollection[colName] = idSet;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }
  return bundle;
}

export async function seedMissingDataToCloud(
  workspace: CloudWorkspaceDoc,
  localState: {
    vendors: any[];
    archivedVendors: any[];
    customers: any[];
    companies: any[];
    purchaseExecutives: any[];
    products: any[];
    brands: any[];
    categories: any[];
    productTypes: any[];
    vendorProductMappings: any[];
    requirements: any[];
    vendorQuotes: any[];
    quotations: any[];
    customerPos: any[];
    vendorPos: any[];
    proformaInvoices: any[];
    payments: any[];
    dispatches: any[];
    deliveries: any[];
    settings?: Record<string, any>;
    tombstones?: Record<string, string[]>;
  },
  existingBundle: CloudSnapshotBundle,
  forceOverwriteAll = false
): Promise<number> {
  let totalUploaded = 0;

  // 1. Seed tombstones first so deleted records are respected across all 3 users
  const mergedTombstones: Record<string, string[]> = { ...(localState.tombstones || {}) };
  for (const [k, ids] of Object.entries(existingBundle.tombstones || {})) {
    mergedTombstones[k] = boundStringList([...(mergedTombstones[k] || []), ...ids], 500);
  }
  for (const [tKey, ids] of Object.entries(mergedTombstones)) {
    if (ids.length > 0 && (forceOverwriteAll || !existingBundle.existingIdsByCollection.tombstones?.has(tKey))) {
      await upsertCloudTombstone(workspace, tKey, ids);
      totalUploaded++;
    }
  }

  // Combine active vendors + archived vendors (marked isDeleted: true)
  const combinedVendors = [
    ...(localState.vendors || []).map((v) => ({ ...v, isDeleted: false })),
    ...(localState.archivedVendors || []).map((v) => ({ ...v, isDeleted: true })),
  ];

  const colPairs: Array<{
    name: Exclude<WorkspaceCollectionName, 'tombstones' | 'settings'>;
    items: any[];
    tombstoneKey?: string;
  }> = [
    { name: 'vendors', items: combinedVendors, tombstoneKey: 'vendors' },
    { name: 'customers', items: localState.customers || [], tombstoneKey: 'customers' },
    { name: 'companies', items: localState.companies || [], tombstoneKey: 'companies' },
    { name: 'purchaseExecutives', items: localState.purchaseExecutives || [], tombstoneKey: 'purchaseExecutives' },
    { name: 'brands', items: localState.brands || [], tombstoneKey: 'brands' },
    { name: 'categories', items: localState.categories || [], tombstoneKey: 'categories' },
    { name: 'productTypes', items: localState.productTypes || [] },
    { name: 'vendorProductMappings', items: localState.vendorProductMappings || [], tombstoneKey: 'vendorProductMappings' },
    { name: 'requirements', items: localState.requirements || [], tombstoneKey: 'requirements' },
    { name: 'vendorQuotes', items: localState.vendorQuotes || [], tombstoneKey: 'vendorQuotes' },
    { name: 'quotations', items: localState.quotations || [] },
    { name: 'customerPos', items: localState.customerPos || [] },
    { name: 'vendorPos', items: localState.vendorPos || [] },
    { name: 'proformaInvoices', items: localState.proformaInvoices || [] },
    { name: 'payments', items: localState.payments || [] },
    { name: 'dispatches', items: localState.dispatches || [] },
    { name: 'deliveries', items: localState.deliveries || [] },
    { name: 'products', items: localState.products || [], tombstoneKey: 'products' },
  ];

  for (const { name, items, tombstoneKey } of colPairs) {
    if (!Array.isArray(items) || items.length === 0) continue;
    const existingIds = existingBundle.existingIdsByCollection[name] || new Set<string>();
    const deletedSet = new Set(tombstoneKey ? mergedTombstones[tombstoneKey] || [] : []);

    const toUpload = items.filter((item) => {
      if (!item || !item.id || deletedSet.has(item.id)) return false;
      if (forceOverwriteAll) return true;
      return !existingIds.has(sanitizeDocId(item.id, 'REC'));
    });

    if (toUpload.length > 0) {
      totalUploaded += await upsertCloudEntitiesBatch(workspace, name, toUpload, existingIds);
    }
  }

  if (localState.settings) {
    const settingEntries = Object.entries(localState.settings)
      .filter(([, val]) => val && typeof val === 'object')
      .map(([id, val]) => ({ ...stripUndefinedDeep(val), id }));
    if (settingEntries.length > 0) {
      const existingSettingIds = existingBundle.existingIdsByCollection.settings || new Set<string>();
      const settingsToUpload = forceOverwriteAll
        ? settingEntries
        : settingEntries.filter((s) => !existingSettingIds.has(sanitizeDocId(s.id, 'SET')));
      if (settingsToUpload.length > 0) {
        totalUploaded += await upsertCloudEntitiesBatch(
          workspace,
          'settings',
          settingsToUpload,
          existingSettingIds
        );
      }
    }
  }

  return totalUploaded;
}

export interface RealtimeSyncCallbacks {
  onWorkspaceUpdated?: (workspace: CloudWorkspaceDoc) => void;
  onCollectionSnapshot: (
    collectionName: WorkspaceCollectionName,
    records: any[],
    tombstones?: Record<string, string[]>
  ) => void;
  onError?: (err: Error) => void;
}

export function subscribeToWorkspaceRealtime(
  workspace: CloudWorkspaceDoc,
  userEmail: string,
  callbacks: RealtimeSyncCallbacks
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  // Listen to workspace root so invitedEmails / memberUids updates reflect immediately
  const wsRef = doc(db, 'workspaces', workspace.id);
  unsubs.push(
    onSnapshot(
      wsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CloudWorkspaceDoc;
          callbacks.onWorkspaceUpdated?.({
            ...data,
            memberUids: boundStringList(data.memberUids, 20),
            invitedEmails: boundStringList(data.invitedEmails, 20, true),
          });
        }
      },
      (err) => {
        console.warn('[Firestore] Workspace listener error:', err);
      }
    )
  );

  for (const colName of ERP_WORKSPACE_COLLECTIONS) {
    const qRef = buildCollectionQuery(workspace, colName, userEmail);
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        if (colName === 'tombstones') {
          const tombMap: Record<string, string[]> = {};
          snap.forEach((d) => {
            const data = d.data();
            tombMap[d.id] = Array.isArray(data.deletedIds) ? data.deletedIds : [];
          });
          callbacks.onCollectionSnapshot(colName, [], tombMap);
          return;
        }
        const recs: any[] = [];
        snap.forEach((d) => {
          const extracted = extractEntityRecord<any>(d.data());
          if (extracted) recs.push(extracted);
        });
        callbacks.onCollectionSnapshot(colName, recs);
      },
      (err) => {
        console.warn(`[Firestore] Listener error on ${colName}:`, err);
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
}
