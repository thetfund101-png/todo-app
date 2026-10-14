import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Modal } from './Modal'

interface WeeklyPlan {
  id: string
  weekStart: string
  items: PlanItem[]
  responsibleRole: string
  responsibleName: string
}

type PlanStatus = 'completed' | 'ongoing' | 'follow-up'

interface PlanItem {
  text: string
  status: PlanStatus
}

interface PlanForm {
  id: string | null
  items: PlanItem[]
  responsibleRole: string
  responsibleName: string
}

const STATUS_LABELS: Record<PlanStatus, string> = {
  completed: 'Completed',
  ongoing: 'Ongoing',
  'follow-up': 'Follow-up',
}

const STATUS_STYLES: Record<PlanStatus, string> = {
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  ongoing: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'follow-up': 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

function getMonday(value = new Date()) {
  const date = new Date(value)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function moveWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00`)
  date.setDate(date.getDate() + amount * 7)
  return getMonday(date)
}

function formatWeek(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export function WeeklyPlansPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday())
  const [plans, setPlans] = useState<WeeklyPlan[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<PlanForm | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .get<{ plans: WeeklyPlan[]; canEdit: boolean }>(`/weekly-plans?weekStart=${weekStart}`)
      .then((result) => {
        if (!active) return
        setPlans(result.plans)
        setCanEdit(result.canEdit)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Weekly plans could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [weekStart])

  async function savePlan(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    const items = form.items.filter((item) => item.text.trim())
    if (items.length === 0) {
      setError('Add at least one plan item.')
      setSaving(false)
      return
    }
    const payload = {
      weekStart,
      items,
      responsibleRole: form.responsibleRole,
      responsibleName: form.responsibleName,
    }
    try {
      if (form.id) {
        const result = await api.put<{ plan: WeeklyPlan }>(`/weekly-plans/${form.id}`, payload)
        setPlans((current) => current.map((plan) => (plan.id === form.id ? result.plan : plan)))
      } else {
        const result = await api.post<{ plan: WeeklyPlan }>('/weekly-plans', payload)
        setPlans((current) => [...current, result.plan])
      }
      setForm(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Weekly plan could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(plan: WeeklyPlan, itemIndex: number, status: PlanStatus) {
    const items = plan.items.map((item, index) => (index === itemIndex ? { ...item, status } : item))
    setSavingStatus(`${plan.id}:${itemIndex}`)
    setError('')
    try {
      const result = await api.put<{ plan: WeeklyPlan }>(`/weekly-plans/${plan.id}`, {
        weekStart: plan.weekStart,
        items,
        responsibleRole: plan.responsibleRole,
        responsibleName: plan.responsibleName,
      })
      setPlans((current) => current.map((item) => (item.id === plan.id ? result.plan : item)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Plan status could not be updated.')
    } finally {
      setSavingStatus(null)
    }
  }

  async function deletePlan(plan: WeeklyPlan) {
    if (!window.confirm(`Delete the plans for ${plan.responsibleName}?`)) return
    setError('')
    try {
      await api.delete(`/weekly-plans/${plan.id}`)
      setPlans((current) => current.filter((item) => item.id !== plan.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Weekly plan could not be deleted.')
    }
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink dark:text-paper">Plans for the Week</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatWeek(weekStart)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWeekStart((current) => moveWeek(current, -1))}
            aria-label="Previous week"
            className="rounded-lg border border-slate-400/25 px-3 py-2 text-sm text-ink dark:text-paper"
          >
            Previous
          </button>
          <button
            onClick={() => setWeekStart(getMonday())}
            className="rounded-lg border border-slate-400/25 px-3 py-2 text-sm text-ink dark:text-paper"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart((current) => moveWeek(current, 1))}
            aria-label="Next week"
            className="rounded-lg border border-slate-400/25 px-3 py-2 text-sm text-ink dark:text-paper"
          >
            Next
          </button>
          {canEdit && (
            <button
              onClick={() =>
                setForm({
                  id: null,
                  items: [{ text: '', status: 'ongoing' }],
                  responsibleRole: '',
                  responsibleName: '',
                })
              }
              className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add plans
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-400/20 bg-white dark:border-teal-800 dark:bg-teal-900/60">
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading weekly plans…</p>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No plans have been added for this week.</p>
            {canEdit && (
              <button
                onClick={() =>
                  setForm({
                    id: null,
                    items: [{ text: '', status: 'ongoing' }],
                    responsibleRole: '',
                    responsibleName: '',
                  })
                }
                className="mt-3 text-sm font-medium text-teal-800 underline dark:text-gold-400"
              >
                Add the first plans
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead className="bg-teal-950 text-sm font-semibold text-white">
                <tr>
                  <th scope="col" className="w-1/2 px-4 py-3 sm:px-5">
                    Plans for the week
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Person Responsible
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, index) => (
                  <tr
                    key={plan.id}
                    className={`border-t border-slate-400/20 align-top dark:border-teal-800 ${
                      index % 2 === 0 ? 'bg-slate-100/70 dark:bg-teal-950/30' : ''
                    }`}
                  >
                    <td className="px-4 py-4 sm:px-5">
                      <ul className="list-disc space-y-1 pl-5 text-sm text-ink dark:text-paper">
                        {plan.items.map((item, lineIndex) => (
                          <li key={`${plan.id}-${lineIndex}`}>{item.text}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-4">
                      <ul className="space-y-1.5">
                        {plan.items.map((item, itemIndex) => (
                          <li key={`${plan.id}-status-${itemIndex}`}>
                            {canEdit ? (
                              <select
                                aria-label={`Status for ${item.text}`}
                                value={item.status}
                                disabled={savingStatus !== null}
                                onChange={(event) =>
                                  void updateStatus(plan, itemIndex, event.target.value as PlanStatus)
                                }
                                className={`max-w-full rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${STATUS_STYLES[item.status]}`}
                              >
                                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                              >
                                {STATUS_LABELS[item.status]}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-4 text-sm text-ink dark:text-paper">
                      <p>{plan.responsibleRole}</p>
                      <p className="mt-0.5">{plan.responsibleName}</p>
                      {canEdit && (
                        <div className="mt-3 flex gap-3">
                          <button
                            onClick={() =>
                              setForm({
                                id: plan.id,
                                items: plan.items.map((item) => ({ ...item })),
                                responsibleRole: plan.responsibleRole,
                                responsibleName: plan.responsibleName,
                              })
                            }
                            className="text-xs font-medium text-teal-800 underline dark:text-gold-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void deletePlan(plan)}
                            className="text-xs font-medium text-red-600 underline"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <Modal title={form.id ? 'Edit weekly plans' : 'Add weekly plans'} onClose={() => setForm(null)}>
          <form onSubmit={(event) => void savePlan(event)} className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-ink dark:text-paper">Plan items and status</legend>
              {form.items.map((item, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <input
                    required
                    maxLength={1000}
                    value={item.text}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        items: form.items.map((current, itemIndex) =>
                          itemIndex === index ? { ...current, text: event.target.value } : current,
                        ),
                      })
                    }
                    placeholder={`Plan item ${index + 1}`}
                    aria-label={`Plan item ${index + 1}`}
                    className="min-w-48 flex-1 rounded-lg border border-slate-400/30 bg-white px-3 py-2 text-sm text-ink dark:bg-teal-950 dark:text-paper"
                  />
                  <select
                    aria-label={`Status for plan item ${index + 1}`}
                    value={item.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        items: form.items.map((current, itemIndex) =>
                          itemIndex === index ? { ...current, status: event.target.value as PlanStatus } : current,
                        ),
                      })
                    }
                    className="rounded-lg border border-slate-400/30 bg-white px-2 py-2 text-sm text-ink dark:bg-teal-950 dark:text-paper"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={form.items.length === 1}
                    onClick={() =>
                      setForm({ ...form, items: form.items.filter((_current, itemIndex) => itemIndex !== index) })
                    }
                    aria-label={`Remove plan item ${index + 1}`}
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-600 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={form.items.length >= 100}
                onClick={() => setForm({ ...form, items: [...form.items, { text: '', status: 'ongoing' }] })}
                className="rounded-lg border border-slate-400/25 px-3 py-2 text-sm text-ink dark:text-paper disabled:opacity-40"
              >
                Add plan item
              </button>
            </fieldset>
            <label className="block text-sm font-medium text-ink dark:text-paper">
              Responsible position
              <input
                required
                maxLength={120}
                value={form.responsibleRole}
                onChange={(event) => setForm({ ...form, responsibleRole: event.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-400/30 bg-white px-3 py-2 text-sm text-ink dark:bg-teal-950 dark:text-paper"
              />
            </label>
            <label className="block text-sm font-medium text-ink dark:text-paper">
              Person responsible
              <input
                required
                maxLength={120}
                value={form.responsibleName}
                onChange={(event) => setForm({ ...form, responsibleName: event.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-400/30 bg-white px-3 py-2 text-sm text-ink dark:bg-teal-950 dark:text-paper"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setForm(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add plans'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
