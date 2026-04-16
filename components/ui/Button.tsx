import { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "danger"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-lime-500 text-white hover:bg-lime-400 shadow-sm shadow-lime-500/20",
  secondary:
    "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
  danger:
    "bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20",
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  const styles = `${baseStyles} ${variantStyles[variant]} ${className}`

  return (
    <button className={styles} {...props}>
      {children}
    </button>
  )
}
