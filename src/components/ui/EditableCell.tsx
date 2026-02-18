import { useState, useRef, useEffect, useImperativeHandle, forwardRef, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface EditableCellHandle {
  activate: () => void;
}

interface EditableCellProps {
  value: string | number;
  onSave: (newValue: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  displayValue?: string;
  className?: string;
  autoFocus?: boolean;
  onTab?: () => void;
  onShiftTab?: () => void;
  min?: number;
}

const EditableCell = forwardRef<EditableCellHandle, EditableCellProps>(
  (
    {
      value,
      onSave,
      type = 'text',
      placeholder = '-',
      displayValue,
      className,
      autoFocus = false,
      onTab,
      onShiftTab,
      min,
    },
    ref
  ) => {
    const [editing, setEditing] = useState(autoFocus);
    const [editValue, setEditValue] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      activate: () => setEditing(true),
    }));

    useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [editing]);

    useEffect(() => {
      setEditValue(String(value));
    }, [value]);

    const save = () => {
      setEditing(false);
      let trimmed = editValue.trim();

      // Clamp numeric values to min if provided
      if (type === 'number' && trimmed !== '') {
        let num = parseFloat(trimmed);
        if (isNaN(num)) num = 0;
        if (min !== undefined && num < min) num = min;
        trimmed = String(num);
      }

      if (trimmed !== String(value)) {
        onSave(trimmed);
      }
    };

    const cancel = () => {
      setEditing(false);
      setEditValue(String(value));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        save();
        if (e.shiftKey && onShiftTab) {
          onShiftTab();
        } else if (!e.shiftKey && onTab) {
          onTab();
        }
      }
    };

    if (editing) {
      return (
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          step={type === 'number' ? 'any' : undefined}
          min={type === 'number' && min !== undefined ? min : undefined}
          className={cn(
            'w-full bg-transparent outline-none text-sm py-0.5 px-1 -mx-1 rounded border border-emerald-300 focus:border-emerald-500',
            type === 'number' && 'tabular-nums text-right',
            className
          )}
          placeholder={placeholder}
        />
      );
    }

    const display = displayValue || (value === 0 && type === 'number' ? '0' : String(value));
    const isEmpty = !value && value !== 0;

    return (
      <span
        onClick={() => setEditing(true)}
        className={cn(
          'block w-full text-sm py-0.5 px-1 -mx-1 rounded cursor-text transition-colors min-h-[1.5rem]',
          type === 'number' && 'tabular-nums text-right',
          isEmpty && 'text-gray-300',
          className
        )}
      >
        {isEmpty ? placeholder : display}
      </span>
    );
  }
);

EditableCell.displayName = 'EditableCell';

export default EditableCell;
