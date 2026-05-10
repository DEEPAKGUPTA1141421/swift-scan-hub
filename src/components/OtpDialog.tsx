import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

interface OtpDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  isLoading?: boolean;
  onSubmit: (otp: string) => void;
  onCancel: () => void;
}

export function OtpDialog({
  open,
  title = 'Enter Verification OTP',
  description = 'An OTP has been sent via SMS. Enter it below to confirm.',
  isLoading = false,
  onSubmit,
  onCancel,
}: OtpDialogProps) {
  const [otp, setOtp] = useState('');

  const handleSubmit = () => {
    if (!otp.trim()) return;
    onSubmit(otp.trim());
    setOtp('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setOtp('');
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="otp-input">OTP Code</Label>
            <Input
              id="otp-input"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="Enter OTP"
              className="h-12 text-center text-2xl font-mono tracking-widest"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!otp.trim() || isLoading}
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
