/**
 * UI primitives.
 *
 * Thin, typed wrappers over semantic HTML. They exist so feature components
 * describe intent ("primary button", "field labelled Format") instead of
 * carrying styling decisions inline, which is what made the previous
 * App.tsx unreadable and the light theme impossible to fix.
 */
import React, { useId } from 'react';
import { FiAlertCircle, FiLoader } from 'react-icons/fi';
import './ui.css';

/* ---------------------------------------------------------------- Card -- */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'quiet' | 'flush';
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...rest
}) => (
  <div
    className={`ui-card ${variant !== 'default' ? `ui-card--${variant}` : ''} ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, icon, actions }) => (
  <div className="ui-card__header">
    <div className="ui-card__title">
      {icon}
      <span>{title}</span>
    </div>
    {actions}
  </div>
);

export const CardBody: React.FC<{
  tight?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ tight, className = '', children }) => (
  <div className={`ui-card__body ${tight ? 'ui-card__body--tight' : ''} ${className}`}>
    {children}
  </div>
);

/* -------------------------------------------------------------- Button -- */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  iconOnly?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  block,
  iconOnly,
  loading,
  disabled,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    className={[
      'ui-btn',
      `ui-btn--${variant}`,
      size !== 'md' ? `ui-btn--${size}` : '',
      block ? 'ui-btn--block' : '',
      iconOnly ? 'ui-btn--icon' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...rest}
  >
    {loading ? <FiLoader className="ui-spinner" aria-hidden /> : null}
    {children}
  </button>
);

/* --------------------------------------------------------------- Field -- */

export interface FieldProps {
  /** Rendered as the visible <label>. Kept as a bare string so it stays a
   *  single, queryable text node for tests and screen readers alike. */
  label: string;
  /** Right-aligned live value, e.g. the current kbps next to a slider. */
  value?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  /** Set when the control is not a single focusable element (e.g. a range
   *  plus a scale), so the label is associated via aria-labelledby instead. */
  as?: 'label' | 'group';
  children: (controlId: string) => React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  value,
  hint,
  error,
  disabled,
  as = 'label',
  children,
}) => {
  const id = useId();
  const controlId = `${id}-control`;
  const labelId = `${id}-label`;

  const labelRow = (
    <div className="ui-field__label-row">
      {as === 'label' ? (
        <label className="ui-field__label" htmlFor={controlId} id={labelId}>
          {label}
        </label>
      ) : (
        <span className="ui-field__label" id={labelId}>
          {label}
        </span>
      )}
      {value !== undefined && <span className="ui-field__value">{value}</span>}
    </div>
  );

  const body = (
    <>
      {labelRow}
      {children(controlId)}
      {error ? (
        <span className="ui-field__error" role="alert">
          <FiAlertCircle aria-hidden /> {error}
        </span>
      ) : (
        hint && <span className="ui-field__hint">{hint}</span>
      )}
    </>
  );

  const className = `ui-field ${disabled ? 'ui-field--disabled' : ''}`;

  if (as === 'group') {
    return (
      <div className={className} role="group" aria-labelledby={labelId}>
        {body}
      </div>
    );
  }
  return <div className={className}>{body}</div>;
};

/* --------------------------------------------------------------- Input -- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

export const Input: React.FC<InputProps> = ({
  invalid,
  mono,
  className = '',
  ...rest
}) => (
  <input
    className={[
      'ui-input',
      invalid ? 'ui-input--invalid' : '',
      mono ? 'ui-input--mono' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    aria-invalid={invalid || undefined}
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <select className={`ui-select ${className}`} {...rest}>
    {children}
  </select>
);

/* --------------------------------------------------- Segmented control -- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  block?: boolean;
  'aria-label'?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  block,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`ui-segmented ${block ? 'ui-segmented--block' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="ui-segmented__item"
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Progress -- */

export interface ProgressBarProps {
  /** 0–100. Pass `undefined` for an indeterminate sweep. */
  percent?: number;
  tone?: 'accent' | 'success' | 'danger';
  left?: React.ReactNode;
  right?: React.ReactNode;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  tone = 'accent',
  left,
  right,
  label,
}) => {
  const indeterminate = percent === undefined;
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div
      className={[
        'ui-progress',
        tone !== 'accent' ? `ui-progress--${tone}` : '',
        indeterminate ? 'ui-progress--indeterminate' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      >
        <div className="ui-progress__fill" style={{ width: `${clamped}%` }} />
      </div>
      {(left || right) && (
        <div className="ui-progress__meta">
          <span className="truncate">{left}</span>
          <span className="tabular">{right}</span>
        </div>
      )}
    </div>
  );
};

/* --------------------------------------------------------------- Badge -- */

export const Badge: React.FC<{
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning';
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon, children }) => (
  <span className={`ui-badge ui-badge--${tone}`}>
    {icon}
    {children}
  </span>
);

/* -------------------------------------------------------------- Toggle -- */

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <div className="ui-toggle">
    <span className="ui-toggle__text" id={`${label}-toggle-label`}>
      {label}
    </span>
    <button
      type="button"
      role="switch"
      className="ui-toggle__switch"
      aria-checked={checked}
      aria-labelledby={`${label}-toggle-label`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  </div>
);

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ checked, onChange, children, disabled }) => (
  <label className="ui-checkbox">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    {children}
  </label>
);

/* --------------------------------------------------------------- Range -- */

export const Range: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...rest
}) => <input type="range" className={`ui-range ${className}`} {...rest} />;

/* --------------------------------------------------------- Empty state -- */

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="ui-empty">
    {icon && <div className="ui-empty__icon">{icon}</div>}
    <div className="ui-empty__title">{title}</div>
    {description && <p className="ui-empty__description">{description}</p>}
    {action}
  </div>
);

/* --------------------------------------------------------------- Alert -- */

export const Alert: React.FC<{
  tone?: 'danger' | 'success' | 'info';
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ tone = 'info', icon, children }) => (
  <div className={`ui-alert ui-alert--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
    {icon ?? <FiAlertCircle aria-hidden />}
    <div className="ui-alert__content selectable">{children}</div>
  </div>
);
