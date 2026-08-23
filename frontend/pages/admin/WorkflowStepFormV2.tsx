import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { mockStudioDb } from '../../lib/mockDb'
import type { Json, Tables } from '../../lib/database.types'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Switch } from '../../lib/shadcn/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'

type Version = Tables<'obligation_versions'> | any
type WorkflowStep = Tables<'workflow_steps'> | any

type WorkflowFieldDraft = {
  id: string
  label: string
  key: string
  type: string
  required: boolean
}

function createField(): WorkflowFieldDraft {
  return {
    id: `workflow-field-${Date.now()}-${Math.random()}`,
    label: '',
    key: '',
    type: 'text',
    required: true,
  }
}

function normalizeFieldKey(value: string) {
  return value
    .toLowerCase()
    .trimStart()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
}

function normalizeStepCode(value: string) {
  return value
    .toUpperCase()
    .trimStart()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
}

function isValidStepCode(value: string) {
  return value.length <= 80 && /^[A-Z][A-Z0-9_]{1,}$/.test(value)
}

function isValidFieldKey(value: string) {
  return value.length <= 80 && /^[a-z][a-z0-9_]*$/.test(value)
}

function mutationError(error: unknown, fallback: string) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback
  if (code === '23505' || message.includes('duplicate key')) return 'این کد قبلاً ثبت شده است؛ یک کد یکتا انتخاب کنید.'
  return message
}

function readFields(step: WorkflowStep | null): WorkflowFieldDraft[] {
  const rawFields = step?.form_schema?.fields
  if (!Array.isArray(rawFields)) return [createField()]

  const fields = rawFields.flatMap((field: unknown) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) return []
    const value = field as Record<string, unknown>
    return [{
      id: `workflow-field-${Date.now()}-${Math.random()}`,
      label: typeof value.label === 'string' ? value.label : '',
      key: typeof value.key === 'string' ? value.key : '',
      type: typeof value.type === 'string' ? value.type : 'text',
      required: value.required !== false,
    }]
  })

  return fields.length > 0 ? fields : [createField()]
}

