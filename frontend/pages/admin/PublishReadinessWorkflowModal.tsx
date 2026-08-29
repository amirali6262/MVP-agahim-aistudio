import { useState } from 'react'
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  Rocket,
  Archive,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Send,
  Eye,
} from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Badge } from '../../lib/shadcn/badge'

type StudioMode = 'LIST' | 'VIEW' | 'EDIT'

type Props = {
  item: any
  version: any
  rules: any[]
  steps: any[]
  reviewRequests: any[]
  penaltySchemaReady: boolean
  busy: boolean
  mode: StudioMode
  onSeed: () => Promise<void>
  onSubmitForReview: () => Promise<void>
  onRepairReviewRequest: () => Promise<void>
  onStartReview: () => Promise<void>
  onDecideReview: (decision: 'approve' | 'reject') => Promise<void>
  onWithdrawReview: () => Promise<void>
  onPublish: () => Promise<void>
  onRetire: () => Promise<void>
  onEditVersion: () => void
  onClose: () => void
  onSaved: () => Promise<void>
}

const WORKFLOW_STEPS = [
  { key: 'DRAFT', label: 'پیش‌نویس', icon: FileText },
  { key: 'REQUESTED', label: 'ارسال به بازبینی', icon: Send },
  { key: 'IN_REVIEW', label: 'بازبینی تخصصی', icon: Eye },
  { key: 'APPROVED', label: 'تأیید نهایی', icon: CheckCircle2 },
  { key: 'TESTING', label: 'آزمایش', icon: Sparkles },
  { key: 'PUBLISHED', label: 'انتشار', icon: Rocket },
]

