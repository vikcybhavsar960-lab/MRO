import { supabase, getSupabaseConfigStatus } from '../lib/supabase';

export type RealtimeErpTable =
  | 'vendors'
  | 'vendor_product_mapping'
  | 'products'
  | 'brands'
  | 'categories'
  | 'requirements'
  | 'rfqs'
  | 'quotes'
  | 'customer_quotations'
  | 'customer_pos'
  | 'vendor_pos'
  | 'proforma_invoices'
  | 'payments'
  | 'dispatches'
  | 'deliveries'
  | 'notifications'
  | 'audit_logs';

const REALTIME_TABLES: RealtimeErpTable[] = [
  'vendors',
  'vendor_product_mapping',
  'products',
  'brands',
  'categories',
  'requirements',
  'rfqs',
  'quotes',
  'customer_quotations',
  'customer_pos',
  'vendor_pos',
  'proforma_invoices',
  'payments',
  'dispatches',
  'deliveries',
  'notifications',
  'audit_logs',
];

/**
 * Subscribes to live Supabase Realtime postgres_changes across core ERP tables so
 * updates made by any user propagate automatically without manual browser refresh.
 */
export function subscribeToErpSupabaseRealtime(
  onTableChange: (event: { table: RealtimeErpTable; eventType: string; recordId?: string }) => void
): () => void {
  if (!supabase || !getSupabaseConfigStatus().configured) {
    return () => {};
  }

  const client = supabase;
  const channel = client.channel('mro-erp-realtime-sync');
  for (const table of REALTIME_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: any) => {
        const recordId = payload?.new?.id || payload?.old?.id;
        onTableChange({
          table,
          eventType: payload?.eventType || 'UPDATE',
          recordId,
        });
      }
    );
  }

  channel.subscribe();

  return () => {
    try {
      void client.removeChannel(channel);
    } catch {}
  };
}
