import { useRef, useImperativeHandle, forwardRef, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface SelectCellHandle {
  activate: () => void;
}

interface SelectCellProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (newValue: string) => void;
  className?: string;
  onTab?: () => void;
  onShiftTab?: () => void;
}

const SelectCell = forwardRef<SelectCellHandle, SelectCellProps>(
  ({ value, options, onSave, className, onTab, onShiftTab }, ref) => {
    const selectRef = useRef<HTMLSelectElement>(null);

    useImperativeHandle(ref, () => ({
      activate: () => selectRef.current?.focus(),
    }));

    const handleKeyDown = (e: KeyboardEvent<HTMLSelectElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey && onShiftTab) {
          onShiftTab();
        } else if (!e.shiftKey && onTab) {
          onTab();
        }
      }
    };

    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => onSave(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full bg-transparent outline-none text-sm py-0.5 px-0 rounded cursor-pointer transition-colors appearance-none border-none focus:ring-1 focus:ring-emerald-300 focus:rounded',
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

SelectCell.displayName = 'SelectCell';

export default SelectCell;
