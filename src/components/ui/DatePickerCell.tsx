import { useState, useRef, useEffect, useImperativeHandle, forwardRef, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { cn } from '@/lib/utils';

export interface DatePickerCellHandle {
  activate: () => void;
}

interface DatePickerCellProps {
  value: string; // YYYY-MM-DD
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onTab?: () => void;
  onShiftTab?: () => void;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplay(str: string): string {
  const d = parseDate(str);
  if (!d) return str;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const DatePickerCell = forwardRef<DatePickerCellHandle, DatePickerCellProps>(
  ({ value, onSave, placeholder = 'Select date', className, autoFocus = false, onTab, onShiftTab }, ref) => {
    const [open, setOpen] = useState(autoFocus);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    useImperativeHandle(ref, () => ({
      activate: () => setOpen(true),
    }));

    // Position the popover relative to the trigger element
    useEffect(() => {
      if (!open || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }, [open]);

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          triggerRef.current && !triggerRef.current.contains(target) &&
          popoverRef.current && !popoverRef.current.contains(target)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Close on scroll (table might scroll)
    useEffect(() => {
      if (!open) return;
      const handleScroll = () => setOpen(false);
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }, [open]);

    const handleChange = (date: Date | null) => {
      if (date) {
        const formatted = formatDate(date);
        if (formatted !== value) {
          onSave(formatted);
        }
      }
      setOpen(false);
      // After selecting a date, move to next field
      if (onTab) onTab();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setOpen(false);
        if (e.shiftKey && onShiftTab) {
          onShiftTab();
        } else if (!e.shiftKey && onTab) {
          onTab();
        }
      }
    };

    const isEmpty = !value;

    return (
      <>
        <span
          ref={triggerRef}
          tabIndex={0}
          onClick={() => setOpen(!open)}
          onKeyDown={handleKeyDown}
          className={cn(
            'block w-full text-sm py-0.5 px-1 -mx-1 rounded cursor-pointer transition-colors min-h-[1.5rem] flex items-center gap-1 outline-none focus:ring-1 focus:ring-emerald-300',
            isEmpty && 'text-gray-300',
            open && 'bg-gray-100',
            className,
          )}
        >
          <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {isEmpty ? placeholder : formatDisplay(value)}
        </span>

        {open && createPortal(
          <div
            ref={popoverRef}
            className="finance-datepicker-popover"
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              zIndex: 9999,
            }}
          >
            <DatePicker
              selected={parseDate(value)}
              onChange={handleChange}
              inline
              dateFormat="yyyy-MM-dd"
              calendarClassName="finance-datepicker"
            />
          </div>,
          document.body,
        )}
      </>
    );
  }
);

DatePickerCell.displayName = 'DatePickerCell';

export default DatePickerCell;
