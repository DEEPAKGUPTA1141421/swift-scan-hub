import { useState, useCallback, useEffect } from 'react';
import {
  ShieldCheck, Scan, CheckCircle, Loader2, Trash2,
  AlertCircle, ChevronRight, PartyPopper, RefreshCw,
  ArrowRight, Package, MapPin, Building2,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { OtpDialog } from '@/components/OtpDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  shipmentTransferApi,
  riderApi,
  type ShipmentTransferSessionType,
  type ScannedShipmentItem,
  type ConfirmTransferResult,
} from '@/services/api';
import { ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';

// ─── Session type metadata ─────────────────────────────────────────────────────

interface SessionTypeMeta {
  type: ShipmentTransferSessionType;
  label: string;
  description: string;
  from: string;
  to: string;
  icon: React.ReactNode;
  scanLabel: string;
}

const SESSION_TYPES: SessionTypeMeta[] = [
  {
    type: 'DISPATCH_OUT',
    label: 'Dispatch Out',
    description: 'Send shipments out of this warehouse with a pickup rider.',
    from: 'Warehouse',
    to: 'Outgoing Rider',
    icon: <Building2 className="w-5 h-5" />,
    scanLabel: 'Scan shipments being dispatched',
  },
  {
    type: 'RECEIVE_IN',
    label: 'Receive In',
    description: 'Receive shipments delivered by an incoming rider at this warehouse.',
    from: 'Incoming Rider',
    to: 'Warehouse',
    icon: <Package className="w-5 h-5" />,
    scanLabel: 'Scan shipments being received at warehouse',
  },
];

// ─── Phase FSM ─────────────────────────────────────────────────────────────────

type Phase =
  | { kind: 'select-type' }
  | { kind: 'setup'; meta: SessionTypeMeta }
  | { kind: 'starting'; meta: SessionTypeMeta }
  | { kind: 'pending-otp'; meta: SessionTypeMeta; sessionId: string; partyName: string; partyPhoneMasked: string }
  | { kind: 'verifying-otp'; meta: SessionTypeMeta; sessionId: string; partyName: string }
  | { kind: 'active'; meta: SessionTypeMeta; sessionId: string; partyName: string; scannedShipments: ScannedShipmentItem[] }
  | { kind: 'confirming'; meta: SessionTypeMeta; sessionId: string; partyName: string; scannedShipments: ScannedShipmentItem[] }
  | { kind: 'done'; meta: SessionTypeMeta; partyName: string; result: ConfirmTransferResult };

const STEPS = ['Select Type', 'Setup & OTP', 'Scan Shipments', 'Confirm'];

function phaseToStep(phase: Phase): number {
  switch (phase.kind) {
    case 'select-type': return 0;
    case 'setup':
    case 'starting':
    case 'pending-otp':
    case 'verifying-otp': return 1;
    case 'active': return 2;
    case 'confirming': return 3;
    case 'done': return 4;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchShipment() {
  const { currentWarehouse, refreshData } = useWarehouse();
  const warehouseId = currentWarehouse?.id ?? '';

  const [phase, setPhase] = useState<Phase>({ kind: 'select-type' });
  const [otpLoading, setOtpLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  // DISPATCH_OUT: admin provides a shipment number — rider is auto-resolved from it
  const [referenceShipmentNo, setReferenceShipmentNo] = useState('');

  // RECEIVE_IN: rider selector
  const [riders, setRiders] = useState<Array<{ id: string; name: string }>>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState('');

  const loadRiders = useCallback(async () => {
    if (!warehouseId) return;
    setRidersLoading(true);
    try {
      const res = await riderApi.getRouteAssignments(warehouseId);
      setRiders((res.data ?? []).map(b => ({ id: b.riderId, name: b.riderName })));
    } catch {
      // non-critical
    } finally {
      setRidersLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    // Only pre-load riders for RECEIVE_IN
    if (phase.kind === 'setup' && phase.meta.type === 'RECEIVE_IN') {
      loadRiders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  // ── Step 1: select type ────────────────────────────────────────────────────

  const selectType = (meta: SessionTypeMeta) => {
    setReferenceShipmentNo('');
    setSelectedRiderId('');
    setPhase({ kind: 'setup', meta });
  };

  // ── Step 2: start session ──────────────────────────────────────────────────

  const handleStartSession = async () => {
    if (phase.kind !== 'setup') return;
    if (!warehouseId) { toast.error('Select a warehouse first'); return; }

    const meta = phase.meta;

    if (meta.type === 'DISPATCH_OUT' && !referenceShipmentNo.trim()) {
      toast.error('Enter a shipment number to identify the assigned rider'); return;
    }
    if (meta.type === 'RECEIVE_IN' && !selectedRiderId) {
      toast.error('Select the incoming rider'); return;
    }

    setPhase({ kind: 'starting', meta });
    try {
      const res = await shipmentTransferApi.startSession(warehouseId, {
        sessionType: meta.type,
        referenceShipmentNo: meta.type === 'DISPATCH_OUT' ? referenceShipmentNo.trim().toUpperCase() : undefined,
        riderId: meta.type === 'RECEIVE_IN' ? selectedRiderId : undefined,
      });
      const d = res.data;
      setPhase({
        kind: 'pending-otp',
        meta,
        sessionId: d.sessionId,
        partyName: d.partyName,
        partyPhoneMasked: d.partyPhoneMasked,
      });
      toast.success(`OTP sent to ${d.partyName} (${d.partyPhoneMasked})`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to start session');
      setPhase({ kind: 'setup', meta });
    }
  };

  // ── Step 2b: verify OTP ────────────────────────────────────────────────────

  const handleVerifyOtp = async (otp: string) => {
    if (phase.kind !== 'pending-otp') return;
    setOtpLoading(true);
    try {
      await shipmentTransferApi.verifyOtp(warehouseId, phase.sessionId, otp);
      setPhase({
        kind: 'active',
        meta: phase.meta,
        sessionId: phase.sessionId,
        partyName: phase.partyName,
        scannedShipments: [],
      });
      toast.success(`${phase.partyName} verified — start scanning shipments`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Step 3: scan shipment ──────────────────────────────────────────────────

  const handleScan = async (shipmentNo: string) => {
    if (phase.kind !== 'active') return;
    setScanLoading(true);
    try {
      const res = await shipmentTransferApi.scanShipment(warehouseId, phase.sessionId, shipmentNo.toUpperCase());
      const d = res.data;
      setPhase({ ...phase, scannedShipments: d.scannedShipments });
      if (d.accepted) {
        toast.success(`${shipmentNo.toUpperCase()} added ✓`);
      } else {
        toast.warning(`${shipmentNo.toUpperCase()} rejected — ${d.reason}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Scan failed');
    } finally {
      setScanLoading(false);
    }
  };

  const handleRemove = async (shipmentNo: string) => {
    if (phase.kind !== 'active') return;
    try {
      const res = await shipmentTransferApi.removeShipment(warehouseId, phase.sessionId, shipmentNo);
      setPhase({ ...phase, scannedShipments: res.data.scannedShipments });
      toast.info(`${shipmentNo} removed`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Remove failed');
    }
  };

  // ── Step 4: confirm ────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (phase.kind !== 'active') return;
    setPhase({
      kind: 'confirming',
      meta: phase.meta,
      sessionId: phase.sessionId,
      partyName: phase.partyName,
      scannedShipments: phase.scannedShipments,
    });
    try {
      const res = await shipmentTransferApi.confirm(warehouseId, phase.sessionId);
      setPhase({ kind: 'done', meta: phase.meta, partyName: phase.partyName, result: res.data });
      refreshData?.();
      toast.success(`${res.data.processed} shipment(s) advanced`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Confirm failed');
      setPhase({
        kind: 'active',
        meta: phase.meta,
        sessionId: phase.sessionId,
        partyName: phase.partyName,
        scannedShipments: phase.scannedShipments,
      });
    }
  };

  const reset = () => setPhase({ kind: 'select-type' });

  const currentStep = phaseToStep(phase);
  const scannedShipments = (phase.kind === 'active' || phase.kind === 'confirming') ? phase.scannedShipments : [];

  return (
    <Layout>
      <PageHeader
        title="Dispatch Shipments"
        subtitle="Session-based handoff — one OTP per transfer, scan each shipment number."
        backTo="/shipments"
      />

      <div className="max-w-2xl mx-auto space-y-8">

        {/* ── Step indicator ── */}
        <StepIndicator steps={STEPS} current={currentStep} />

        {/* ── Step 1: Select session type ── */}
        {phase.kind === 'select-type' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">
              Choose the type of handoff you're performing:
            </p>
            {SESSION_TYPES.map(meta => (
              <button
                key={meta.type}
                onClick={() => selectType(meta)}
                className="w-full text-left border rounded-xl p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{meta.label}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {meta.from} <ArrowRight className="w-3 h-3 mx-0.5" /> {meta.to}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 2: Setup (party selection + start) ── */}
        {(phase.kind === 'setup' || phase.kind === 'starting') && (
          <div className="bg-card border rounded-xl p-6 space-y-5">
            {/* Type banner */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg text-primary">
                {phase.meta.icon}
              </div>
              <div>
                <p className="font-semibold">{phase.meta.label}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">{phase.meta.from}</span>
                  <ArrowRight className="inline w-3 h-3 mx-1" />
                  <span className="font-medium">{phase.meta.to}</span>
                </p>
              </div>
              <Button
                variant="ghost" size="sm" className="ml-auto"
                onClick={() => setPhase({ kind: 'select-type' })}
                disabled={phase.kind === 'starting'}
              >
                Change
              </Button>
            </div>

            {/* Setup form — varies by session type */}
            {phase.meta.type === 'DISPATCH_OUT' ? (
              <div className="space-y-1.5">
                <Label htmlFor="ref-shipment">Any shipment number from this batch</Label>
                <Input
                  id="ref-shipment"
                  value={referenceShipmentNo}
                  onChange={e => setReferenceShipmentNo(e.target.value.toUpperCase())}
                  placeholder="e.g. SH-204851"
                  disabled={phase.kind === 'starting'}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The rider assigned to this shipment is auto-detected and OTP is sent to their phone.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Incoming Rider</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedRiderId}
                    onValueChange={setSelectedRiderId}
                    disabled={phase.kind === 'starting' || ridersLoading}
                  >
                    <SelectTrigger className="flex-1 h-11">
                      <SelectValue placeholder={ridersLoading ? 'Loading riders…' : 'Select a rider'} />
                    </SelectTrigger>
                    <SelectContent>
                      {riders.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                      {riders.length === 0 && !ridersLoading && (
                        <SelectItem value="_none" disabled>No active riders found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline" size="icon" className="h-11 w-11 shrink-0"
                    onClick={loadRiders} disabled={ridersLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${ridersLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  OTP will be SMS'd to the rider's phone.
                </p>
              </div>
            )}

            <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>One OTP confirms the entire handoff — no per-shipment OTP needed after this.</span>
            </div>

            <Button
              className="w-full h-12"
              onClick={handleStartSession}
              disabled={
                phase.kind === 'starting' ||
                (phase.meta.type === 'DISPATCH_OUT' && !referenceShipmentNo.trim()) ||
                (phase.meta.type === 'RECEIVE_IN' && !selectedRiderId)
              }
            >
              {phase.kind === 'starting' ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending OTP…</>
              ) : (
                <><ShieldCheck className="w-5 h-5 mr-2" />Start Session &amp; Send OTP</>
              )}
            </Button>
          </div>
        )}

        {/* ── Step 3: Scanning ── */}
        {phase.kind === 'active' && (
          <div className="space-y-5">
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <Scan className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{phase.meta.scanLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{phase.partyName}</span> verified · Session active
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{scannedShipments.length}</p>
                  <p className="text-xs text-muted-foreground">scanned</p>
                </div>
              </div>

              <ScanInput
                onScan={handleScan}
                placeholder="Scan shipment number (e.g. SH-204851)"
                disabled={scanLoading}
              />
            </div>

            {/* Scanned list */}
            {scannedShipments.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <p className="text-sm font-medium">Scanned Shipments ({scannedShipments.length})</p>
                  <p className="text-xs text-muted-foreground">
                    {scannedShipments.reduce((s, sh) => s + sh.parcelCount, 0)} parcel(s) total
                  </p>
                </div>
                <div className="divide-y">
                  {scannedShipments.map(item => (
                    <ScannedRow key={item.shipmentNo} item={item} onRemove={handleRemove} />
                  ))}
                </div>
              </div>
            )}

            {scannedShipments.length === 0 && (
              <div className="text-center text-muted-foreground p-10 border border-dashed rounded-xl">
                <Scan className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No shipments scanned yet — scan the first one above.</p>
              </div>
            )}

            <Button
              className="w-full h-14 text-base"
              disabled={scannedShipments.length === 0}
              onClick={handleConfirm}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirm Handover ({scannedShipments.length} shipment{scannedShipments.length !== 1 ? 's' : ''})
              <ChevronRight className="w-5 h-5 ml-auto" />
            </Button>
          </div>
        )}

        {/* ── Confirming ── */}
        {phase.kind === 'confirming' && (
          <div className="bg-card border rounded-xl p-10 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="font-semibold text-lg">Committing {phase.scannedShipments.length} shipment(s)…</p>
              <p className="text-sm text-muted-foreground">Updating shipment statuses.</p>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {phase.kind === 'done' && (
          <div className="space-y-5">
            <div className="bg-card border rounded-xl p-8 text-center space-y-3">
              <div className="p-4 bg-green-50 rounded-full w-fit mx-auto">
                <PartyPopper className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{phase.meta.label} complete</p>
                <p className="text-sm text-muted-foreground">
                  {phase.partyName} · {phase.result.processed} shipment(s) advanced
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-3xl font-bold text-green-700">{phase.result.processed}</p>
                  <p className="text-sm text-green-700/80">Processed</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-3xl font-bold text-muted-foreground">{phase.result.skipped}</p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
              </div>
            </div>

            {phase.result.processedShipmentNos.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-green-50/50">
                  <p className="text-sm font-medium text-green-700">Processed Shipments</p>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {phase.result.processedShipmentNos.map(no => (
                    <span key={no} className="font-mono text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded">
                      {no}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {phase.result.errors.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-destructive/5">
                  <p className="text-sm font-medium text-destructive">Skipped / Errors</p>
                </div>
                <div className="divide-y">
                  {phase.result.errors.map((e, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                      <span className="font-mono text-xs">{e}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full h-12" onClick={reset}>
              Start New Session
            </Button>
          </div>
        )}
      </div>

      {/* OTP dialog */}
      <OtpDialog
        open={phase.kind === 'pending-otp'}
        title={`Verify ${phase.kind === 'pending-otp' ? phase.meta.label : ''} OTP`}
        description={
          phase.kind === 'pending-otp'
            ? `Ask ${phase.partyName} (${phase.partyPhoneMasked}) to read their OTP. Enter it below to confirm their identity.`
            : ''
        }
        isLoading={otpLoading}
        onSubmit={handleVerifyOtp}
        onCancel={() => phase.kind === 'pending-otp' && setPhase({ kind: 'setup', meta: phase.meta })}
      />
    </Layout>
  );
}

// ─── Scanned shipment row ──────────────────────────────────────────────────────

function ScannedRow({
  item,
  onRemove,
}: {
  item: ScannedShipmentItem;
  onRemove: (shipmentNo: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="w-7 h-7 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
        <CheckCircle className="w-4 h-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-semibold">{item.shipmentNo}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {item.originCity} → {item.destinationCity}
          </span>
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            {item.parcelCount} parcel{item.parcelCount !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground/60 font-mono">{item.currentStatus}</span>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.shipmentNo)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Remove from session"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                done   ? 'bg-green-600 text-white' :
                active ? 'bg-primary text-primary-foreground' :
                         'bg-muted text-muted-foreground'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] text-center leading-tight hidden sm:block ${
                active ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 rounded transition-colors ${done ? 'bg-green-600' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
