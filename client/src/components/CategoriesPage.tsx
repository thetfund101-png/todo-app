import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'

interface Category {
  id: string
  name: string
  isBuiltin: boolean
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadCategories() {
    setLoading(true)
    try {
      const result = await api.get<{ categories: Category[] }>('/categories')
      setCategories(result.categories)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Categories could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [])

  async function createCategory(event: FormEvent) {
    event.preventDefault()
    try {
      await api.post('/categories', { name })
      setName('')
      await loadCategories()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Category could not be created.')
    }
  }

  async function saveCategory(category: Category) {
    try {
      await api.put(`/categories/${category.id}`, { name: editing[category.id] ?? category.name })
      await loadCategories()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Category could not be updated.')
    }
  }

  async function deleteCategory(category: Category) {
    try {
      await api.delete(`/categories/${category.id}`)
      await loadCategories()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Category could not be deleted.')
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Built-in categories are protected. A custom category can be deleted only when it is not referenced by tasks or
        user defaults.
      </p>
      <form onSubmit={createCategory} className="mb-5 flex gap-2">
        <input
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New category name"
          className="min-w-0 flex-1 rounded-lg border border-slate-400/30 bg-white px-3 py-2 text-sm text-ink dark:bg-teal-900 dark:text-paper"
        />
        <button className="rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-white">Add category</button>
      </form>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-400/20 bg-white dark:border-teal-800 dark:bg-teal-900/60">
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No categories found.</p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className="flex flex-wrap items-center gap-2 border-b border-slate-400/10 p-3 last:border-0 dark:border-teal-800"
            >
              <input
                aria-label={`Name for ${category.name}`}
                disabled={category.isBuiltin}
                maxLength={80}
                value={editing[category.id] ?? category.name}
                onChange={(event) => setEditing((current) => ({ ...current, [category.id]: event.target.value }))}
                className="min-w-40 flex-1 rounded-lg border border-slate-400/25 bg-transparent px-3 py-2 text-sm text-ink disabled:border-transparent disabled:opacity-80 dark:text-paper"
              />
              <span className="min-w-20 text-xs text-slate-500">{category.isBuiltin ? 'Built-in' : 'Custom'}</span>
              {!category.isBuiltin && (
                <>
                  <button
                    onClick={() => void saveCategory(category)}
                    className="rounded-md border border-slate-400/25 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => void deleteCategory(category)}
                    className="rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs text-red-500"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
