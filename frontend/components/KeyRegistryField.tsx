import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Copy, Loader2, Lock, RefreshCw, TriangleAlert, XCircle } from 'lucide-react'
import { Input } from '../lib/shadcn/input'
import { Button } from '../lib/shadcn/button'
import {
  suggestKey, checkRegistryKey, isValidKeyPattern, KEY_FORMAT_HINT,
  type KeyEntityType, type KeyStatus, type SystemKeyRecord,
} from '../lib/systemKeys'

type CheckState =
  | { kind: 'checking' }
  | { kind: 'free' }
  | { kind: 'duplicate'; record: SystemKeyRecord }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }

interface KeyRegistryFieldProps {
  /** Persian title; drives the suggestion until the admin edits the key. */
  title: string
  entityType: KeyEntityType
  module?: string
  formName?: string
  parentKey?: string
  /** Existing raw key (e.g. field.key). If it contains '.' it is treated as a full key. */
  initialKey?: string
  /** Whether the key is locked (published / used). */
  locked?: boolean
  lockReason?: string
  /** The real row this key lives on, so its own registry row isn't seen as a conflict. */
  sourceTable?: string | null
  sourceRecordId?: string | null
  /** Emits the chosen FULL namespaced key. */
  onFullKeyChange: (fullKey: string) => void
  autoApply?: boolean
  /** Compact table-row mode: input + suggestion only, no buttons/status/hint. */
  compact?: boolean
  placeholder?: string
}

export default function KeyRegistryField({
  title, entityType, module, formName, parentKey, initialKey,
  locked = false, lockReason, onFullKeyChange, autoApply = true, placeholder,
  sourceTable, sourceRecordId, compact = false,
}: KeyRegistryFieldProps) {
  const [value, setValue] = useState<string>(() => {
    if (!initialKey) return ''
    // If the passed key is already namespaced keep it; otherwise namespace it.
    if (initialKey.includes('.')) return initialKey
    const s = suggestKey({ title: initialKey, entityType, module, parentKey })
    // Reuse the raw key as the semantic segment without transliterating it again.
    return `${s.key.split('.').slice(0, -1).join('.')}.${initialKey}`
  })
  const [manuallyEdited, setManuallyEdited] = useState(!!initialKey)
  const [check, setCheck] = useState<CheckState>({ kind: 'free' })
  const [alternatives, setAlternatives] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef(title)
  titleRef.current = title

  // Suggest when the title changes, unless the admin has hand-edited the key.
  useEffect(() => {
    if (locked) return
    if (manuallyEdited) return
    if (!title) {
      setValue('')
      onFullKeyChange('')
      return
    }
    const s = suggestKey({ title, entityType, module, parentKey })
    setAlternatives(s.alternatives)
    setValue((prev) => {
      const next = s.key
      if (prev && prev === next) return prev
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, entityType, module, parentKey, locked])

  // Mirror to parent (either continuously or on blur).
  const emit = (next: string) => { if (autoApply || next) onFullKeyChange(next) }
  useEffect(() => { if (value) emit(value) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced uniqueness check.
  useEffect(() => {
    if (locked || !value) {
      setCheck(value ? { kind: 'free' } : { kind: 'free' })
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setCheck({ kind: 'checking' })
    timer.current = setTimeout(async () => {
      if (!isValidKeyPattern(value)) { setCheck({ kind: 'invalid' }); return }
      try {
        const existing = await checkRegistryKey(value)
        if (!existing) setCheck({ kind: 'free' })
        else if (sourceTable && sourceRecordId
               && existing.source_table === sourceTable
               && existing.source_record_id === sourceRecordId) {
          // This field's own seeded registry row — not a conflict.
          setCheck({ kind: 'free' })
        }
        else setCheck({ kind: 'duplicate', record: existing })
      } catch (err) {
        setCheck({ kind: 'error', message: err instanceof Error ? err.message : 'بررسی ناموفق بود.' })
      }
    }, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value, locked])

  const update = (next: string) => {
    // Strip invalid chars / spaces live.
    const cleaned = next.toLowerCase().replace(/[^a-z0-9._]+/g, '_')
    setManuallyEdited(true)
    setValue(cleaned)
  }

  const regenerate = async () => {
    // Cycle through semantic alternatives (no `_2` unless exhausted).
    const base = suggestKey({ title: titleRef.current || value, entityType, module, parentKey })
    const pool = [base.key, ...alternatives]
    for (const candidate of pool) {
      if (candidate === value) continue
      try {
        const existing = await checkRegistryKey(candidate)
        setManuallyEdited(true)
        setValue(candidate)
        if (!existing) { toast.success(`کلید پیشنهادی: ${candidate}`); return }
      } catch { /* keep searching */ }
    }
    toast.info('پیشنهاد معنایی دیگری موجود نیست; میتوانید پسوند عددی را خودتان اضافه کنید.')
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success('کلید کپی شد.') }
    catch { toast.error('کپی ناموفق بود.') }
  }

  const statusColor = locked ? 'text-zinc-400' : check.kind === 'free' ? 'text-emerald-600' : check.kind === 'duplicate' ? 'text-red-600' : 'text-red-600'

  if (compact) {
    return (
      <Input
        dir="ltr"
        value={value}
        onChange={(e) => update(e.target.value)}
        disabled={locked}
        placeholder={placeholder ?? 'key'}
        className="h-8 w-36 font-mono text-[11px]"
        title={value}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Input
          dir="ltr"
          value={value}
          onChange={(e) => update(e.target.value)}
          disabled={locked}
          placeholder={placeholder ?? 'company_profile.field.suggested_key'}
          className="h-10 font-mono text-[12px]"
          data-keyregistry
        />
        {!locked && (
          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 gap-1 text-[11px]" onClick={() => void regenerate()} title="پیشنهاد دیگر">
            <RefreshCw className="h-3.5 w-3.5" />پیشنهاد دیگر
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-10 w-9 shrink-0 p-0 text-zinc-500" onClick={() => void copy()} title="کپی کلید"><Copy className="h-4 w-4" /></Button>
      </div>

      {/* Status + hint */}
      <div className="flex min-h-[18px] items-center gap-1.5 text-[11px]">
        {lockReason || locked ? (
          <span className="flex items-center gap-1 text-zinc-500"><Lock className="h-3 w-3" />{lockReason ?? 'کلید قفل شده است.'}</span>
        ) : check.kind === 'checking' ? (
          <span className="flex items-center gap-1 text-zinc-400"><Loader2 className="h-3 w-3 animate-spin" />در حال بررسی یکتایی…</span>
        ) : check.kind === 'free' ? (
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" />کلید آزاد است</span>
        ) : check.kind === 'invalid' ? (
          <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" />قالب کلید نامعتبر است (فقط حروف کوچک l، عدد و «_» یا «.»)</span>
        ) : check.kind === 'duplicate' ? (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="h-3 w-3" />
            کلید تکراری است — «{check.record.title_fa || '-'}» ({check.record.module} · {check.record.status})
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600"><TriangleAlert className="h-3 w-3" />{check.message}</span>
        )}
      </div>
      <p className="text-[10px] leading-5 text-zinc-400">{KEY_FORMAT_HINT}</p>
    </div>
  )
}

export type { CheckState, SystemKeyRecord, KeyStatus }