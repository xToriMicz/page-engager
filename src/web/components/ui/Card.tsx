import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function Card({ title, children, className = "", ...props }: CardProps) {
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`} {...props}>
      {title && <h3 className="mb-3 text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h3>}
      {children}
    </div>
  );
}
