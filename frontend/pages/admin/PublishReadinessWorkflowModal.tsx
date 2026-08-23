import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Inbox,
  Loader2,
  MessageSquare,
  Rocket,
  ShieldAlert,
  UserCheck,
  X,
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
  onStartReview: () => Promise<void>
  onDecideReview: (decision: 'approve' | 'reject') => Promise<void>
  onWithdrawReview: () => Promise<void>
  onPublish: () => Promise<void>
  onEditVersion: () => void
  onClose: () => void
  onSaved: () => Promise<void>
}

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
  onStartReview,
  onDecideReview,
  onWithdrawReview,
  onPublish,
  onEditVersion,
  onClose,
}: Props) {
  const activeRequest = reviewRequests.find((request) => ['REQUESTED', 'IN_REVIEW'].includes(request.status))
  const latestRejectedRequest = reviewRequests.find((request) => request.status === 'REJECTED')
  const canEdit = mode === 'EDIT'

  return (
    <FullScreen title={`آمادگی انتشار نسخه ${version.version_number}: ${item.obligation.title}`} onBack={onClose}>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-[#101211] p-6 shadow-xl space-y-6">
          <header className="flex flex-col gap-4 border-b border-zinc-800/80 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-zinc-100">چرخه انتشار نسخه {version.version_number}</h3>
                <Badge variant="outline" className={version.status === 'PUBLISHED' ? 'border-emerald-700 text-emerald-300' : 'border-amber-700 text-amber-300'}>
                  {statusLabel(version.status)}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-6 text-zinc-400">
                نسخه فقط پس از تکمیل کنترل‌های قانونی، ثبت تصمیم بازبین و اجرای آزمایش قابل انتشار است.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && version.status === 'DRAFT' && (
                <>
                  <Button onClick={() => void onEditVersion()} disabled={busy} variant="outline" className="gap-1.5 border-sky-700 text-sky-300 hover:bg-sky-950/40">
                    <BookOpenCheck className="h-4 w-4" />
                    اصلاح نسخه
                  </Button>
                  <Button onClick={() => void onSubmitForReview()} disabled={busy} className="gap-1.5 bg-amber-500 text-zinc-950 hover:bg-amber-400">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
                    {latestRejectedRequest ? 'ارسال مجدد به بازبینی' : 'ارسال به بازبینی'}
                  </Button>
                </>
              )}
              {canEdit && version.status === 'REVIEW' && activeRequest && (
                <>
                  {activeRequest.status === 'REQUESTED' && (
                    <>
                      <Button onClick={() => void onStartReview()} disabled={busy} className="gap-1.5 bg-sky-700 hover:bg-sky-600">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        شروع بازبینی تخصصی
                      </Button>
                      <Button onClick={() => void onWithdrawReview()} disabled={busy} variant="outline" className="gap-1.5 border-sky-800 text-sky-300 hover:bg-sky-950/40">
                        <BookOpenCheck className="h-4 w-4" />
                        بازگشت به پیش‌نویس برای اصلاح
                      </Button>
                    </>
                  )}
                  {activeRequest.status === 'IN_REVIEW' && (
                    <>
                      <Button onClick={() => void onDecideReview('approve')} disabled={busy} className="gap-1.5 bg-emerald-700 hover:bg-emerald-600">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        تأیید بازبینی و ورود به آزمایش
                      </Button>
                      <Button onClick={() => void onDecideReview('reject')} disabled={busy} variant="outline" className="gap-1.5 border-red-800 text-red-300 hover:bg-red-950/40">
                        <X className="h-4 w-4" />
                        رد و بازگشت برای اصلاح
                      </Button>
                    </>
                  )}
                </>
              )}
              {canEdit && version.status === 'TESTING' && (
                <Button onClick={() => void onPublish()} disabled={busy} className="gap-1.5 bg-emerald-700 hover:bg-emerald-600">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  انتشار نهایی نسخه
                </Button>
              )}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="قواعد تشخیص" value={`${rules.length} قاعده`} icon={<ShieldAlert className="h-4 w-4" />} />
            <Metric label="مراحل فرایند" value={`${steps.length} مرحله`} icon={<ClipboardCheck className="h-4 w-4" />} />
            <Metric label="تاریخ اثرگذاری" value={version.effective_from || 'ثبت نشده'} icon={<Clock3 className="h-4 w-4" />} />
            <Metric label="منبع رسمی" value={version.source_url ? 'ثبت شده' : 'ثبت نشده'} icon={<BookOpenCheck className="h-4 w-4" />} />
          </div>

          {latestRejectedRequest && version.status === 'DRAFT' && (
            <section className="rounded-xl border border-red-900/70 bg-red-950/20 p-5 space-y-3">
              <h4 className="flex items-center gap-2 font-bold text-red-200">
                <MessageSquare className="h-4 w-4" />
                موارد اصلاحی بازبین
              </h4>
              <p className="text-xs leading-6 text-red-100/80">
                این نسخه به پیش‌نویس برگشته است. ابتدا با «اصلاح نسخه» اطلاعات را ویرایش و ذخیره کنید، سپس دوباره به بازبینی ارسال کنید.
              </p>
              <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs leading-6 text-red-100">
                {latestRejectedRequest.decision_note || 'بازبین توضیح اصلاحی ثبت نکرده است.'}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 font-bold text-sky-200">
                  <ClipboardCheck className="h-4 w-4" />
                  کارتابل بازبینی تخصصی
                </h4>
                <p className="mt-1 text-xs leading-5 text-sky-100/70">
                  ارسال، claim بازبین، تصمیم نهایی و توضیح تخصصی هر درخواست در دیتابیس ثبت می‌شود.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-sky-700 text-sky-300">
                {reviewRequests.length.toLocaleString('fa-IR')} سابقه
              </Badge>
            </div>

            {reviewRequests.length === 0 ? (
              <p className="rounded-lg border border-dashed border-sky-900/70 p-4 text-center text-xs text-sky-100/60">
                هنوز درخواست بازبینی برای این نسخه ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {reviewRequests.map((request) => (
                  <article key={request.id} className="rounded-lg border border-zinc-700/80 bg-[#101211] p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${reviewStatusClass(request.status)}`}>
                        {reviewStatusLabel(request.status)}
                      </span>
                      <span className="text-zinc-500" dir="ltr">{formatDate(request.submitted_at)}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-zinc-400 sm:grid-cols-2">
                      <span>ثبت‌کننده: <b className="font-mono text-zinc-300" dir="ltr">{request.submitted_by}</b></span>
                      <span>بازبین: <b className="font-mono text-zinc-300" dir="ltr">{request.reviewer_id || 'تخصیص نیافته'}</b></span>
                    </div>
                    {request.decision_note && (
                      <p className="mt-2 flex items-start gap-1.5 border-t border-zinc-800 pt-2 leading-5 text-zinc-300">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        {request.decision_note}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-amber-900/60 bg-amber-950/15 p-5 space-y-3">
            <h4 className="flex items-center gap-2 font-bold text-amber-200">
              <ShieldAlert className="h-4 w-4" />
              کنترل‌های لازم برای انتشار
            </h4>
            <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
              <CheckRow ok={Boolean(version.effective_from)} label="تاریخ شروع اثرگذاری" />
              <CheckRow ok={Boolean(version.source_url)} label="لینک منبع رسمی" />
              <CheckRow ok={Boolean(version.legal_reference)} label="مرجع قانونی" />
              <CheckRow ok={rules.length > 0} label="حداقل یک قاعده تشخیص" />
              <CheckRow ok={steps.length > 0} label="حداقل یک مرحله فرایند" />
              <CheckRow ok={penaltySchemaReady} label="ساختار جرایم آماده" />
            </div>
          </section>

          {canEdit && version.status === 'DRAFT' && (
            <Button variant="outline" onClick={() => void onSeed()} disabled={busy} className="gap-1.5 border-amber-700 text-amber-300 hover:bg-amber-950/40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
              درج یا به‌روزرسانی داده‌های استاندارد
            </Button>
          )}

          <div className="flex justify-end border-t border-zinc-800 pt-4">
            <Button variant="outline" onClick={onClose}>بستن و بازگشت</Button>
          </div>
        </section>
      </div>
    </FullScreen>
  )
}

function FullScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0b0d0c] p-4 text-zinc-100 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="sticky top-0 z-20 mb-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-[#101211]/95 p-3 backdrop-blur">
          <Button variant="ghost" onClick={onBack}>بازگشت</Button>
          <h2 className="font-black">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#1b1e1c] p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">{icon}{label}</div>
      <p className="mt-2 text-sm font-black text-zinc-100">{value}</p>
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#101211] px-3 py-2">
      <CheckCircle2 className={`h-4 w-4 ${ok ? 'text-emerald-400' : 'text-zinc-600'}`} />
      <span>{label}</span>
    </div>
  )
}

function statusLabel(status: string) {
  return ({ DRAFT: 'پیش‌نویس', REVIEW: 'در بازبینی', TESTING: 'در آزمایش', PUBLISHED: 'منتشرشده', RETIRED: 'منسوخ' } as Record<string, string>)[status] ?? status
}

function reviewStatusLabel(status: string) {
  return ({ REQUESTED: 'در صف بازبینی', IN_REVIEW: 'در حال بازبینی', APPROVED: 'تأییدشده', REJECTED: 'ردشده', WITHDRAWN: 'بازگشته به پیش‌نویس' } as Record<string, string>)[status] ?? status
}

function reviewStatusClass(status: string) {
  return ({
    REQUESTED: 'border-sky-800 bg-sky-950/50 text-sky-300',
    IN_REVIEW: 'border-amber-800 bg-amber-950/50 text-amber-300',
    APPROVED: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
    REJECTED: 'border-red-800 bg-red-950/50 text-red-300',
    WITHDRAWN: 'border-sky-800 bg-sky-950/50 text-sky-300',
  } as Record<string, string>)[status] ?? 'border-zinc-700 bg-zinc-900 text-zinc-300'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'بدون تاریخ'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fa-IR')
}
