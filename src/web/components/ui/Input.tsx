import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

const base = "w-full px-3 py-2 bg-background border border-ring rounded-[var(--radius-md)] text-sm text-foreground placeholder:text-subtle focus:border-ring-focus focus:outline-none transition-colors duration-150 aria-invalid:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} data-slot="input" className={`${base} ${className}`} {...props} />
  )
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", ...props }, ref) => (
    <select ref={ref} data-slot="select" className={`${base} ${className}`} {...props} />
  )
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea ref={ref} data-slot="textarea" className={`${base} resize-y ${className}`} {...props} />
  )
);
