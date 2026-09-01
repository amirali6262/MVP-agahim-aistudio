import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import {
  fetchRuleCenterRule,
  fetchRuleTests,
  fetchRuleUsage,
  type RuleCenterConnection,
  type RuleCenterTestRow,
  type RuleCenterVersion,
} from '../../../lib/ruleCenter'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  IN_REVIEW: 'در بررسی',
  APPROVED: 'تأییدشده',
  PUBLISHED: 'منتشرشده',
  STOPPED: 'متوقف برای استفاده جدید',
}

export default function RuleDetailModal({
  ruleId,
  initialVersionId,
  onClose,
  onEditDraft,
}: {
  ruleId: string
  initialVersionId?: string
  onClose: () => void
  onEditDraft: (versionId: string) => void
}) {
  const [rule, setRule] = useState<Awaited<ReturnType<typeof fetchRuleCenterRule>>>(null)
  const [versionId, setVersionId] = useState<string | undefined>(initialVersionId)
  const [usage, setUsage] = useState<RuleCenterConnection[]>([])
  const [tests, setTests] = useState<RuleCenterTestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const [r] = await Promise.all([fetchRuleCenterRule(ruleId)])
        setRule(r)
        if (!versionId && r?.versions?.length) setVersionId(r.versions[r.versions.length - 1].id)
      } catch (e: any) {
        setError(e?.message ?? 'خطا در دریافت قاعده')
      } finally {
        setLoading(false)
      }
    })()
  }, [ruleId])

  useEffect(() => {
    if (!versionId) return
    void (async () => {
      const [u, t] = await Promise.all([fetchRuleUsage(versionId), fetchRuleTests(versionId)])
      setUsage(u)
      setTests(t)
    })()
  }, [versionId])

  const version: RuleCenterVersion | undefined = rule?.versions.find((v) => v.id === versionId)
  const versions = [...(rule?.versions ?? [])].sort((a, b) => b.version_number - a.version_number)

  if (loading) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
        <div className="flex items-center gap-2 text-zinc-300"><Loader2 className="h-5 w-5 animate-spin" />در حال بارگذاری…</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#121412] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{rule?.title_fa}</h3>
            <p className="mt-1 text-xs text-zinc-400 ltr" dir="ltr">{rule?.code}</p>
            <p className="mt-1 text-xs text-zinc-500">{rule?.summary || ''}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr,1.2fr]">
          {/* مشخصات + نسخه‌ها */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4 text-xs leading-6 text-zinc-400">
              <p><span className="font-bold text-zinc-300">ماهیت:</span> {rule?.nature === 'LEGAL' ? 'قانونی' : 'هدف داخلی'}</p>
              <p><span className="font-bold text-zinc-300">حوزه:</span> {rule?.domain || '—'}</p>
              <p><span className="font-bold text-zinc-300">مرجع:</span> {rule?.authority || '—'}</p>
              <p><span className="font-bold text-zinc-300">منبع قانونی:</span> {rule?.legal_source ? `${rule.legal_source}${rule.legal_clause ? ` — بند ${rule.legal_clause}` : ''}` : '—'}</p>
              <p><span className="font-bold text-zinc-300">بازه اعتبار:</span> {rule?.valid_from ? `${rule.valid_from} تا ${rule.valid_to ?? 'باز'}` : 'نامحدود'}</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
              <h4 className="mb-3 text-sm font-bold text-zinc-200">نسخه‌ها</h4>
              <div className="space-y-1.5">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVersionId(v.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${versionId === v.id ? 'border-amber-600/60 bg-amber-950/20' : 'border-zinc-800 bg-[#141615] hover:border-zinc-600'}`}
                  >
                    <span className="font-bold text-zinc-200">نسخه {v.version_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.status === 'PUBLISHED' ? 'bg-emerald-950 text-emerald-300' : v.status === 'STOPPED' ? 'bg-zinc-800 text-zinc-400' : v.status === 'APPROVED' ? 'bg-sky-950 text-sky-300' : v.status === 'IN_REVIEW' ? 'bg-amber-950 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                      {STATUS_LABEL[v.status]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {version && (
              <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
                <h4 className="mb-3 text-sm font-bold text-zinc-200">تاریخ تأیید و انتشار</h4>
                <div className="space-y-1 text-[11px] text-zinc-400">
                  <p>تأیید فنی: {version.technical_approved_at ? new Date(version.technical_approved_at).toLocaleString('fa-IR') : '—'}</p>
                  <p>تأیید تخصصی: {version.expert_approved_at ? new Date(version.expert_approved_at).toLocaleString('fa-IR') : '—'}</p>
                  <p>انتشار: {version.published_at ? new Date(version.published_at).toLocaleString('fa-IR') : '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* تعریف + آزمون‌ها + استفاده */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
              <h4 className="mb-3 text-sm font-bold text-zinc-200">تعریف ساختاریافته (نسخه {version?.version_number})</h4>
              <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-[#101211] p-3 text-[10px] leading-5 text-zinc-400">
                {JSON.stringify(version?.definition ?? {}, null, 2)}
              </pre>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
              <h4 className="mb-3 text-sm font-bold text-zinc-200">ورودی‌های قاعده</h4>
              {!version || version.inputs.length === 0 ? (
                <p className="text-xs text-zinc-500">ورودی تعریف نشده است.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {version.inputs.map((i) => (
                    <li key={i.key} className="flex items-center justify-between rounded-lg bg-[#141615] px-3 py-1.5">
                      <span className="text-zinc-300">{i.label}</span>
                      <span className="text-[11px] text-zinc-500 ltr" dir="ltr">{i.key} · {i.type}{i.required ? ' · الزامی' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
              <h4 className="mb-3 text-sm font-bold text-zinc-200">آزمون‌های نسخه {version?.version_number}</h4>
              {tests.length === 0 ? (
                <p className="text-xs text-zinc-500">آزمونی ثبت نشده است.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tests.map((t) => (
                    <li key={t.id} className="flex items-center justify-between rounded-lg bg-[#141615] px-3 py-2 text-xs">
                      <span className="text-zinc-300">{t.title}</span>
                      <span className={`flex items-center gap-1 font-bold ${t.status === 'PASS' ? 'text-emerald-400' : t.status === 'FAIL' ? 'text-red-400' : 'text-amber-400'}`}>
                        {t.status === 'PASS' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        {t.status === 'PASS' ? 'موفق' : t.status === 'FAIL' ? 'ناموفق' : 'در انتظار'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#1d1a18] p-4">
              <h4 className="mb-3 text-sm font-bold text-zinc-200">محل‌های استفاده (نسخه {version?.version_number})</h4>
              {usage.length === 0 ? (
                <p className="text-xs text-zinc-500">استفاده‌ای ثبت نشده است.</p>
              ) : (
                <ul className="space-y-1.5">
                  {usage.map((u) => (
                    <li key={u.id} className="flex items-center justify-between rounded-lg bg-[#141615] px-3 py-2 text-xs">
                      <span className="text-zinc-300">
                        {u.target_type === 'OBLIGATION_VERSION' ? (u.obligation_title ?? 'تعهد') : `${u.template_title ?? 'الگو'} — ${u.step_title ?? 'اقدام'}`}
                      </span>
                      <span className={`text-[11px] ${u.status === 'ACTIVE' ? 'text-emerald-400' : u.status === 'HISTORY' ? 'text-zinc-500' : 'text-amber-400'}`}>
                        {u.status === 'ACTIVE' ? 'فعال' : u.status === 'HISTORY' ? 'تاریخچه' : 'پیش‌نویس'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {version?.status === 'DRAFT' && (
              <Button variant="outline" className="w-full border-amber-800 text-amber-300 gap-1.5 text-xs" onClick={() => onEditDraft(version.id)}>
                <Pencil className="h-3.5 w-3.5" /> ویرایش پیش‌نویس
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-zinc-800 pt-4">
          <Button variant="outline" onClick={onClose}>بستن</Button>
        </div>
      </div>
    </div>
  )
}
