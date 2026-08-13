import React, { useEffect, useState } from 'react';
import { Input } from './index';
import { formatTimecode, parseTimecode } from '../../utils/formatUtils';

interface TimecodeInputProps {
  /** Committed value in seconds. */
  value: number;
  onChange: (seconds: number) => void;
  /** Upper bound in seconds; the committed value is clamped into [0, max]. */
  max?: number;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  onValidityChange?: (error: string | null) => void;
  invalidMessage?: string;
}

/**
 * A time field the user edits as `mm:ss` (or `h:mm:ss`) rather than as a raw
 * seconds count.
 *
 * Editing is uncontrolled while focused so partial input like `1:` is never
 * rewritten mid-keystroke, then committed and normalised on blur or Enter.
 * Escape reverts. This replaces the two `<input type="number">` seconds
 * fields, which required the user to convert "start at 1:30" to "90" by hand.
 */
export const TimecodeInput: React.FC<TimecodeInputProps> = ({
  value,
  onChange,
  max,
  disabled,
  id,
  'aria-label': ariaLabel,
  onValidityChange,
  invalidMessage = 'Use mm:ss',
}) => {
  const showHours = (max ?? value) >= 3600;
  const [draft, setDraft] = useState(() => formatTimecode(value, showHours));
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Re-sync from props whenever the field isn't being actively edited, so a
  // programmatic change (new media loaded, "use full track" toggled) shows up
  // without clobbering in-progress typing.
  useEffect(() => {
    if (!editing) {
      setDraft(formatTimecode(value, showHours));
      setInvalid(false);
      onValidityChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, showHours, editing]);

  const commit = () => {
    const parsed = parseTimecode(draft);
    if (parsed === null) {
      setInvalid(true);
      onValidityChange?.(invalidMessage);
      return;
    }
    const clamped = Math.max(0, max !== undefined ? Math.min(parsed, max) : parsed);
    setInvalid(false);
    onValidityChange?.(null);
    setDraft(formatTimecode(clamped, showHours));
    onChange(clamped);
  };

  return (
    <Input
      id={id}
      mono
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      aria-label={ariaLabel}
      disabled={disabled}
      invalid={invalid}
      value={draft}
      placeholder={showHours ? '0:00:00' : '00:00'}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setDraft(formatTimecode(value, showHours));
          setInvalid(false);
          onValidityChange?.(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
};
