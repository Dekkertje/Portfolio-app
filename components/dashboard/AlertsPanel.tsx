"use client"

import { useState } from "react"
import { Bell, TrendingUp, TrendingDown, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { PriceAlert } from "@/lib/types"

type AlertsPanelProps = {
  alerts: PriceAlert[]
  onCreateAlert: (alert: Omit<PriceAlert, "id" | "user_id" | "created_at">) => void
  onDeleteAlert: (id: string) => void
}

export function AlertsPanel({ alerts, onCreateAlert, onDeleteAlert }: AlertsPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    product: "",
    alert_type: "above" as "above" | "below" | "change_percent",
    target_value: 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreateAlert({
      product: formData.product,
      isin: null,
      alert_type: formData.alert_type,
      target_value: formData.target_value,
      is_active: true,
    })
    setFormData({ product: "", alert_type: "above", target_value: 0 })
    setShowForm(false)
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Prijs Alerts</h2>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nieuw Alert
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 rounded-lg bg-slate-50 p-4">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Product</label>
              <input
                type="text"
                value={formData.product}
                onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Bijv. ASML HOLDING"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={formData.alert_type}
                  onChange={(e) => setFormData({ ...formData, alert_type: e.target.value as any })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="above">Boven</option>
                  <option value="below">Onder</option>
                  <option value="change_percent">% Verandering</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Waarde</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Aanmaken</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Annuleren
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Geen actieve alerts</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div className="flex items-center gap-3">
                {alert.alert_type === "above" ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium text-slate-900">{alert.product}</p>
                  <p className="text-sm text-slate-500">
                    {alert.alert_type === "above" && `Boven €${alert.target_value}`}
                    {alert.alert_type === "below" && `Onder €${alert.target_value}`}
                    {alert.alert_type === "change_percent" && `${alert.target_value}% verandering`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onDeleteAlert(alert.id)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

