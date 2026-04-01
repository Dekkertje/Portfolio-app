import { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "danger"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]",
  secondary:
    "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
  danger:
    "bg-red-500/15 text-red-200 hover:bg-red-500/25",
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
  const styles = `${baseStyles} ${variantStyles[variant]} ${className}`

  return (
    <button className={styles} {...props}>
      {children}
    </button>
  )
}

