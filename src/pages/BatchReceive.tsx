import { useState, useCallback, useEffect } from 'react';
import {
  Users, ShieldCheck, Scan, CheckCircle, Loader2,
  Trash2, AlertCircle, Package, MapPin, Weight, ChevronRight,
  PartyPopper, RefreshCw,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { OtpDialog } from '@/components/OtpDialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { handoverApi, riderApi, type ScannedOrderItem, type ConfirmHandoverResult } from '@/services/api';
import { ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';

// ─── Session FSM ─────────────────────────────────────────────────────────────

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'pending-otp'; sessionId: string; riderName: string; riderPhoneMasked: string }
  | { kind: 'verifying-otp'; sessionId: string; riderName: string }
  | { kind: 'active'; sessionId: string; riderName: string; scannedOrders: ScannedOrderItem[] }
  | { kind: 'confirming'; sessionId: string; riderName: string; scannedOrders: ScannedOrderItem[] }
  | { kind: 'done'; riderName: string; result: ConfirmHandoverResult };

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Select Rider', 'Verify OTP', 'Scan Orders', 'Confirm'];

function phaseToStep(phase: Phase): number {
  switch (phase.kind) {
    case 'idle':
    case 'starting':        return 0;
    case 'pending-otp':
    case 'verifying-otp':   return 1;
    case 'active':          return 2;
    case 'confirming':      return 3;
    case 'done':            return 4;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchReceive() {
  const { currentWarehouse, refreshData } = useWarehouse();
  const warehouseId = currentWarehouse?.id ?? '';

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [otpLoading, setOtpLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  // Rider selector
  const [riders, setRiders] = useState<Array<{ id: string; name: string }>>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState('');

  // Load active riders from route assignments
  const loadRiders = useCallback(async () => {
    if (!warehouseId) return;
    setRidersLoading(true);
    try {
      const res = await riderApi.getRouteAssignments(warehouseId);
      const bundles = res.data ?? [];
      setRiders(bundles.map(b => ({ id: b.riderId, name: b.riderName })));
    } catch {
      // non-critical — admin can still type a rider ID
    } finally {
      setRidersLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { loadRiders(); }, [loadRiders]);

  // ── Step 1: start session ──────────────────────────────────────────────────

  const handleStartSession = async () => {
    if (!warehouseId || !selectedRiderId) {
      toast.error('Select a rider first');
      return;
    }
    setPhase({ kind: 'starting' });
    try {
      const res = await handoverApi.startSession(warehouseId, selectedRiderId);
      const d = res.data;
      setPhase({
        kind: 'pending-otp',
        sessionId: d.sessionId,
        riderName: d.riderName,
        riderPhoneMasked: d.riderPhoneMasked,
      });
      toast.success(`OTP sent to ${d.riderName} (${d.riderPhoneMasked})`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to start session');
      setPhase({ kind: 'idle' });
    }
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────────

  const handleVerifyOtp = async (otp: string) => {
    if (phase.kind !== 'pending-otp') return;
    setOtpLoading(true);
    try {
      await handoverApi.verifyOtp(warehouseId, phase.sessionId, otp);
      setPhase({
        kind: 'active',
        sessionId: phase.sessionId,
        riderName: phase.riderName,
        scannedOrders: [],
      });
      toast.success(`${phase.riderName} verified — start scanning orders`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Step 3: scan order ────────────────────────────────────────────────────

  const handleScan = async (orderNo: string) => {
    if (phase.kind !== 'active') return;
    setScanLoading(true);
    try {
      const res = await handoverApi.scanOrder(warehouseId, phase.sessionId, orderNo);
      const d = res.data;
      setPhase({ ...phase, scannedOrders: d.scannedOrders });
      if (d.accepted) {
        toast.success(`${orderNo} scanned ✓`);
      } else {
        toast.warning(`${orderNo} rejected — ${d.reason}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Scan failed');
    } finally {
      setScanLoading(false);
    }
  };

  const handleRemove = async (orderNo: string) => {
    if (phase.kind !== 'active') return;
    try {
      const res = await handoverApi.removeOrder(warehouseId, phase.sessionId, orderNo);
      setPhase({ ...phase, scannedOrders: res.data.scannedOrders });
      toast.info(`${orderNo} removed from session`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Remove failed');
    }
  };

  // ── Step 4: confirm ───────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (phase.kind !== 'active') return;
    setPhase({ kind: 'confirming', sessionId: phase.sessionId, riderName: phase.riderName, scannedOrders: phase.scannedOrders });
    try {
      const res = await handoverApi.confirm(warehouseId, phase.sessionId);
      setPhase({ kind: 'done', riderName: phase.riderName, result: res.data });
      refreshData();
      toast.success(`${res.data.accepted} orders received at warehouse`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Confirm failed');
      // restore active state so admin can retry
      setPhase({ kind: 'active', sessionId: phase.kind === 'confirming' ? phase.sessionId : '', riderName: phase.kind === 'confirming' ? phase.riderName : '', scannedOrders: phase.kind === 'confirming' ? phase.scannedOrders : [] });
    }
  };

  const reset = () => {
    setPhase({ kind: 'idle' });
    setSelectedRiderId('');
  };

  const currentStep = phaseToStep(phase);
  const scannedOrders = phase.kind === 'active' || phase.kind === 'confirming' ? phase.scannedOrders : [];

  return (
    <Layout>
      <PageHeader
        title="Batch Handover"
        subtitle="Verify rider identity once with OTP, then scan each package — no per-order OTP needed."
        backTo="/receive-orders"
      />

      <div className="max-w-2xl mx-auto space-y-8">

        {/* ── Step indicator ── */}
        <StepIndicator steps={STEPS} current={currentStep} />

        {/* ── Step 1: Select rider ── */}
        {(phase.kind === 'idle' || phase.kind === 'starting') && (
          <div className="bg-card border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Select Rider</p>
                <p className="text-sm text-muted-foreground">
                  Choose the rider who arrived at the warehouse with packages.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Select
                  value={selectedRiderId}
                  onValueChange={setSelectedRiderId}
                  disabled={phase.kind === 'starting' || ridersLoading}
                >
                  <SelectTrigger className="flex-1 h-12">
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
                <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={loadRiders} disabled={ridersLoading}>
                  <RefreshCw className={`w-4 h-4 ${ridersLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <Button
                className="w-full h-12"
                onClick={handleStartSession}
                disabled={!selectedRiderId || phase.kind === 'starting'}
              >
                {phase.kind === 'starting' ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending OTP…</>
                ) : (
                  <><ShieldCheck className="w-5 h-5 mr-2" />Start Handover Session</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: OTP pending ── */}
        {phase.kind === 'pending-otp' && (
          <div className="bg-card border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Verify Rider Identity</p>
                <p className="text-sm text-muted-foreground">
                  OTP sent to <span className="font-mono">{phase.riderPhoneMasked}</span>. Ask{' '}
                  <span className="font-medium">{phase.riderName}</span> to read it out.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>This is the only OTP needed — once verified, scan packages individually.</span>
            </div>

            <Button className="w-full h-12" onClick={() => {/* OtpDialog handles this */}}>
              <ShieldCheck className="w-5 h-5 mr-2" />
              Enter OTP
            </Button>
          </div>
        )}

        {/* ── Step 3: Scanning ── */}
        {phase.kind === 'active' && (
          <div className="space-y-5">
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-success/10 rounded-lg">
                    <Scan className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold">Scan Packages</p>
                    <p className="text-sm text-muted-foreground">
                      Rider: <span className="font-medium">{phase.riderName}</span> · Session active
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{scannedOrders.length}</p>
                  <p className="text-xs text-muted-foreground">scanned</p>
                </div>
              </div>

              <ScanInput
                onScan={handleScan}
                placeholder="Scan order barcode (e.g. OR123456)"
                disabled={scanLoading}
              />
            </div>

            {/* Scanned list */}
            {scannedOrders.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <p className="text-sm font-medium">Scanned Orders ({scannedOrders.length})</p>
                  <p className="text-xs text-muted-foreground">
                    {scannedOrders.reduce((s, o) => s + o.weightKg, 0).toFixed(1)} kg total
                  </p>
                </div>
                <div className="divide-y">
                  {scannedOrders.map(item => (
                    <ScannedRow key={item.orderNo} item={item} onRemove={handleRemove} />
                  ))}
                </div>
              </div>
            )}

            {scannedOrders.length === 0 && (
              <div className="text-center text-muted-foreground p-10 border border-dashed rounded-xl">
                <Scan className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No orders scanned yet — scan the first package above.</p>
              </div>
            )}

            {/* Confirm button */}
            <Button
              className="w-full h-14 text-base"
              disabled={scannedOrders.length === 0}
              onClick={handleConfirm}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirm Handover ({scannedOrders.length} order{scannedOrders.length !== 1 ? 's' : ''})
              <ChevronRight className="w-5 h-5 ml-auto" />
            </Button>
          </div>
        )}

        {/* ── Step 4: Confirming ── */}
        {phase.kind === 'confirming' && (
          <div className="bg-card border rounded-xl p-10 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="font-semibold text-lg">Committing {phase.scannedOrders.length} orders…</p>
              <p className="text-sm text-muted-foreground">Setting all scanned orders to WAREHOUSE status.</p>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {phase.kind === 'done' && (
          <div className="space-y-5">
            <div className="bg-card border rounded-xl p-8 text-center space-y-3">
              <div className="p-4 bg-success/10 rounded-full w-fit mx-auto">
                <PartyPopper className="w-10 h-10 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold">Handover complete</p>
                <p className="text-sm text-muted-foreground">
                  {phase.riderName}'s batch received at {currentWarehouse?.name}
                </p>
              </div>

              {/* Result summary */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-4 bg-success/10 rounded-xl">
                  <p className="text-3xl font-bold text-success">{phase.result.accepted}</p>
                  <p className="text-sm text-success/80">Accepted</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <p className="text-3xl font-bold text-muted-foreground">{phase.result.skipped}</p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
              </div>
            </div>

            {/* Accepted list */}
            {phase.result.acceptedOrderNos.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-success/5">
                  <p className="text-sm font-medium text-success">Accepted Orders</p>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {phase.result.acceptedOrderNos.map(no => (
                    <span key={no} className="font-mono text-xs px-2 py-1 bg-success/10 text-success rounded">
                      {no}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped with reasons */}
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
              Start New Handover Session
            </Button>
          </div>
        )}
      </div>

      {/* OTP dialog — shown when pending-otp */}
      <OtpDialog
        open={phase.kind === 'pending-otp'}
        title="Verify Rider OTP"
        description={
          phase.kind === 'pending-otp'
            ? `Ask ${phase.riderName} (${phase.riderPhoneMasked}) to read their OTP. Enter it below to authenticate the rider.`
            : ''
        }
        isLoading={otpLoading}
        onSubmit={handleVerifyOtp}
        onCancel={() =>
          phase.kind === 'pending-otp' && setPhase({ kind: 'idle' })
        }
      />
    </Layout>
  );
}

// ─── Scanned row ──────────────────────────────────────────────────────────────

function ScannedRow({
  item,
  onRemove,
}: {
  item: ScannedOrderItem;
  onRemove: (orderNo: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center shrink-0">
        <CheckCircle className="w-4 h-4 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-semibold">{item.orderNo}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />{item.destCity}
          </span>
          <span className="flex items-center gap-1">
            <Weight className="w-3 h-3" />{item.weightKg.toFixed(1)} kg
          </span>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.orderNo)}
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
                done   ? 'bg-success text-white' :
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
              <div className={`flex-1 h-0.5 mb-4 rounded transition-colors ${done ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
