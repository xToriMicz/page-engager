interface BadgeProps {
  children: React.ReactNode;
  variant?: "blue" | "green" | "red" | "amber";
  className?: string;
}

const variantClasses: Record<string, string> = {
  blue: "bg-blue-900/30 text-blue-400",
  green: "bg-green-900/30 text-green-400",
  red: "bg-red-900/30 text-red-400",
  amber: "bg-amber-900/30 text-amber-400",
};

export function Badge({ children, variant = "blue", className = "" }: BadgeProps) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
