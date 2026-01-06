import { useState, useRef, useEffect } from 'react';
import { Scan } from 'lucide-react';

interface ScanInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function ScanInput({ onScan, placeholder = 'Scan QR Code', autoFocus = true, disabled = false }: ScanInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onScan(value.trim().toUpperCase());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
          <Scan className="w-7 h-7" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="scan-input pl-14 pr-4 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          autoComplete="off"
          autoCapitalize="characters"
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="w-full mt-4 h-16 bg-scan hover:bg-scan-hover active:bg-scan-active 
                   text-primary-foreground text-xl font-bold rounded-lg
                   transition-all duration-150 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   animate-pulse-scan"
      >
        <span className="flex items-center justify-center gap-3">
          <Scan className="w-6 h-6" />
          Scan
        </span>
      </button>
    </form>
  );
}
