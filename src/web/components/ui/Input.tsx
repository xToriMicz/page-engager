import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base = "px-3 py-2 bg-dark-700 border border-dark-500 rounded-md text-dark-100 text-sm placeholder:text-dark-400 focus:outline-none focus:border-blue-500 transition-colors";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${base} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} resize-y ${className}`} {...props} />;
}