export default function PublishReadinessWorkflowModal({
  item,
  version,
  rules,
  steps,
  reviewRequests,
  penaltySchemaReady,
  busy,
  mode,
  onSeed,
  onSubmitForReview,
  onRepairReviewRequest,
  onStartReview,
  onDecideReview,
  onWithdrawReview,
  onPublish,
  onRetire,
  onEditVersion,
  onClose,
}: Props) {
  const [repairDialogOpen, setRepairDialogOpen] = useState(false)
  const activeRequest = reviewRequests.find((request) => ['REQUESTED', 'IN_REVIEW'].includes(request.status))
  const latestRejectedRequest = reviewRequests.find((request) => request.status === 'REJECTED')
  const latestApprovedRequest = reviewRequests.find((request) => request.status === 'APPROVED')
  const canEdit = mode === 'EDIT'

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => {
    if (version.status === 'DRAFT') return s.key === 'DRAFT'
    if (version.status === 'REVIEW' && activeRequest?.status === 'REQUESTED') return s.key === 'REQUESTED'
    if (version.status === 'REVIEW' && activeRequest?.status === 'IN_REVIEW') return s.key === 'IN_REVIEW'
    if (version.status === 'TESTING') return s.key === 'TESTING'
    if (version.status === 'PUBLISHED' || version.status === 'RETIRED') return s.key === 'PUBLISHED'
    return false
  })

  const allChecksPass = Boolean(version.effective_from) && Boolean(version.source_url) && Boolean(version.legal_reference) && rules.length > 0 && steps.length > 0 && penaltySchemaReady

  return (
    <FullScreen title={`چرخه انتشار نسخه ${version.version_number}`} onBack={onClose}>
      <div className="mx-auto max-w-5xl space-y-6" dir="rtl">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-bl from-[#141816] via-[#101211] to-[#0d100f] p-6 shadow-2xl">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 h-36 w-36 rounded-full bg-amber-500/5 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <FileText className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">
                      نسخه {version.version_number}
                    </h3>
                    <p className="text-sm text-zinc-400 line-clamp-1">{item.obligation.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusPill status={version.status} />
                  {version.effective_from && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      اثرگذاری: {version.effective_from}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canEdit && version.status === 'DRAFT' && (
                  <>
                    <Button onClick={() => void onEditVersion()} disabled={busy} variant="outline" size="sm" className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                      <BookOpenCheck className="h-3.5 w-3.5" />
                      اصلاح نسخه
                    </Button>
                    <Button onClick={() => void onSubmitForReview()} disabled={busy} size="sm" className="gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold shadow-lg shadow-amber-500/20">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {latestRejectedRequest ? 'ارسال مجدد به بازبینی' : 'ارسال به بازبینی'}
                    </Button>
                  </>
                )}
                {canEdit && version.status === 'REVIEW' && activeRequest?.status === 'REQUESTED' && (
                  <>
                    <Button onClick={() => void onStartReview()} disabled={busy} size="sm" className="gap-1.5 bg-sky-600 hover:bg-sky-500 font-semibold shadow-lg shadow-sky-600/20">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      شروع بازبینی تخصصی
                    </Button>
                    <Button onClick={() => void onWithdrawReview()} disabled={busy} variant="outline" size="sm" className="gap-1.5 border-zinc-700 text-zinc-400 hover:bg-zinc-800">
                      <RotateCcw className="h-3.5 w-3.5" />
                      بازگشت به پیش‌نویس
                    </Button>
                  </>
                )}
                {canEdit && version.status === 'REVIEW' && activeRequest?.status === 'IN_REVIEW' && (
                  <>
                    <Button onClick={() => void onDecideReview('approve')} disabled={busy} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 font-semibold shadow-lg shadow-emerald-600/20">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      تأیید بازبینی
                    </Button>
                    <Button onClick={() => void onDecideReview('reject')} disabled={busy} variant="outline" size="sm" className="gap-1.5 border-red-800/60 text-red-400 hover:bg-red-950/50 hover:text-red-300">
                      <X className="h-3.5 w-3.5" />
                      رد و اصلاح
                    </Button>
                  </>
                )}
                {canEdit && version.status === 'TESTING' && (
                  <Button onClick={() => void onPublish()} disabled={busy} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 font-semibold shadow-lg shadow-emerald-600/20">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                    انتشار نهایی
                  </Button>
                )}
                {canEdit && version.status === 'PUBLISHED' && (
                  <Button onClick={() => void onRetire()} disabled={busy} size="sm" variant="outline" className="gap-1.5 border-zinc-600 text-zinc-300 hover:bg-zinc-800">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    منسوخ‌سازی نسخه
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Progress Stepper ── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-[#101211] p-5 shadow-xl">
          <h4 className="text-sm font-semibold text-zinc-400 mb-4">مسیر انتشار</h4>
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isCompleted = idx < currentStepIndex || version.status === 'PUBLISHED' || version.status === 'RETIRED'
              const isCurrent = idx === currentStepIndex
              const isPending = idx > currentStepIndex
              const StepIcon = step.icon

              return (
                <div key={step.key} className="flex items-center gap-1 min-w-0">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`
                      flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300
                      ${isCompleted ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400' : ''}
                      ${isCurrent ? 'border-amber-500 bg-amber-500/15 text-amber-400 shadow-lg shadow-amber-500/10' : ''}
                      ${isPending ? 'border-zinc-700 bg-zinc-800/50 text-zinc-600' : ''}
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight whitespace-nowrap ${isCurrent ? 'text-amber-300' : isCompleted ? 'text-emerald-400/80' : 'text-zinc-600'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className={`h-0.5 w-6 sm:w-10 mt-[-18px] rounded-full ${isCompleted ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Metrics Row ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="قواعد تشخیص" value={rules.length} suffix="قاعده" icon={<ShieldAlert className="h-4 w-4" />} color="amber" />
          <MetricCard label="مراحل فرایند" value={steps.length} suffix="مرحله" icon={<ClipboardCheck className="h-4 w-4" />} color="sky" />
          <MetricCard label="تاریخ اثرگذاری" value={version.effective_from || '—'} icon={<Clock3 className="h-4 w-4" />} color="zinc" isText />
          <MetricCard label="منبع رسمی" value={version.source_url ? 'ثبت شده' : 'ثبت نشده'} icon={<BookOpenCheck className="h-4 w-4" />} color={version.source_url ? 'emerald' : 'zinc'} isText />
        </div>

        {/* ── Rejection Alert ── */}
        {latestRejectedRequest && version.status === 'DRAFT' && (
          <div className="rounded-2xl border border-red-900/50 bg-gradient-to-bl from-red-950/40 to-[#101211] p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-200">موارد اصلاحی بازبین</h4>
                <p className="text-xs text-red-300/60">نسخه به پیش‌نویس برگشته است</p>
              </div>
            </div>
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
              <p className="text-sm leading-7 text-red-100/90">
                {latestRejectedRequest.decision_note || 'بازبین توضیح اصلاحی ثبت نکرده است.'}
              </p>
            </div>
            <p className="text-xs text-red-300/50">
              ابتدا با «اصلاح نسخه» اطلاعات را ویرایش و ذخیره کنید، سپس دوباره به بازبینی ارسال کنید.
            </p>
          </div>
        )}

        {/* ── Pre-publish Checklist ── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-[#101211] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-200">پیش‌شرط‌های انتشار</h4>
                <p className="text-xs text-zinc-500">تکمیل تمام موارد الزامی است</p>
              </div>
            </div>
            {allChecksPass ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                آماده
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-700 text-zinc-500 gap-1">
                <AlertTriangle className="h-3 w-3" />
                ناقص
              </Badge>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckRow ok={Boolean(version.effective_from)} label="تاریخ شروع اثرگذاری" />
            <CheckRow ok={Boolean(version.source_url)} label="لینک منبع رسمی" />
            <CheckRow ok={Boolean(version.legal_reference)} label="مرجع قانونی" />
            <CheckRow ok={rules.length > 0} label="حداقل یک قاعده تشخیص" />
            <CheckRow ok={steps.length > 0} label="حداقل یک مرحله فرایند" />
            <CheckRow ok={penaltySchemaReady} label="ساختار جرایم آماده" />
          </div>
        </div>

        {/* ── Review Timeline ── */}
        <div className="rounded-2xl border border-zinc-800/60 bg-[#101211] p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20">
                <ClipboardCheck className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-200">تاریخچه بازبینی</h4>
                <p className="text-xs text-zinc-500">تمام درخواست‌ها و تصمیمات بازبینی</p>
              </div>
            </div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500">
              {reviewRequests.length.toLocaleString('fa-IR')} رکورد
            </Badge>
          </div>

          {reviewRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700/60 p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80">
                  <Inbox className="h-5 w-5 text-zinc-600" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">هنوز درخواست بازبینی ثبت نشده</p>
                  <p className="text-xs text-zinc-600 mt-1">نسخه را به بازبینی ارسال کنید تا فرایند شروع شود</p>
                </div>
                {canEdit && version.status === 'DRAFT' && (
                  <Button onClick={() => void onSubmitForReview()} disabled={busy} size="sm" className="gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400 mt-2">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    ارسال به بازبینی
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewRequests.map((request, index) => (
                <ReviewRequestCard
                  key={request.id}
                  request={request}
                  index={index}
                  busy={busy}
                  canEdit={canEdit}
                  onDecideReview={onDecideReview}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Actions Footer ── */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-800/60 bg-[#101211] p-4 shadow-xl">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            بازگشت به لیست
          </Button>
          {canEdit && version.status === 'DRAFT' && (
            <Button variant="outline" size="sm" onClick={() => void onSeed()} disabled={busy} className="gap-1.5 border-zinc-700 text-zinc-400 hover:bg-zinc-800">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              به‌روزرسانی داده‌های استاندارد
            </Button>
          )}
        </div>
      </div>

      {/* ── Repair Dialog ── */}
      {repairDialogOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="repair-review-title">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/60 bg-[#141817] p-6 text-right shadow-2xl space-y-4" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20">
                <Inbox className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <h3 id="repair-review-title" className="text-base font-bold text-zinc-100">ایجاد درخواست بازبینی</h3>
                <p className="text-xs text-zinc-500">نسخه به پیش‌نویس برمی‌گردد و درخواست جدید ساخته می‌شود</p>
              </div>
            </div>
            <p className="text-sm leading-7 text-zinc-400">
              این نسخه در وضعیت بازبینی است، اما درخواست کارتابل برای آن پیدا نشد. برای ایجاد درخواست رسمی، ابتدا نسخه به پیش‌نویس برمی‌گردد و سپس درخواست جدیدی ثبت می‌شود.
            </p>
            <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3">
              <p className="text-xs leading-6 text-amber-200/80">
                ⚠️ اطلاعات نسخه حذف نمی‌شود؛ فقط وضعیت آن تغییر می‌کند.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRepairDialogOpen(false)} disabled={busy} className="border-zinc-700">انصراف</Button>
              <Button onClick={() => { setRepairDialogOpen(false); void onRepairReviewRequest() }} disabled={busy} className="gap-1.5 bg-sky-600 hover:bg-sky-500">
                تأیید و ایجاد درخواست
              </Button>
            </div>
          </div>
        </div>
      )}
    </FullScreen>
  )
}

/* ── Sub-Components ── */

function ReviewRequestCard({ request, index, busy, canEdit, onDecideReview }: {
  request: any
  index: number
  busy: boolean
  canEdit: boolean
  onDecideReview: (decision: 'approve' | 'reject') => Promise<void>
}) {
  const isLatest = index === 0

  return (
    <div className={`rounded-xl border p-4 transition-all ${isLatest ? 'border-zinc-700/80 bg-[#141816]' : 'border-zinc-800/60 bg-[#111312] opacity-80'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ReviewStatusDot status={request.status} />
          <span className={`text-sm font-semibold ${reviewStatusTextClass(request.status)}`}>
            {reviewStatusLabel(request.status)}
          </span>
        </div>
        <span className="text-xs text-zinc-600" dir="ltr">{formatDate(request.submitted_at)}</span>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-zinc-600">ثبت‌کننده:</span>
          <span className="font-mono text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded" dir="ltr">{request.submitted_by?.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-zinc-600">بازبین:</span>
          {request.reviewer_id ? (
            <span className="font-mono text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded" dir="ltr">{request.reviewer_id?.slice(0, 8)}…</span>
          ) : (
            <span className="text-zinc-600 italic">تخصیص نیافته</span>
          )}
        </div>
      </div>

      {request.status === 'REQUESTED' && (
        <div className="mt-3 rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2.5">
          <p className="text-xs leading-5 text-sky-300/70">
            ⏳ این درخواست در صف بازبینی قرار دارد. بازبین باید «شروع بازبینی تخصصی» را انتخاب کند.
          </p>
        </div>
      )}

      {request.status === 'IN_REVIEW' && canEdit && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/60 pt-3">
          <Button onClick={() => void onDecideReview('approve')} disabled={busy} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            تأیید نهایی
          </Button>
          <Button onClick={() => void onDecideReview('reject')} disabled={busy} size="sm" variant="outline" className="gap-1.5 border-red-800/50 text-red-400 hover:bg-red-950/40 text-xs">
            <X className="h-3 w-3" />
            رد و اصلاح
          </Button>
        </div>
      )}

      {request.status === 'APPROVED' && (
        <div className="mt-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2.5">
          <p className="text-xs leading-5 text-emerald-300/70">
            ✅ بازبینی تأیید شد. نسخه وارد مرحله آزمایش شده است.
          </p>
        </div>
      )}

      {request.status === 'REJECTED' && (
        <div className="mt-3 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5">
          <p className="text-xs leading-5 text-red-300/70">
            ❌ بازبینی رد شد. نسخه برای اصلاح به پیش‌نویس بازگشت.
          </p>
        </div>
      )}

      {request.status === 'WITHDRAWN' && (
        <div className="mt-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2.5">
          <p className="text-xs leading-5 text-zinc-400">
            ↩️ درخواست توسط ثبت‌کننده لغو شد.
          </p>
        </div>
      )}

      {request.decision_note && (
        <div className="mt-3 flex items-start gap-2 border-t border-zinc-800/60 pt-3">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
          <p className="text-xs leading-6 text-zinc-400">{request.decision_note}</p>
        </div>
      )}
    </div>
  )
}

function ReviewStatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    REQUESTED: 'bg-sky-400',
    IN_REVIEW: 'bg-amber-400',
    APPROVED: 'bg-emerald-400',
    REJECTED: 'bg-red-400',
    WITHDRAWN: 'bg-zinc-500',
  }
  return <span className={`h-2 w-2 rounded-full ${colorMap[status] ?? 'bg-zinc-600'}`} />
}

function FullScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0a0c0b] p-4 text-zinc-100 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-0 z-20 mb-5 flex items-center justify-between rounded-xl border border-zinc-800/60 bg-[#0f1110]/95 p-3 backdrop-blur-xl shadow-2xl">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            بازگشت
          </Button>
          <h2 className="text-sm font-bold text-zinc-200">{title}</h2>
          <div className="w-20" />
        </div>
        {children}
      </div>
    </div>
  )
}

function MetricCard({ label, value, suffix, icon, color, isText }: {
  label: string
  value: number | string
  suffix?: string
  icon: React.ReactNode
  color: 'amber' | 'sky' | 'emerald' | 'zinc'
  isText?: boolean
}) {
  const colorMap = {
    amber: 'border-amber-900/40 bg-amber-950/10 text-amber-400',
    sky: 'border-sky-900/40 bg-sky-950/10 text-sky-400',
    emerald: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-400',
    zinc: 'border-zinc-800/60 bg-zinc-900/40 text-zinc-500',
  }

  return (
    <div className={`rounded-xl border p-4 transition-all hover:scale-[1.01] ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] text-zinc-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        {isText ? (
          <span className="text-sm font-bold text-zinc-200">{value}</span>
        ) : (
          <>
            <span className="text-2xl font-black text-zinc-100">{typeof value === 'number' ? value.toLocaleString('fa-IR') : value}</span>
            {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
          </>
        )}
      </div>
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all ${ok ? 'border-emerald-900/40 bg-emerald-950/10' : 'border-zinc-800/60 bg-zinc-900/30'}`}>
      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${ok ? 'bg-emerald-500/15' : 'bg-zinc-800'}`}>
        {ok ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        ) : (
          <X className="h-3 w-3 text-zinc-600" />
        )}
      </div>
      <span className={`text-xs ${ok ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: 'bg-zinc-800/80 border-zinc-700', text: 'text-zinc-400', label: 'پیش‌نویس' },
    REVIEW: { bg: 'bg-sky-950/40 border-sky-800/60', text: 'text-sky-300', label: 'در بازبینی' },
    TESTING: { bg: 'bg-amber-950/40 border-amber-800/60', text: 'text-amber-300', label: 'در آزمایش' },
    PUBLISHED: { bg: 'bg-emerald-950/40 border-emerald-800/60', text: 'text-emerald-300', label: 'منتشرشده' },
    RETIRED: { bg: 'bg-zinc-900/40 border-zinc-700', text: 'text-zinc-500', label: 'منسوخ' },
  }
  const c = config[status] ?? config.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.text.replace('text-', 'bg-')}`} />
      {c.label}
    </span>
  )
}

function reviewStatusLabel(status: string) {
  return ({ REQUESTED: 'در صف بازبینی', IN_REVIEW: 'در حال بازبینی', APPROVED: 'تأییدشده', REJECTED: 'ردشده', WITHDRAWN: 'بازگشته به پیش‌نویس' } as Record<string, string>)[status] ?? status
}

function reviewStatusTextClass(status: string) {
  return ({
    REQUESTED: 'text-sky-300',
    IN_REVIEW: 'text-amber-300',
    APPROVED: 'text-emerald-300',
    REJECTED: 'text-red-300',
    WITHDRAWN: 'text-zinc-400',
  } as Record<string, string>)[status] ?? 'text-zinc-400'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'بدون تاریخ'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fa-IR')
}
