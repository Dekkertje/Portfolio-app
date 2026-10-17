import { LucideIcon } from "lucide-react"
import { PrivacyText } from "@/components/ui/PrivacyText"

type MetricCardProps = {
  title: string
  value: string
  change?: {
    value: string
    isPositive: boolean
  }
  icon: LucideIcon
  iconColor: string
}

export function MetricCard({ title, value, change, icon: Icon, iconColor }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80 transition-shadow hover:shadow-md dark:hover:shadow-black/30">
      {/* Subtle top accent line */}
      <div className={`absolute inset-x-0 top-0 h-0.5 rounded-t-2xl opacity-60 ${iconColor}`} />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
            <PrivacyText>{value}</PrivacyText>
          </p>
          {change && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`text-sm font-semibold ${
                  change.isPositive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                }`}
              >
                <PrivacyText>
                  {change.isPositive ? "+" : ""}
                  {change.value}
                </PrivacyText>
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">vandaag</span>
            </div>
          )}
        </div>
        <div className={`rounded-xl ${iconColor} p-3 shadow-lg shadow-black/10 flex-shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

