import { useId } from "react";

/**
 * A number you step rather than type (STYLE_GUIDE § 9): a named group of a − button, a mono
 * `<output>` and a + button. At a bound the button stays a real, focusable `<button>` marked
 * `aria-disabled="true"` and points at a visible reason, so a keyboard or screen-reader user is
 * told why it does nothing; it is never a bare `disabled`.
 */
export default function Stepper({ label, value, min, max, step, onChange }: {
  /** The row's name: the group is named for it, and the buttons *Decrease* / *Increase* it. */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const why = useId();
  const atMin = value <= min;
  const atMax = value >= max;
  const noun = label.toLowerCase();
  return (
    <span className="stepper-wrap">
      <span role="group" aria-label={label} className="stepper">
        <button type="button" aria-label={`Decrease ${noun}`} aria-disabled={atMin || undefined}
                aria-describedby={atMin ? why : undefined} onClick={() => !atMin && onChange(Math.max(min, value - step))}>
          &minus;
        </button>
        <output className="val">{value}</output>
        <button type="button" aria-label={`Increase ${noun}`} aria-disabled={atMax || undefined}
                aria-describedby={atMax ? why : undefined} onClick={() => !atMax && onChange(Math.min(max, value + step))}>
          +
        </button>
      </span>
      {(atMin || atMax) && (
        <span id={why} className="small muted stepper-why">{atMin ? `The lowest is ${min}` : `The highest is ${max}`}</span>
      )}
    </span>
  );
}
