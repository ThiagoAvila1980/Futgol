import React, { useEffect, useRef, useState } from 'react';

interface DateInputProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
}

const toDisplay = (iso: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const toISO = (display: string) => {
  const s = display.replace(/\s+/g, '');
  const m = s.match(/^(\d{2})[\/](\d{2})[\/]?(\d{4})$/);
  if (!m) return '';
  const dd = m[1], mm = m[2], yyyy = m[3];
  if (Number(mm) < 1 || Number(mm) > 12) return '';
  if (Number(dd) < 1 || Number(dd) > 31) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, className, required, disabled, min, max }) => {
  const [text, setText] = useState(toDisplay(value));
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const clampISO = (iso: string) => {
    if (!iso) return '';
    const cmp = (a: string, b: string) => a.localeCompare(b);
    if (min && cmp(iso, min) < 0) return min;
    if (max && cmp(iso, max) > 0) return max;
    return iso;
  };

  const handleBlur = () => {
    const iso = toISO(text);
    if (iso) onChange(clampISO(iso));
    else if (!text) onChange('');
    else setText(toDisplay(value));
  };

  const openPicker = () => {
    if (disabled) return;
    try {
      // Try modern showPicker API
      (dateRef.current as any)?.showPicker?.();
    } catch {}
    if (dateRef.current) {
      dateRef.current.focus();
      // Fallback: trigger a click to open native picker
      dateRef.current.click();
    }
  };

  const onNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // YYYY-MM-DD
    if (iso) {
      const clamped = clampISO(iso);
      onChange(clamped);
      setText(toDisplay(clamped));
    }
  };

  const onMaskedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    // Basic mask DD/MM/YYYY
    let s = e.target.value.replace(/[^0-9]/g, '');
    if (s.length > 8) s = s.slice(0, 8);
    if (s.length >= 5) s = `${s.slice(0,2)}/${s.slice(2,4)}/${s.slice(4)}`;
    else if (s.length >= 3) s = `${s.slice(0,2)}/${s.slice(2)}`;
    setText(s);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={text}
      onChange={onMaskedChange}
      onBlur={handleBlur}
      className={className}
      required={required}
      disabled={disabled}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-500"
        title="Selecionar data"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 011 1v1h6V3a1 1 0 112 0v1h1a2 2 0 012 2v9a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 012 0v1zm11 6H3v7h14V8z" clipRule="evenodd" />
        </svg>
      </button>

      <input
        ref={dateRef}
        type="date"
        value={value || ''}
        onChange={onNativeChange}
        className="absolute right-0 opacity-0 w-0 h-0"
        lang="pt-BR"
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
};

export default DateInput;
