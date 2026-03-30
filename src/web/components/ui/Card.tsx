import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const paddings = { sm: "p-3", md: "p-4", lg: "p-5" };

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", className = "", ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={`bg-surface border border-ring rounded-[var(--radius-lg)] ${paddings[padding]} ${className}`}
      {...props}
    />
  )
);

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-header" className={`mb-3 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="card-title" className={`text-sm font-medium text-muted uppercase tracking-wider ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={className} {...props} />;
}
