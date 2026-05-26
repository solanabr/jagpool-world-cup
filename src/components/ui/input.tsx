import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className = "", id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm text-foreground/70">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={`bg-white/5 border border-white/10 rounded-md px-3 py-2 text-foreground outline-none focus:border-jagpool-primary ${className}`}
        {...rest}
      />
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
});
