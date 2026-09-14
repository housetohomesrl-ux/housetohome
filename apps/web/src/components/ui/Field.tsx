import { type InputHTMLAttributes, type SelectHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

// Variante visiva che replica la convenzione dell'Excel originale:
//  - "input": editabile dall'utente (giallo)
//  - "linked": valore collegato/derivato da un'altra sezione, non editabile qui (verde)
//  - "calculated": valore calcolato dal motore di calcolo, mai editabile (grigio)
type FieldVariant = "input" | "linked" | "calculated";

const variantClass: Record<FieldVariant, string> = {
  input: "field-input",
  linked: "field-linked",
  calculated: "field-calculated",
};

export const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
    {children}
  </label>
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & { variant?: FieldVariant };

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, variant = "input", ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(
      "w-full rounded-md px-3 py-2 text-sm outline-none disabled:opacity-70",
      variantClass[variant],
      className,
    )}
    readOnly={variant === "calculated" || props.readOnly}
    {...props}
  />
));
Input.displayName = "Input";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { variant?: FieldVariant };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant = "input", children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx("w-full rounded-md px-3 py-2 text-sm outline-none", variantClass[variant], className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

/** Campo di sola visualizzazione per un valore calcolato (con etichetta ed eventuale unità). */
export function CalculatedValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className={clsx("rounded-md px-3 py-2 text-sm font-medium", variantClass.calculated)}>{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
