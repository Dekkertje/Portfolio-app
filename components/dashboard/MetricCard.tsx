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
    <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            <PrivacyText>{value}</PrivacyText>
          </p>
          {change && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-sm font-semibold ${
                  change.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                <PrivacyText>
                  {change.isPositive ? "+" : ""}
                  {change.value}
                </PrivacyText>
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">vandaag</span>
            </div>
          )}
        </div>
        <div className={`rounded-lg ${iconColor} p-3`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  )
}

