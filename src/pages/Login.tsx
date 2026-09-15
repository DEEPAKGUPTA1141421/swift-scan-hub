import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, ShieldCheck, Loader2 } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpDialog } from '@/components/OtpDialog';
import { toast } from 'sonner';

const PHONE_PATTERN = /^[6-9]\d{9}$/;

export default function Login() {
  const [phone, setPhone] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { requestOtp, verifyOtp } = useWarehouse();
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!PHONE_PATTERN.test(phone)) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }

    setIsSendingOtp(true);
    const result = await requestOtp(phone);
    setIsSendingOtp(false);

    if (result.success) {
      toast.success('OTP sent via SMS');
      setOtpOpen(true);
    } else {
      toast.error(result.error ?? 'Failed to send OTP');
    }
  };

  const handleVerify = async (otp: string) => {
    setIsVerifying(true);
    const result = await verifyOtp(phone, otp);
    setIsVerifying(false);

    if (result.success) {
      toast.success('Login successful');
      setOtpOpen(false);
      navigate('/dashboard');
    } else {
      toast.error(result.error ?? 'Invalid OTP');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-primary rounded-2xl mb-4">
            <Warehouse className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Warehouse Ops</h1>
          <p className="text-muted-foreground mt-2">Hub owner sign in</p>
        </div>

        <form onSubmit={handleSendOtp} className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="h-12 text-base"
                autoComplete="tel"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Only phone numbers provisioned by an admin for this hub can sign in.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSendingOtp || phone.length !== 10}
              className="w-full h-14 text-lg font-semibold"
            >
              {isSendingOtp ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5 mr-2" />
              )}
              {isSendingOtp ? 'Sending OTP…' : 'Send OTP'}
            </Button>
          </div>
        </form>
      </div>

      <OtpDialog
        open={otpOpen}
        title="Verify your phone"
        description={`Enter the OTP sent to ${phone}.`}
        isLoading={isVerifying}
        onSubmit={handleVerify}
        onCancel={() => setOtpOpen(false)}
      />
    </div>
  );
}
