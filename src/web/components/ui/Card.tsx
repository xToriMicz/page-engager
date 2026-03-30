import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function Card({ title, children, className = "", ...props }: CardProps) {
  return (
    <div className={`bg-dark-800 border border-dark-600 rounded-lg p-4 ${className}`} {...props}>
      {title && <h3 className="mb-3 text-sm font-semibold text-dark-100">{title}</h3>}
      {children}
    </div>
  );
}
