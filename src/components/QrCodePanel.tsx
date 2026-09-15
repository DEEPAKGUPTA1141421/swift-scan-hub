import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QrCodePanelProps {
  /** Text/URL encoded into the QR — scanning it opens this. */
  value: string;
  /** Human-readable code shown under the QR (e.g. parcel/shipment id). */
  label: string;
  title: string;
}

export function QrCodePanel({ value, label, title }: QrCodePanelProps) {
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=420,height=520');
    if (!win) return;

    const svg = document.getElementById(`qr-svg-${label}`)?.outerHTML ?? '';
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
            .code { margin-top: 12px; font-family: monospace; font-size: 14px; letter-spacing: 0.5px; word-break: break-all; }
            .title { font-weight: 700; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="title">${title}</div>
          ${svg}
          <div class="code">${label}</div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-xl">
      <QRCodeSVG id={`qr-svg-${label}`} value={value} size={160} level="M" includeMargin />
      <p className="font-mono text-xs text-muted-foreground break-all text-center">{label}</p>
      <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-2">
        <Printer className="w-4 h-4" />
        Print label
      </Button>
    </div>
  );
}
