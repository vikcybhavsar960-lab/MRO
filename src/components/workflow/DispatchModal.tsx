import React, { useState } from 'react';
import { X, Truck, Upload, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface DispatchModalProps {
  requirementId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  requirementId,
  isOpen,
  onClose,
}) => {
  const { vendorPOs, recordDispatch, requirements } = useApp();

  const req = requirements.find((r) => r.id === requirementId) || requirements[0];
  const vpo = vendorPOs.find((v) => v.requirementId === req?.id) || vendorPOs[0];

  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('INV/APX/26-1205');
  const [transporter, setTransporter] = useState('V-Trans Express Logistics Ltd');
  const [courierName, setCourierName] = useState('V-Trans Group');
  const [lrNumber, setLrNumber] = useState('VTR-MUM-891044');
  const [awbNumber, setAwbNumber] = useState('VTR891044');
  const [trackingNumber, setTrackingNumber] = useState('TRK-8891002');
  const [quantityDispatched, setQuantityDispatched] = useState('Full consignment in 2 heavy-duty wooden crates');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('2026-10-24');
  const [remarks, setRemarks] = useState('Handed over to carrier. Desiccant packs and shock indicators fitted.');

  if (!isOpen || !req) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    recordDispatch({
      vendorPoId: vpo ? vpo.id : 'VPO-001',
      requirementId: req.id,
      vendorId: vpo ? vpo.vendorId : 'VEND-001',
      vendorName: vpo ? vpo.vendorName : 'Apex Industrial',
      dispatchDate,
      vendorInvoiceNumber,
      transporter,
      courierName,
      lrNumber,
      awbNumber,
      trackingNumber,
      quantityDispatched,
      expectedDeliveryDate,
      remarks,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Vendor Logistics Dispatch (DSP)</h3>
            <p className="text-xs text-slate-400">Stage 9 of 10: Record Lorry Receipt (LR), AWB, and carrier docket</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-200">
            <span className="font-bold text-cyan-950 font-mono">Ref Order: {req.id}</span>
            <span className="ml-2 text-cyan-800 font-semibold">• Destination: {req.customerName}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dispatch Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Vendor Invoice No. <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transporter / Logistics Partner <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Courier / Carrier Name</label>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">LR Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-blue-700"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">AWB Number</label>
              <input
                type="text"
                value={awbNumber}
                onChange={(e) => setAwbNumber(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity & Packaging Details</label>
              <input
                type="text"
                value={quantityDispatched}
                onChange={(e) => setQuantityDispatched(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">Lorry Receipt (LR) / Transporter Bilty</span>
            </div>
            <span className="text-[11px] text-blue-600 font-mono">LR_Scanned_Copy.pdf</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
            >
              <Truck className="w-4 h-4" />
              <span>Confirm Dispatch & Update LR</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