export default function WorkflowStepFormV2({
  version,
  nextSequence,
  editingStep,
  onCancelEdit,
  onSaved,
}: {
  version: Version
  nextSequence: number
  editingStep?: WorkflowStep | null
  onCancelEdit?: () => void
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [sequence, setSequence] = useState(nextSequence)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [actor, setActor] = useState('USER')
  const [instructions, setInstructions] = useState('')
  const [fields, setFields] = useState<WorkflowFieldDraft[]>([createField()])

  useEffect(() => {
    if (!editingStep) {
      setSequence(nextSequence)
      return
    }

    setOpen(true)
    setSequence(editingStep.sequence ?? nextSequence)
    setTitle(typeof editingStep.title === 'string' ? editingStep.title.replace(/^\d+\.\s*/, '') : '')
    setCode(typeof editingStep.code === 'string' ? editingStep.code : '')
    setActor(typeof editingStep.actor === 'string' ? editingStep.actor : 'USER')
    setInstructions(typeof editingStep.instructions === 'string' ? editingStep.instructions : '')
    setFields(readFields(editingStep))
  }, [editingStep, nextSequence])

  const resetForm = () => {
    setOpen(false)
    setSequence(nextSequence)
    setTitle('')
    setCode('')
    setActor('USER')
    setInstructions('')
    setFields([createField()])
  }

  const handleCancel = () => {
    if (!window.confirm('تغییرات مرحله ذخیره نشده است. خارج می‌شوید؟')) return
    resetForm()
    onCancelEdit?.()
  }

  const updateField = (id: string, patch: Partial<WorkflowFieldDraft>) => {
    setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field))
  }

  const save = async () => {
    const normalizedCode = normalizeStepCode(code)
    if (!title.trim() || !code.trim()) {
      toast.error('عنوان و کد مرحله الزامی است.')
      return
    }
    if (!isValidStepCode(normalizedCode)) {
      toast.error('کد مرحله باید حداقل ۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.')
      return
    }

    const enteredFields = fields.filter((field) => field.label.trim() || field.key.trim())
    const formFields: Json[] = []
    const keys = new Set<string>()
    for (const field of enteredFields) {
      const label = field.label.trim()
      const key = normalizeFieldKey(field.key)
      if (!label || !key) {
        toast.error('برای هر فیلد، عنوان و کلید انگلیسی را کامل کنید.')
        return
      }
      if (!isValidFieldKey(key)) {
        toast.error('کلید فیلد باید با حرف انگلیسی شروع شود و فقط شامل حروف انگلیسی، عدد و زیرخط باشد.')
        return
      }
      if (keys.has(key)) {
        toast.error(`کلید فیلد «${key}» تکراری است.`)
        return
      }
      keys.add(key)
      formFields.push({ key, label, type: field.type, required: field.required })
    }

    const currentSequence = sequence > 0 ? sequence : nextSequence
    const stepPayload = {
      sequence: currentSequence,
      code: normalizedCode,
      title: title.trim(),
      actor,
      instructions: instructions.trim() || null,
      form_schema: { fields: formFields } as Json,
    }

    try {
      if (editingStep) {
        if (!isSupabaseConfigured) {
          mockStudioDb.updateWorkflowStep(editingStep.id, stepPayload)
        } else {
          const { error } = await supabase.from('workflow_steps').update(stepPayload as any).eq('id', editingStep.id)
          if (error) throw error
        }
        toast.success(`مرحله «${title.trim()}» با موفقیت ویرایش شد.`)
      } else if (!isSupabaseConfigured) {
        mockStudioDb.addWorkflowStep({
          obligation_version_id: version.id,
          ...stepPayload,
          instructions: instructions.trim() || undefined,
        })
        toast.success('مرحله ثبت شد.')
      } else {
        const templateResult = await supabase
          .from('workflow_templates')
          .select('*')
          .eq('obligation_version_id', version.id)
          .maybeSingle()
        if (templateResult.error) throw templateResult.error

        let template = templateResult.data
        if (!template) {
          const created = await supabase
            .from('workflow_templates')
            .insert({ obligation_version_id: version.id, title: 'فرایند ' + version.version_number })
            .select()
            .single()
          if (created.error) throw created.error
          if (!created.data) throw new Error('قالب فرایند ایجاد نشد.')
          template = created.data
        }

        const { error } = await supabase.from('workflow_steps').insert({
          workflow_template_id: template.id,
          ...stepPayload,
        } as any)
        if (error) throw error
        toast.success('مرحله ثبت شد.')
      }

      resetForm()
      onCancelEdit?.()
      await onSaved()
    } catch (error) {
      toast.error(mutationError(error, editingStep ? 'ویرایش مرحله انجام نشد.' : 'ثبت مرحله انجام نشد.'))
    }
  }

  if (!open && !editingStep) {
    return (
      <Button variant="outline" className="mt-4 w-full border-zinc-700 gap-2" onClick={() => { setOpen(true); setFields([createField()]) }}>
        <Plus className="h-4 w-4" />افزودن مرحله جدید
      </Button>
    )
  }

  return (
    <div data-studio-dirty="true" className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-[#161817] p-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <p className="text-sm font-bold text-amber-300">{editingStep ? `ویرایش مرحله فرایند (${editingStep.title})` : 'افزودن مرحله فرایند جدید'}</p>
        {editingStep && <span className="rounded border border-amber-800/60 bg-amber-950/70 px-2 py-0.5 text-xs text-amber-300">حالت ویرایش</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-3"><Field label="عنوان مرحله"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="بارگذاری اظهارنامه در سامانه" /></Field></div>
        <Field label="ترتیب گام"><Input type="number" min={1} value={sequence} onChange={(event) => setSequence(Number(event.target.value))} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="کد انگلیسی یکتا"><Input value={code} onChange={(event) => setCode(normalizeStepCode(event.target.value))} dir="ltr" maxLength={80} placeholder="SUBMIT_RETURN" /></Field>
        <Field label="مسئول انجام">
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">کاربر شرکت</SelectItem>
              <SelectItem value="PLATFORM_ADMIN">مدیر پلتفرم</SelectItem>
              <SelectItem value="AUTHORITY">مرجع قانونی / ثبت توسط مدیر</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="راهنمای انجام برای کاربر (اختیاری)"><Input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="مثال: ورود به درگاه ملی خدمات مالیاتی و بارگذاری فایل تراز آزمایشی..." /></Field>

      <div className="rounded-lg border border-zinc-800 bg-[#121413] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">فیلدهای ورودی فرم برای این مرحله (اختیاری)</p>
          <span className="text-[11px] text-zinc-500">{fields.length} فیلد</span>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border border-zinc-800 bg-[#161817] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-zinc-300">فیلد {index + 1}</p>
                {fields.length > 1 && <Button type="button" variant="ghost" className="h-7 gap-1 px-2 text-xs text-red-400 hover:bg-red-950/30 hover:text-red-300" onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}><Trash2 className="h-3.5 w-3.5" />حذف</Button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="عنوان فیلد"><Input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} placeholder="کد رهگیری اظهارنامه" /></Field>
                <Field label="کلید انگلیسی"><Input value={field.key} onChange={(event) => updateField(field.id, { key: normalizeFieldKey(event.target.value) })} dir="ltr" placeholder="tracking_code" /></Field>
                <Field label="نوع فیلد">
                  <Select value={field.type} onValueChange={(value) => updateField(field.id, { type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">متن (Text)</SelectItem>
                      <SelectItem value="number">عدد (Number)</SelectItem>
                      <SelectItem value="date">تاریخ (Date)</SelectItem>
                      <SelectItem value="checkbox">تأیید / بله‌خیر (Boolean)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Switch id={`required-${field.id}`} checked={field.required} onCheckedChange={(checked) => updateField(field.id, { required: checked })} />
                <Label htmlFor={`required-${field.id}`} className="text-xs text-zinc-400">این فیلد اجباری است</Label>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="mt-3 w-full gap-1 border-zinc-700 text-xs" onClick={() => setFields((current) => [...current, createField()])}><Plus className="h-3.5 w-3.5" />افزودن فیلد دیگر</Button>
      </div>

      <div className="flex gap-2"><SaveButton onClick={save} /><Button variant="ghost" onClick={handleCancel}>انصراف</Button></div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function SaveButton({ onClick }: { onClick: () => Promise<void> }) {
  return <div className="flex items-end"><Button type="button" onClick={() => void onClick()} className="w-full bg-emerald-700 hover:bg-emerald-600">ذخیره</Button></div>
}
