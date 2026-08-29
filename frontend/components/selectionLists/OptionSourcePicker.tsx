import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Layers, TriangleAlert, ListPlus } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import {
  fetchPublishedSelectionLists, LIST_STATUS_LABEL,
  type SelectionList, type SelectionListOption,
} from '../../lib/selectionLists'

const BRAND = '#5B4DE6'

interface Props {
  value: string | null // selection_list_id
  onChange: (listId: string | null) => void
  contextLabel?: string
}

/**
 * Lets an admin bind a SELECT / MULTI_SELECT field definition to a central,
 * published selection list (the canonical Phase-2 wiring). Only active +
 * published lists are selectable. Inline options remain for legacy drafts when
 * no list is chosen.
 */
export default function OptionSourcePicker({ value, onChange, contextLabel }: Props) {
  const [lists, setLists] = useState<SelectionList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const d = await fetchPublishedSelectionLists()
      setLists(d.lists)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت فهرستها ناموفق بود.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  // Only STATIC + dependent or independent lists can feed select fields.
  const selectable = useMemo(() => lists.filter((l) => l.source_type === 'STATIC' || l.source_type === 'SYSTEM'), [lists])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return selectable
    return selectable.filter((l) => l.title.toLowerCase().includes(q) || l.key.toLowerCase().includes(q))
  }, [selectable, query])

  const selected = lists.find((l) => l.id === value) ?? null

  return (
    <div className="space-y-2">
      <Label className="text-xs text-zinc-700 dark:text-zinc-200">
        {contextLabel ?? 'منبع گزینهها'}
      </Label>
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-xs text-zinc-400 dark:border-zinc-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />در حال بارگذاری فهرستها...</div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-600 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="ghost" onClick={() => void load()} className="h-6 text-[10px] text-red-600">تلاش دوباره</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-1 dark:border-zinc-700">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 py-1 text-left">
              {selected ? (
                <>
                  <Layers className="h-3.5 w-3.5" style={{ color: BRAND }} />
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{selected.title}</span>
                  <span className="text-[10px] text-zinc-400">{selected.key}</span>
                  {selected.is_dependent && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-300">وابسته</span>}
                </>
              ) : (
                <span className="text-xs text-zinc-400">انتخاب فهرست...</span>
              )}
            </button>
            {selected && (
              <button type="button" onClick={() => onChange(null)} title="حذف اتصال" className="text-zinc-400 hover:text-red-500"><span className="sr-only">حذف</span>✕</button>
            )}
          </div>

          {open && (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-[#232327]">
              <div className="relative">
                <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستوجوی فهرست..." className="h-9 pr-8" />
              </div>
              <div className="max-h-52 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.length === 0 && <div className="px-2 py-4 text-center text-[11px] text-zinc-400">فهرست منتشرشدهای یافت نشد.</div>}
                {filtered.map((l) => (
                  <button key={l.id} type="button"
                    onClick={() => { onChange(l.id); setOpen(false) }}
                    className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{l.title}</p>
                        <p className="truncate font-mono text-[10px] text-zinc-400">{l.key}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${l.status === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-200'}`}>
                      {LIST_STATUS_LABEL[l.status]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!selected && (
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <ListPlus className="h-3.5 w-3.5" />
              از «فهرستهای انتخابی» در ادمین، فهرستی ایجاد و منتشر کنید تا گزینهها از Supabase دریافت شوند.
            </div>
          )}
        </>
      )}
    </div>
  )
}

export type { SelectionListOption }