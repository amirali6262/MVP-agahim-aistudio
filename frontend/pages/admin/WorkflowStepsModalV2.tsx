import { ArrowRight, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import type { Tables } from '../../lib/database.types'
import WorkflowStepFormV2 from './WorkflowStepFormV2'

type Version = Tables<'obligation_versions'> | any
type WorkflowStep = Tables<'workflow_steps'> | any
type WorkflowTransition = Tables<'workflow_transitions'>
type StudioMode = 'LIST' | 'VIEW' | 'EDIT'

type Dependency = { formName: string; details: string; iconType?: 'extension' | 'penalty' | 'workflow' | 'template' | 'obligation' }

export default function WorkflowStepsModalV2({
  item,
  version,
  steps,
  transitions,
  editingStep,
  setEditingStep,
  onDeleteStep,
  onSeed,
  busy,
  mode,
  onClose,
  onSaved,
}: {
  item: { obligation: { title: string } }
  version: Version
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  editingStep: WorkflowStep | null
  setEditingStep: (step: WorkflowStep | null) => void
  onDeleteStep: (step: WorkflowStep, dependencies: Dependency[]) => void
  onSeed: () => Promise<void>
  busy: boolean
  mode: StudioMode
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0b0d0c] p-4 text-zinc-100 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-0 z-20 mb-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-[#101211]/95 p-3 backdrop-blur">
          <Button variant="ghost" className="gap-2" onClick={onClose}><ArrowRight className="h-4 w-4" />بازگشت</Button>
          <h2 className="font-black">مراحل فرایند اجرایی: {item.obligation.title}</h2>
        </div>

        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl">
            <div className="flex flex-col gap-2 border-b border-zinc-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold"><ListChecks className="h-5 w-5 text-sky-400" />مدیریت مراحل فرایند اجرایی ({steps.length} مرحله)</h3>
                <p className="mt-1 text-xs text-zinc-400">گام‌های متوالی، مسئول هر اقدام، راهنما و چندین فیلد اطلاعاتی ورودی</p>
              </div>
              {steps.length === 0 && <Button size="sm" variant="outline" className="gap-1 border-sky-700/60 text-xs text-sky-300 hover:bg-sky-950/40" onClick={() => void onSeed()} disabled={busy}><Plus className="h-3.5 w-3.5" />درج مراحل استاندارد</Button>}
            </div>

            <div className="mt-6 space-y-3">
              {steps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">هنوز مرحله‌ای تعریف نشده است. گام اول را اضافه کنید.</div>
              ) : steps.map((step, index) => (
                <div key={step.id ?? index} className="space-y-2.5 rounded-xl border border-zinc-700/80 bg-[#1b1e1c] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-700/70 bg-amber-950/50 text-xs font-black text-amber-300">{step.sequence}</span>
                      <div>
                        <p className="pt-1 text-sm font-semibold text-zinc-100">{String(step.title ?? '').replace(/^\d+\.\s*/, '')}</p>
                        <div className="mt-1 flex items-center gap-2"><span className="font-mono text-[10px] text-zinc-500">{step.code}</span><span className="rounded-full border border-sky-800 bg-sky-950/60 px-2 py-0.5 text-[10px] text-sky-300">{step.actor}</span></div>
                      </div>
                    </div>
                    {mode === 'EDIT' && version.status === 'DRAFT' && <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-sky-300" title="ویرایش مرحله" onClick={() => { setEditingStep(step); document.getElementById('workflow-step-editor-v2')?.scrollIntoView({ behavior: 'smooth' }) }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400" title="حذف مرحله" onClick={() => {
                        const dependencies = transitions
                          .filter((transition) => transition.from_step_id === step.id || transition.to_step_id === step.id)
                          .map((transition) => ({ formName: transition.title || 'مسیر انتقال', details: `اتصال خروجی ${transition.outcome_code}`, iconType: 'workflow' as const }))
                        onDeleteStep(step, dependencies)
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>}
                  </div>
                  {step.instructions && <p className="text-xs leading-5 text-zinc-400">{step.instructions}</p>}
                  {Array.isArray(step.form_schema?.fields) && step.form_schema.fields.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{step.form_schema.fields.map((field: any, fieldIndex: number) => <span key={field.key ?? fieldIndex} className="rounded border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-300">فیلد: {field.label || field.key} ({field.type || 'text'}){field.required === false ? ' · اختیاری' : ''}</span>)}</div>}
                </div>
              ))}
            </div>

            {mode === 'EDIT' && version.status === 'DRAFT' && <div id="workflow-step-editor-v2" className="mt-6 border-t border-zinc-800 pt-4">
              <WorkflowStepFormV2
                version={version}
                nextSequence={steps.length + 1}
                editingStep={editingStep}
                onCancelEdit={() => setEditingStep(null)}
                onSaved={async () => { setEditingStep(null); await onSaved() }}
              />
            </div>}

            <div className="mt-6 flex justify-end border-t border-zinc-800 pt-3"><Button variant="outline" onClick={onClose}>بستن و بازگشت به صفحه تعهد</Button></div>
          </section>
        </div>
      </div>
    </div>
  )
}
