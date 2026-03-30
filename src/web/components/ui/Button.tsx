import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger" | "secondary" | "ghost";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white",
  danger: "px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20",
  secondary: "bg-card-hover hover:bg-[#252540] text-text-primary",
  ghost: "bg-transparent hover:bg-card-hover text-text-primary",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-md border-none cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${variant !== "danger" ? sizeClasses[size] : ""} ${className}`}
      {...props}
    />
  );
}
