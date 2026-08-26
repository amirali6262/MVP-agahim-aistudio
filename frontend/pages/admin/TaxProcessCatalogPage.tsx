import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  FileText,
  GitBranch,
  Landmark,
  Layers,
  Loader2,
  RefreshCw,
  Scale,
  Users,
  Workflow,
} from 'lucide-react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { Button } from '../../lib/shadcn/button'

// ---------------------------------------------------------------------------
// Types (loose — mirror public schema rows)
// ---------------------------------------------------------------------------

type StageRow = {
  id: string
  workflow_code: string
  code: string
  title_fa: string
  description_fa?: string | null
  phase_code?: string | null
  step_type?: string | null
  display_order: number
  actor_role_code?: string | null
  responsible_organization?: string | null
  is_required?: boolean | null
  base_event?: string | null
  gap_value?: number | null
  gap_unit?: string | null
  user_guidance_fa?: string | null
  form_schema?: Record<string, unknown> | null
  legal_basis?: string | null
  is_active?: boolean | null
}

type TransitionRow = {
  id: string
  from_stage_code: string
  to_stage_code: string
  trigger_type?: string | null
  condition_description?: string | null
  legal_basis?: string | null
  display_order: number
  is_active?: boolean | null
}

type ActorRow = {
  id: string
  code: string
  title_fa: string
  actor_type?: string | null
  organization?: string | null
  description_fa?: string | null
  min_count?: number | null
  max_count?: number | null
  is_active?: boolean | null
}

type LegalRefRow = {
  id: string
  code: string
  title_fa: string
  source_type?: string | null
  source_number?: string | null
  article_or_section?: string | null
  relevant_text_fa?: string | null
  source_url?: string | null
  is_active?: boolean | null
}

