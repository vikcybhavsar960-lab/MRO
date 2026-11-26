import React, { useState } from 'react';
import { X, CheckCircle, Upload, Truck, ShieldCheck, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface DeliveryModalProps {
  requirementId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryModal: React.FC<DeliveryModalProps> = ({
  requirementId,
  isOpen,
  onClose,
}) => {
  const { requirements, dispatches, updateDeliveryTracking, closeOrder } = useApp();

  const req = requirements.find((r) => r.id === requirementId) || requirements[0];
  const dsp = dispatches.find((d) => d.requirementId === req?.id) || dispatches[0];

  const [status, setStatus] = useState<'DISPATCHED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PARTIALLY_DELIVERED'>('DELIVERED');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedBy, setReceivedBy] = useState('Central Stores Incharge');
  const [customerAcknowledgement, setCustomerAcknowledgement] = useState('All items inspected, verified against PO, and accepted.');
  const [remarks, setRemarks] = useState('Order ready to be officially closed.');

  if (!isOpen || !req) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateDeliveryTracking({
      dispatchId: dsp ? dsp.id : 'DSP-001',
      requirementId: req.id,
      deliveryDate,
      receivedBy,
      customerAcknowledgement,
      status,
      remarks,
    });

    if (status === 'DELIVERED') {
      closeOrder(req.id, customerAcknowledgement);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Delivery Tracking & Proof of Delivery (POD)</h3>
            <p className="text-xs text-slate-400">Stage 10 of 10: Final milestone, customer acknowledgement, and closure</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="font-bold text-emerald-950 font-mono">{req.id}</span>
              <span className="text-emerald-800 font-bold">{req.customerName}</span>
            </div>
            {dsp && (
              <div className="mt-1 text-slate-600">
                Transporter: <strong>{dsp.transporter}</strong> • LR: <strong>{dsp.lrNumber}</strong>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Update Tracking Status</label>
            <select
              value={status}
              onChange={(e: any) => setStatus(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
            >
              <option value="IN_TRANSIT">IN TRANSIT (On the Road)</option>
              <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY (Local Hub)</option>
              <option value="DELIVERED">DELIVERED (Received at Destination Site)</option>
              <option value="PARTIALLY_DELIVERED">PARTIALLY DELIVERED</option>
            </select>
          </div>

          {status === 'DELIVERED' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Actual Delivery Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Received By (Storekeeper / Eng.) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Acknowledgement & Stamp</label>
                <textarea
                  rows={2}
                  value={customerAcknowledgement}
                  onChange={(e) => setCustomerAcknowledgement(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-700">Proof of Delivery (POD) Signed Image</span>
                </div>
                <span className="text-[11px] text-blue-600 font-mono">Stamped_POD_Receipt.jpg</span>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{status === 'DELIVERED' ? 'Mark Delivered & Close Order' : 'Update Tracking Status'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
