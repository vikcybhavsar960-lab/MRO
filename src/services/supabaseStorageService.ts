import { supabase, getSupabaseConfigStatus } from '../lib/supabase';
import { fetchApi } from '../utils/apiClient';

export type ErpBucketName =
  | 'vendor-catalogues'
  | 'vendor-documents'
  | 'product-images'
  | 'product-datasheets'
  | 'rfq-documents'
  | 'quotation-documents'
  | 'purchase-orders'
  | 'invoices'
  | 'other-erp-documents';

export interface SupabaseUploadResult {
  success: boolean;
  bucket: ErpBucketName;
  storagePath: string;
  signedUrl?: string | null;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  via: 'supabase-storage-direct' | 'server-storage-proxy' | 'local-staging';
}

/**
 * Uploads files directly to Supabase Storage when authenticated with a valid Supabase session,
 * or streams safely through the backend storage proxy endpoint for large files (up to 250 MB).
 */
export async function uploadDocumentToErpStorage(params: {
  file: File;
  bucket: ErpBucketName;
  folderPrefix?: string;
  associatedEntityId?: string;
  onProgress?: (percent: number) => void;
}): Promise<SupabaseUploadResult> {
  const { file, bucket, folderPrefix = 'uploads', associatedEntityId = '' } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folderPrefix}/${associatedEntityId ? `${associatedEntityId}/` : ''}${Date.now()}_${safeName}`;

  params.onProgress?.(10);

  // Direct client upload to Supabase Storage for files <= 50 MB when Supabase Auth session is active
  if (supabase && getSupabaseConfigStatus().configured && file.size <= 50 * 1024 * 1024) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      const { data, error } = await supabase.storage.from(bucket).upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });
      if (!error && data) {
        params.onProgress?.(90);
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(data.path, 3600);
        params.onProgress?.(100);
        return {
          success: true,
          bucket,
          storagePath: data.path,
          signedUrl: signed?.signedUrl || null,
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          via: 'supabase-storage-direct',
        };
      }
    }
  }

  // Chunked stream upload through backend proxy (handles up to 250 MB & syncs to Supabase Storage server-side)
  const cfgRes = await fetchApi('/api/config');
  const cfgJson = await cfgRes.json().catch(() => ({}));
  const chunkSize = Number(cfgJson?.vendorCatalogueConfig?.uploadChunkSizeBytes || 4 * 1024 * 1024);
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  const initRes = await fetchApi('/api/storage/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket,
      storagePath,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      totalChunks,
      associatedEntityId,
    }),
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initData?.uploadId) {
    throw new Error(initData?.error || 'Failed to initialize storage upload session.');
  }

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunkBuf = await file.slice(start, end).arrayBuffer();
    const chunkRes = await fetchApi('/api/storage/upload/chunk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-upload-id': initData.uploadId,
        'x-chunk-index': String(i),
        'x-total-chunks': String(totalChunks),
      },
      body: chunkBuf,
      timeoutMs: 60000,
    });
    if (!chunkRes.ok) {
      const errData = await chunkRes.json().catch(() => ({}));
      throw new Error(errData?.error || `Chunk ${i + 1}/${totalChunks} upload failed.`);
    }
    params.onProgress?.(Math.min(90, Math.round(((i + 1) / totalChunks) * 85) + 10));
  }

  const completeRes = await fetchApi('/api/storage/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: initData.uploadId }),
    timeoutMs: 120000,
  });
  const completeData = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok || !completeData?.success) {
    throw new Error(completeData?.error || 'Failed to finalize file storage upload.');
  }

  params.onProgress?.(100);
  return {
    success: true,
    bucket,
    storagePath: completeData.storagePath || storagePath,
    signedUrl: completeData.signedUrl || null,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    via: completeData.supabaseSynced ? 'server-storage-proxy' : 'local-staging',
  };
}