type DocumentTypeRow = {
  id: string
  code: string
  title_fa: string
  document_type?: string | null
  category?: string | null
  description_fa?: string | null
  is_mandatory?: boolean | null
  is_active?: boolean | null
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const WORKFLOW_TITLES: Record<string, string> = {
  PIT: 'مالیات بر عملکرد — از گزارش رسیدگی تا قطعیت یا ارجاع به هیأت بدوی',
  PRIMARY_BOARD: 'رسیدگی در هیأت حل اختلاف مالیاتی بدوی',
}

const PHASE_LABELS: Record<string, string> = {
  PHASE_1: 'فاز ۱',
  PHASE_2: 'فاز ۲',
  PHASE_3: 'فاز ۳',
  PHASE_4: 'فاز ۴',
  PHASE_5: 'فاز ۵',
  PHASE_6: 'فاز ۶',
  PHASE_7: 'فاز ۷',
}

function stepTypeBadge(stepType: string | null | undefined): { label: string; cls: string } {
  switch (stepType) {
    case 'MANDATORY': return { label: 'اجباری', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' }
    case 'OPTIONAL': return { label: 'اختیاری', cls: 'bg-sky-500/10 border-sky-500/30 text-sky-300' }
    case 'CONDITIONAL': return { label: 'مشروط', cls: 'bg-violet-500/10 border-violet-500/30 text-violet-300' }
    case 'DEADLINE': return { label: 'مهلت', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' }
    case 'TERMINAL': return { label: 'پایانی', cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300' }
    case 'TRANSITION': return { label: 'نقطه خروج', cls: 'bg-rose-500/10 border-rose-500/30 text-rose-300' }
    default: return { label: stepType ?? '—', cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-300' }
  }
}

const TRIGGER_LABELS: Record<string, string> = { AUTOMATIC: 'خودکار', MANUAL: 'دستی' }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TaxProcessCatalogPage() {
  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState<StageRow[]>([])
  const [transitions, setTransitions] = useState<TransitionRow[]>([])
  const [actors, setActors] = useState<ActorRow[]>([])
  const [legalRefs, setLegalRefs] = useState<LegalRefRow[]>([])
  const [docTypes, setDocTypes] = useState<DocumentTypeRow[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        toast.error('اتصال به پایگاه‌داده برقرار نیست. داده‌های فرایندها بارگذاری نشدند.')
        setLoading(false)
        return
      }
      const [stagesRes, transitionsRes, actorsRes, refsRes, docsRes] = await Promise.all([
        (supabase as any).from('tax_objection_stages').select('*').order('workflow_code').order('display_order'),
        (supabase as any).from('tax_stage_transitions').select('*').order('display_order'),
        (supabase as any).from('tax_actors').select('*').order('code'),
        (supabase as any).from('tax_legal_references').select('*').order('code'),
        (supabase as any).from('tax_document_types').select('*').order('code'),
      ])
      setStages((stagesRes.data ?? []) as StageRow[])
      setTransitions((transitionsRes.data ?? []) as TransitionRow[])
      setActors((actorsRes.data ?? []) as ActorRow[])
      setLegalRefs((refsRes.data ?? []) as LegalRefRow[])
      setDocTypes((docsRes.data ?? []) as DocumentTypeRow[])
    } catch {
      toast.error('بارگذاری فرایندها با خطا متوقف شد. وضعیت پایگاه‌داده را بررسی کنید.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const workflows = useMemo(() => {
    const map = new Map<string, StageRow[]>()
    for (const stage of stages) {
      const key = stage.workflow_code
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(stage)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [stages])

  const toggleActive = async (table: 'tax_objection_stages' | 'tax_stage_transitions', id: string, next: boolean) => {
    if (!isSupabaseConfigured) {
      toast.error('اتصال به پایگاه‌داده برقرار نیست.')
      return
    }
    setTogglingId(id)
    const { error } = await (supabase as any).from(table).update({ is_active: next }).eq('id', id)
    setTogglingId(null)
    if (error) {
      toast.error('تغییر وضعیت انجام نشد. سیاست‌های امنیتی پایگاه‌داده اعمال شده است.')
      return
    }
    if (table === 'tax_objection_stages') {
      setStages((current) => current.map((row) => (row.id === id ? { ...row, is_active: next } : row)))
    } else {
      setTransitions((current) => current.map((row) => (row.id === id ? { ...row, is_active: next } : row)))
    }
    toast.success(next ? 'مرحله فعال شد.' : 'مرحله غیرفعال شد.')
  }

  if (loading) {
    return <div className="flex justify-center p-24 text-zinc-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
  }

  const stageCount = stages.length
  const transitionCount = transitions.length

  return (
    <main className="p-6 text-zinc-100" dir="rtl">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-[#29231d] via-[#211d1a] to-[#151311] p-6 shadow-2xl sm:p-8">
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
              <Scale className="h-3.5 w-3.5" />
              کاتالوگ فرایندهای دادرسی مالیاتی
            </div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">فرایندهای دادرسی مالیاتی</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-300">
              تعریف رسمی فرایندهای مالیات بر عملکرد و هیأت حل اختلاف مالیاتی بدوی — مراحل، انتقال‌ها،
              اقدام‌کنندگان و منابع قانونی ثبت‌شده در پایگاه‌داده.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300"
          >
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </button>
        </div>
      </section>

      {/* ── Summary cards ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Workflow} label="فرایندهای تعریف‌شده" value={workflows.length.toString()} color="text-amber-400" bg="bg-amber-950/30 border-amber-800/40" />
        <SummaryCard icon={Layers} label="مراحل" value={stageCount.toString()} color="text-sky-300" bg="bg-sky-950/20 border-sky-800/30" />
        <SummaryCard icon={GitBranch} label="انتقال‌ها" value={transitionCount.toString()} color="text-emerald-300" bg="bg-emerald-950/20 border-emerald-800/30" />
        <SummaryCard icon={Landmark} label="منابع قانونی" value={legalRefs.length.toString()} color="text-violet-300" bg="bg-violet-950/20 border-violet-800/30" />
      </div>

      {/* ── Workflow timelines ── */}
      {workflows.map(([workflowCode, rows]) => {
        const phases = new Map<string, StageRow[]>()
        for (const row of rows) {
          const phase = row.phase_code ?? 'PHASE_1'
          if (!phases.has(phase)) phases.set(phase, [])
          phases.get(phase)!.push(row)
        }
        return (
          <section key={workflowCode} className="mt-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Workflow className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">{WORKFLOW_TITLES[workflowCode] ?? workflowCode}</h3>
                <p className="text-xs text-zinc-500 mt-0.5" dir="ltr">{workflowCode} · {rows.length} مرحله</p>
              </div>
            </div>

            {Array.from(phases.entries()).map(([phase, phaseRows]) => (
              <div key={phase} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-300">
                    {PHASE_LABELS[phase] ?? phase}
                  </span>
                  <span className="h-px flex-1 bg-zinc-800" />
                </div>
                <div className="space-y-3">
                  {phaseRows.map((stage) => {
                    const badge = stepTypeBadge(stage.step_type)
                    return (
                      <div key={stage.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-3">
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${badge.cls}`}>
                              {stage.display_order}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-zinc-100">{stage.title_fa}</h4>
                                <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400" dir="ltr">{stage.code}</span>
                                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                                {stage.is_active === false && (
                                  <span className="rounded border border-red-900/60 bg-red-950/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">غیرفعال</span>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-6 text-zinc-400">{stage.description_fa}</p>
                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-500">
                                {stage.actor_role_code && (
                                  <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />{stage.actor_role_code}</span>
                                )}
                                {stage.responsible_organization && (
                                  <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{stage.responsible_organization}</span>
                                )}
                                {(stage.gap_value ?? 0) > 0 && (
                                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" />مهلت: {stage.gap_value} {stage.gap_unit}</span>
                                )}
                                {stage.legal_basis && (
                                  <span className="flex items-center gap-1.5"><BookOpenCheck className="h-3 w-3" />{stage.legal_basis}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={togglingId === stage.id}
                            onClick={() => void toggleActive('tax_objection_stages', stage.id, !stage.is_active)}
                            className="shrink-0 border-zinc-700 text-xs text-zinc-300 hover:border-amber-500/60 hover:text-amber-300"
                          >
                            {stage.is_active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )
      })}

      {/* ── Transitions ── */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <GitBranch className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">انتقال‌های فرایند</h3>
            <p className="text-xs text-zinc-500 mt-0.5">شرط و محرک هر انتقال بین مراحل</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-zinc-400">
                <th className="p-3 font-semibold">از مرحله</th>
                <th className="p-3 font-semibold">به مرحله</th>
                <th className="p-3 font-semibold">محرک</th>
                <th className="p-3 font-semibold">شرط</th>
                <th className="p-3 font-semibold">مبنای قانونی</th>
                <th className="p-3 font-semibold">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((transition) => (
                <tr key={transition.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="p-3 font-mono text-zinc-300" dir="ltr">{transition.from_stage_code}</td>
                  <td className="p-3 font-mono text-amber-300" dir="ltr">{transition.to_stage_code}</td>
                  <td className="p-3">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${transition.trigger_type === 'AUTOMATIC' ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300' : 'border-sky-800/60 bg-sky-950/30 text-sky-300'}`}>
                      {TRIGGER_LABELS[transition.trigger_type ?? ''] ?? transition.trigger_type ?? '—'}
                    </span>
                  </td>
                  <td className="p-3 text-zinc-400">{transition.condition_description}</td>
                  <td className="p-3 text-zinc-500">{transition.legal_basis}</td>
                  <td className="p-3">
                    <button
                      disabled={togglingId === transition.id}
                      onClick={() => void toggleActive('tax_stage_transitions', transition.id, !transition.is_active)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${transition.is_active === false ? 'border-red-900/60 text-red-400 hover:bg-red-950/30' : 'border-zinc-700 text-zinc-400 hover:border-amber-500/60 hover:text-amber-300'}`}
                    >
                      {transition.is_active === false ? 'غیرفعال — فعال‌سازی' : 'فعال — غیرفعال‌سازی'}
                    </button>
                  </td>
                </tr>
              ))}
              {transitions.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">انتقالی ثبت نشده است.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Actors ── */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30">
            <Users className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">اقدام‌کنندگان و نقش‌ها</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{actors.length} نقش تعریف‌شده</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actors.map((actor) => (
            <div key={actor.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-zinc-100">{actor.title_fa}</h4>
                <span className="font-mono text-[10px] text-zinc-500" dir="ltr">{actor.code}</span>
              </div>
              {actor.organization && <p className="mt-1 text-[11px] text-sky-300/80">{actor.organization}</p>}
              {actor.description_fa && <p className="mt-2 text-xs leading-6 text-zinc-400">{actor.description_fa}</p>}
              {actor.min_count != null && (
                <p className="mt-2 text-[11px] text-zinc-500">تعداد: {actor.min_count}{actor.max_count && actor.max_count !== actor.min_count ? ` تا ${actor.max_count}` : ''}</p>
              )}
            </div>
          ))}
          {actors.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">نقشی ثبت نشده است.</p>}
        </div>
      </section>

      {/* ── Legal references ── */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/30">
            <Landmark className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">منابع قانونی</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{legalRefs.length} منبع ثبت‌شده</p>
          </div>
        </div>
        <div className="space-y-2">
          {legalRefs.map((ref) => (
            <div key={ref.id} className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-100">{ref.title_fa}</h4>
                  <span className="font-mono text-[10px] text-zinc-500" dir="ltr">{ref.code}</span>
                </div>
                {ref.relevant_text_fa && <p className="mt-0.5 text-xs text-zinc-400">{ref.relevant_text_fa}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px] text-zinc-500">
                <span>{ref.source_number ?? ref.source_type ?? '—'}</span>
                {ref.source_url && (
                  <a href={ref.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-300 hover:text-violet-200">
                    <ArrowLeft className="h-3 w-3" />منبع
                  </a>
                )}
              </div>
            </div>
          ))}
          {legalRefs.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">منبعی ثبت نشده است.</p>}
        </div>
      </section>

      {/* ── Document types ── */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#141615] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30">
            <FileText className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">انواع اسناد</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{docTypes.length} نوع سند تعریف‌شده</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-zinc-400">
                <th className="p-3 font-semibold">عنوان</th>
                <th className="p-3 font-semibold">کد</th>
                <th className="p-3 font-semibold">دسته</th>
                <th className="p-3 font-semibold">الزامی</th>
              </tr>
            </thead>
            <tbody>
              {docTypes.map((doc) => (
                <tr key={doc.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40">
                  <td className="p-3 text-zinc-200">{doc.title_fa}</td>
                  <td className="p-3 font-mono text-zinc-500" dir="ltr">{doc.code}</td>
                  <td className="p-3 text-zinc-400">{doc.category ?? '—'}</td>
                  <td className="p-3">{doc.is_mandatory ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <span className="text-zinc-600">—</span>}</td>
                </tr>
              ))}
              {docTypes.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">نوع سندی ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({ icon: Icon, label, value, color, bg }: { icon: typeof Workflow; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-2xl border ${bg} p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="mt-3 text-2xl font-bold text-white font-mono">{value}</div>
    </div>
  )
}
