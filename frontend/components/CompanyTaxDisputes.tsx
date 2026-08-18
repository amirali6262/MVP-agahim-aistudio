import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Gavel,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  Plus,
  Send,
  Building2,
  FileCheck2,
  Info,
  GitBranch,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowLeft,
  ArrowRight,
  Handshake,
  CheckSquare,
  Scale,
  Calendar,
  Zap,
  Timer,
  ExternalLink,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import { Badge } from '../lib/shadcn/badge'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../lib/shadcn/select'
import ObjectionFlowDiagramModal from './ObjectionFlowDiagramModal'
import { mockObjectionTemplatesDb } from '../lib/mockDb'
import type { ObjectionStep, StepTransition, TransitionTriggerType, TransitionTargetType } from '../lib/supabase'

interface Props {
  tenantId: string
  tenantName: string
}

interface DisputeCase {
  id: string
  assessmentNo: string
  type: string
  fiscalYear: string
  issuedAmount: string
  claimedAmount: string
  noticeDate: string
  currentStepId: string
  currentStepTitle: string
  remainingDays: number
  statutoryDeadlineDays: number
  autoTimeoutTriggerDesc: string
  legalReference: string
  history: {
    stepId: string
    title: string
    timestamp: string
    outcomeTitle: string
    isLoop?: boolean
  }[]
  status: 'ACTIVE_DISPUTE' | 'TERMINAL_AGREED' | 'TERMINAL_SETTLED' | 'TERMINAL_FINAL'
  terminalOutcome?: string
  hearingDate?: string
  petitionText: string
}

export default function CompanyTaxDisputes({ tenantId, tenantName }: Props) {
  const [isGraphOpen, setIsGraphOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string>('disp-01')

  const template = useMemo(() => mockObjectionTemplatesDb.getById('obj-001') || mockObjectionTemplatesDb.getAll()[0] || null, [])

  // Comprehensive state machine cases for this company
  const [cases, setCases] = useState<DisputeCase[]>([
    {
      id: 'disp-01',
      assessmentNo: 'AS-1403-99201',
      type: 'مالیات بر عملکرد اشخاص حقوقی',
      fiscalYear: 'سال مالی ۱۴۰۲',
      issuedAmount: '۴,۵۰۰,۰۰۰,۰۰۰ ریال',
      claimedAmount: '۱,۲۰۰,۰۰۰,۰۰۰ ریال',
      noticeDate: '1403/04/10',
      currentStepId: 's-101',
      currentStepTitle: 'مذاکره و رسیدگی نزد رئیس امور مالیاتی (ماده ۲۳۸ ق.م.م)',
      remainingDays: 14,
      statutoryDeadlineDays: 45,
      autoTimeoutTriggerDesc: 'در صورت عدم ثبت توافق ظرف ۴۵ روز، پرونده خودکار به هیأت حل اختلاف بدوی (ماده ۲۴۴) ارجاع می‌شود.',
      legalReference: 'ماده ۲۳۸ قانون مالیات‌های مستقیم (مهلت ثبت ۳۰ روز - مهلت رسیدگی و توافق ۴۵ روز)',
      history: [
        {
          stepId: 's-100a',
          title: 'صدور و ابلاغ برگ تشخیص مالیات',
          timestamp: '1403/04/10',
          outcomeTitle: 'ابلاغ قانونی صورت گرفت',
        },
        {
          stepId: 's-101',
          title: 'ثبت اعتراض اولیه مودی (ماده ۲۳۸)',
          timestamp: '1403/04/22',
          outcomeTitle: 'درخواست توافق با رئیس اداره ثبت گردید',
        },
      ],
      status: 'ACTIVE_DISPUTE',
      petitionText: `بسمه تعالی\nریاست محترم امور مالیاتی...\nاحتراماً پیرو برگ تشخیص شماره AS-1403-99201 عملکرد سال ۱۴۰۲ به استحضار می‌رساند اقلام درآمدی شرکت طبق دفاتر پلمپ‌شده ثبت گردیده و هزینه‌های سال ۱۴۰۲ منطبق بر مواد ۱۴۷ و ۱۴۸ قانون مالیات‌های مستقیم است. لذا استدعای تعدیل مأخذ مالیاتی در اجرای ماده ۲۳۸ قانون مالیات‌های مستقیم را دارد.`,
    },
    {
      id: 'disp-02',
      assessmentNo: 'AS-1402-11029',
      type: 'مالیات بر ارزش افزوده',
      fiscalYear: 'دوره زمستان ۱۴۰۱',
      issuedAmount: '۱,۸۰۰,۰۰۰,۰۰۰ ریال',
      claimedAmount: '۳۵۰,۰۰۰,۰۰۰ ریال',
      noticeDate: '1403/01/15',
      currentStepId: 's-109',
      currentStepTitle: 'رسیدگی مجری قرار کارشناسی هیأت بدوی (ماده ۲۴۸ ق.م.م - گره حلقه)',
      remainingDays: 8,
      statutoryDeadlineDays: 30,
      autoTimeoutTriggerDesc: 'مجری قرار موظف است ظرف ۳۰ روز گزارش خود را ارائه نماید. پس از ثبت گزارش، پرونده مجدداً به جلسه دوم هیأت بدوی بازمی‌گردد.',
      legalReference: 'ماده ۲۴۴ و ۲۴۸ ق.م.م (ارجاع به کارشناسی و حسابرسی مجدد)',
      history: [
        {
          stepId: 's-100a',
          title: 'ابلاغ برگه مطالبه ارزش افزوده',
          timestamp: '1403/01/15',
          outcomeTitle: 'ابلاغ الکترونیکی',
        },
        {
          stepId: 's-107',
          title: 'ارجاع به هیأت حل اختلاف بدوی (ماده ۲۴۴)',
          timestamp: '1403/02/10',
          outcomeTitle: 'عدم توافق در ماده ۲۳۸ و ارسال به هیأت',
        },
        {
          stepId: 's-109',
          title: 'صدور قرار رسیدگی و کارشناسی مجدد (ماده ۲۴۸)',
          timestamp: '1403/03/05',
          outcomeTitle: 'هیأت بدوی قرار کارشناسی صادر نمود (ورود به زیرفرآیند قرار)',
          isLoop: true,
        },
      ],
      status: 'ACTIVE_DISPUTE',
      hearingDate: '1404/05/28 ساعت ۱۰:۳۰ (جلسه دوم پس از وصول گزارش قرار)',
      petitionText: `هیأت محترم حل اختلاف مالیاتی بدوی...\nبا عنایت به صدور قرار کارشناسی ماده ۲۴۸، مدارک و مستندات الکترونیکی سامانه مؤدیان و اعتبار مالیاتی خریدهای فصلی ضمیمه گزارش کارشناس مجری قرار تقدیم می‌گردد. تقاضای تایید اعتبار مالیاتی و اصلاح بدهی را دارد.`,
    },
    {
      id: 'disp-03',
      assessmentNo: 'AS-1401-44012',
      type: 'مالیات بر عملکرد اشخاص حقوقی',
      fiscalYear: 'سال مالی ۱۴۰۱',
      issuedAmount: '۲,۲۰۰,۰۰۰,۰۰۰ ریال',
      claimedAmount: '۹۰۰,۰۰۰,۰۰۰ ریال',
      noticeDate: '1402/09/20',
      currentStepId: 's-104',
      currentStepTitle: 'خاتمه پرونده: توافق ماده ۲۳۸ با رئیس امور مالیاتی',
      remainingDays: 0,
      statutoryDeadlineDays: 0,
      autoTimeoutTriggerDesc: 'پرونده مختومه شده است و برگه قطعی صادر گردید.',
      legalReference: 'ماده ۲۳۸ ق.م.م (توافق قطعی و لازم‌الاجرا)',
      history: [
        {
          stepId: 's-100a',
          title: 'ابلاغ برگ تشخیص',
          timestamp: '1402/09/20',
          outcomeTitle: 'ابلاغ قانونی',
        },
        {
          stepId: 's-101',
          title: 'ثبت اعتراض ماده ۲۳۸',
          timestamp: '1402/10/05',
          outcomeTitle: 'مراجعه به ممیز کل',
        },
        {
          stepId: 's-104',
          title: 'امضای صورتجلسه توافق ماده ۲۳۸',
          timestamp: '1402/10/22',
          outcomeTitle: 'توافق بر روی مالیات ۹۰۰,۰۰۰,۰۰۰ ریالی و صدور برگ قطعی',
        },
      ],
      status: 'TERMINAL_AGREED',
      terminalOutcome: 'توافق قطعی ماده ۲۳۸ — پرونده مختومه و برگ قطعی با شماره FIN-1402-9901 صادر شد.',
      petitionText: `صورتجلسه توافق قطعی ماده ۲۳۸ با شماره FIN-1402-9901 ثبت گردیده و مأخذ مشمول مالیات با ۳۰٪ تعدیل مورد توافق طرفین قرار گرفت.`,
    },
  ])

  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId) || cases[0], [cases, selectedCaseId])

  // Get current active step in the dispute template
  const currentStep = useMemo(() => {
    if (!template || !template.steps) return null
    return template.steps.find((s) => s.id === selectedCase?.currentStepId) || null
  }, [template, selectedCase])

  // Available transitions/branches from the current state
  const availableTransitions: StepTransition[] = useMemo(() => {
    if (!selectedCase || selectedCase.status !== 'ACTIVE_DISPUTE') return []

    // 1. If step has explicit transitions:
    if (currentStep?.transitions && currentStep.transitions.length > 0) {
      return currentStep.transitions
    }

    // 2. Intelligent statutory transitions based on standard Iranian Tax Code:
    if (selectedCase.currentStepId === 's-101' || selectedCase.currentStepId === 's-100a') {
      return [
        {
          id: 'tr-238-agree',
          title: 'توافق با رئیس اداره / ممیز کل بر روی مأخذ تعدیل‌شده',
          trigger_type: 'USER_ACTION',
          target_type: 'TERMINAL_AGREED',
          action_label: 'امضای صورتجلسه توافق ماده ۲۳۸',
          legal_reference: 'ماده ۲۳۸ اصلاحی ق.م.م',
          description: 'درآمد مشمول مالیات تعدیل گردیده و پرونده بدون نیاز به هیأت، مختومه و برگ قطعی صادر می‌شود.',
        },
        {
          id: 'tr-238-settle',
          title: 'تمکین به برگه تشخیص و تقاضای حداکثر بخشودگی جرایم',
          trigger_type: 'USER_ACTION',
          target_type: 'TERMINAL_SETTLED',
          action_label: 'ثبت تمکین و پرداخت',
          legal_reference: 'ماده ۱۹۰ و ۲۳۸ ق.م.م',
          description: 'پذیرش تشخیص اولیه و بهره‌مندی از جوایز خوش‌حسابی و بخشودگی جرایم ماده ۱۹۰.',
        },
        {
          id: 'tr-238-expert',
          title: 'صدور قرار کارشناسی و حسابرسی مجدد اسناد (ماده ۲۳۸)',
          trigger_type: 'USER_ACTION',
          target_type: 'STEP',
          target_step_id: 's-102',
          action_label: 'ارجاع به کارشناس مجری قرار',
          legal_reference: 'ماده ۲۳۸ ق.م.م',
          description: 'در صورت نیاز به بررسی تکمیلی فاکتورها، دفاتر و حساب‌های بانکی.',
        },
        {
          id: 'tr-238-disagree',
          title: 'عدم توافق مودی و ممیز کل: ارجاع به هیأت حل اختلاف بدوی',
          trigger_type: 'USER_ACTION',
          target_type: 'STEP',
          target_step_id: 's-107',
          action_label: 'ارجاع پرونده به هیأت بدوی (ماده ۲۴۴)',
          legal_reference: 'ماده ۲۴۴ ق.م.م',
          description: 'ارسال پرونده به هیأت ۳ نفره حل اختلاف و تعیین نماینده مودی (اتاق بازرگانی/حسابداران رسمی).',
        },
        {
          id: 'tr-238-timeout',
          title: 'انقضای خودکار مهلت ۴۵ روزه رسیدگی ماده ۲۳۸ بدون اقدام',
          trigger_type: 'TIMEOUT_AUTO',
          timeout_days: 45,
          timeout_desc: 'سیستم پس از پایان ۴۵ روز خودکار پرونده را به هیأت بدوی منتقل می‌کند.',
          target_type: 'STEP',
          target_step_id: 's-107',
          action_label: 'اعمال تریگر زمانی (انقضای مهلت)',
          legal_reference: 'ماده ۲۳۸ و ۲۴۴ ق.م.م',
          description: 'انتقال خودکار سیستمی به هیأت حل اختلاف بدوی طبق تصریح قانون.',
        },
      ]
    }

    if (selectedCase.currentStepId === 's-109' || selectedCase.currentStepId === 's-110') {
      return [
        {
          id: 'tr-248-report',
          title: 'تکمیل و تحویل گزارش کارشناسی مجری قرار به هیأت بدوی',
          trigger_type: 'USER_ACTION',
          target_type: 'LOOP_PREVIOUS',
          target_step_id: 's-111',
          action_label: 'بازگشت به جلسه دوم هیأت بدوی (حلقه بازگشتی)',
          legal_reference: 'ماده ۲۴۸ ق.م.م (رسیدگی به گزارش قرار)',
          description: 'جلسه دوم هیأت بدوی با حضور مودی و مجری قرار جهت استماع دفاعیات و صدور رأی تشکیل می‌شود.',
        },
        {
          id: 'tr-248-reloop',
          title: 'تجدید قرار کارشناسی به دلیل نقص مدارک و اسناد مثبته',
          trigger_type: 'USER_ACTION',
          target_type: 'LOOP_PREVIOUS',
          target_step_id: 's-109',
          action_label: 'تجدید قرار کارشناسی (تکرار حلقه)',
          legal_reference: 'ماده ۲۴۸ ق.م.م',
          description: 'فرصت مجدد کارشناسی جهت اخذ تأییدیه‌ها و استعلام از سامانه مؤدیان.',
        },
      ]
    }

    if (selectedCase.currentStepId === 's-112' || selectedCase.currentStepId === 's-107') {
      return [
        {
          id: 'tr-244-decision-accept',
          title: 'پذیرش رأی هیأت بدوی و عدم اعتراض ظرف ۲۰ روز (قطعیت)',
          trigger_type: 'USER_ACTION',
          target_type: 'TERMINAL_FINAL',
          action_label: 'قطعیت رأی بدوی و صدور برگ قطعی',
          legal_reference: 'ماده ۲۴۷ ق.م.م',
          description: 'رأی هیأت بدوی به دلیل عدم اعتراض ظرف ۲۰ روز قطعی می‌شود.',
        },
        {
          id: 'tr-244-appeal',
          title: 'اعتراض و تجدیدنظرخواهی مودی یا مأمور مالیاتی (ماده ۲۴۷)',
          trigger_type: 'USER_ACTION',
          target_type: 'STEP',
          target_step_id: 's-114',
          action_label: 'ارسال پرونده به هیأت حل اختلاف تجدیدنظر',
          legal_reference: 'ماده ۲۴۷ ق.م.م',
          description: 'رسیدگی مجدد در هیأت تجدیدنظر با ترکیب قضایی جدید.',
        },
        {
          id: 'tr-244-timeout-20',
          title: 'انقضای خودکار مهلت ۲۰ روزه تجدیدنظرخواهی بدون اعتراض',
          trigger_type: 'TIMEOUT_AUTO',
          timeout_days: 20,
          timeout_desc: 'پس از ۲۰ روز از ابلاغ رأی بدوی، رأی خودکار قطعی می‌شود.',
          target_type: 'TERMINAL_FINAL',
          action_label: 'انقضای خودکار و قطعیت',
          legal_reference: 'ماده ۲۴۷ ق.م.م',
          description: 'صدور برگ قطعی اداری بر اساس رأی هیأت بدوی.',
        },
      ]
    }

    return [
      {
        id: 'tr-generic-next',
        title: 'ثبت نتیجه و ارجاع به مرحله بعد',
        trigger_type: 'USER_ACTION',
        target_type: 'STEP',
        target_step_id: 's-114',
        action_label: 'ادامه فرآیند',
        legal_reference: 'قانون مالیات‌های مستقیم',
        description: 'انتقال به گام بعدی دادرسی.',
      },
    ]
  }, [selectedCase, currentStep])

  // Execute transition
  const handleExecuteTransition = (trans: StepTransition) => {
    if (!selectedCase) return

    const now = new Date()
    const jalaliNow = '1404/05/28'

    if (trans.target_type === 'TERMINAL_AGREED') {
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? {
                ...c,
                status: 'TERMINAL_AGREED',
                remainingDays: 0,
                currentStepTitle: 'خاتمه: توافق ماده ۲۳۸',
                terminalOutcome: 'پرونده با توافق ماده ۲۳۸ مختومه گردید و برگ قطعی تعدیل‌شده صادر شد.',
                history: [
                  ...c.history,
                  {
                    stepId: 's-104',
                    title: 'توافق ماده ۲۳۸ و صدور برگ قطعی',
                    timestamp: jalaliNow,
                    outcomeTitle: trans.title,
                  },
                ],
              }
            : c,
        ),
      )
      toast.success('توافق ماده ۲۳۸ با موفقیت ثبت شد و پرونده مختومه گردید.')
      return
    }

    if (trans.target_type === 'TERMINAL_SETTLED') {
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? {
                ...c,
                status: 'TERMINAL_SETTLED',
                remainingDays: 0,
                currentStepTitle: 'خاتمه: تمکین و پرداخت',
                terminalOutcome: 'تمکین مودی ثبت گردید و پرونده با اعمال حداکثر بخشودگی جرایم مختومه شد.',
                history: [
                  ...c.history,
                  {
                    stepId: 's-105',
                    title: 'تمکین به برگ تشخیص (ماده ۱۹۰)',
                    timestamp: jalaliNow,
                    outcomeTitle: trans.title,
                  },
                ],
              }
            : c,
        ),
      )
      toast.success('تمکین با موفقیت ثبت شد و برگ قطعی صادر گردید.')
      return
    }

    if (trans.target_type === 'TERMINAL_FINAL') {
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? {
                ...c,
                status: 'TERMINAL_FINAL',
                remainingDays: 0,
                currentStepTitle: 'قطعیت و صدور برگ قطعی',
                terminalOutcome: 'رای قطعی صادر و پرونده در سامانه امور مالیاتی مختومه گردید.',
                history: [
                  ...c.history,
                  {
                    stepId: 's-113',
                    title: 'قطعیت رأی و صدور برگ قطعی',
                    timestamp: jalaliNow,
                    outcomeTitle: trans.title,
                  },
                ],
              }
            : c,
        ),
      )
      toast.success('قطعیت رأی ثبت شد و پرونده مختومه گردید.')
      return
    }

    // Move to next step or loop back
    const targetStep = template?.steps.find((s) => s.id === trans.target_step_id)
    const newTitle = targetStep?.title || trans.title

    setCases((prev) =>
      prev.map((c) =>
        c.id === selectedCase.id
          ? {
              ...c,
              currentStepId: trans.target_step_id || 's-107',
              currentStepTitle: newTitle,
              remainingDays: trans.timeout_days || 30,
              history: [
                ...c.history,
                {
                  stepId: trans.target_step_id || 's-107',
                  title: newTitle,
                  timestamp: jalaliNow,
                  outcomeTitle: trans.title,
                  isLoop: trans.target_type === 'LOOP_PREVIOUS',
                },
              ],
            }
          : c,
      ),
    )

    if (trans.target_type === 'LOOP_PREVIOUS') {
      toast.info(`پرونده به گام بازگشتی منتقل شد: ${newTitle}`)
    } else {
      toast.success(`انتقال به گام جدید انجام شد: ${newTitle}`)
    }
  }

  return (
    <div className="w-full flex flex-col gap-6" dir="rtl">
      {/* Top Banner */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <Gavel className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-zinc-100 font-bold text-lg">
                مرکز هوشمند دادرسی، حل اختلاف و لوایح مالیاتی
              </h2>
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[11px] font-mono gap-1">
                <GitBranch className="w-3 h-3 text-emerald-400" />
                موتور انشعابی و درخت دادرسی
              </Badge>
            </div>
            <p className="text-zinc-400 text-xs mt-1">
              هدایت هوشمند پرونده بر اساس ماشین وضعیت، انشعاب‌های واقعی و مدیریت تریگرهای زمانی/رویدادی — ({tenantName})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsGraphOpen(true)}
            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs h-10 px-3.5 gap-2"
          >
            <GitBranch className="w-4 h-4 text-amber-400" />
            مشاهده نمودار کامل دادرسی
          </Button>

          <Button
            onClick={() => toast.info('برای ثبت پرونده جدید، برگ تشخیص مربوطه را از بخش مالیات بر عملکرد یا ارزش افزوده انتخاب کنید.')}
            className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-4 shadow gap-2"
          >
            <Plus className="w-4 h-4" />
            پرونده دادرسی جدید
          </Button>
        </div>
      </div>

      {/* Case Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cases.map((c) => {
          const isSelected = c.id === selectedCase.id
          const isFinished = c.status !== 'ACTIVE_DISPUTE'

          return (
            <button
              key={c.id}
              onClick={() => setSelectedCaseId(c.id)}
              className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'border-amber-500 bg-amber-950/30 ring-1 ring-amber-500/40 shadow-lg'
                  : 'border-zinc-800 bg-[#141615] hover:border-zinc-700 text-zinc-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] text-zinc-500 font-mono">برگ تشخیص: {c.assessmentNo}</span>
                  <h3 className="text-white font-bold text-sm mt-0.5">{c.type}</h3>
                  <span className="text-xs text-amber-400 font-medium">{c.fiscalYear}</span>
                </div>
                {isFinished ? (
                  <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] shrink-0 gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    مختومه
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] shrink-0 gap-1">
                    <Clock className="w-3 h-3" />
                    {c.remainingDays} روز مهلت
                  </Badge>
                )}
              </div>

              <div className="bg-zinc-950/60 p-2 rounded-xl border border-zinc-800 text-[11px] flex items-center justify-between">
                <span className="text-zinc-400 truncate">مرحله: <strong className="text-zinc-200">{c.currentStepTitle}</strong></span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Active Case Interactive Decision Panel */}
      <div className="rounded-2xl border border-zinc-800 bg-[#141615] p-6 flex flex-col gap-6 shadow-xl">
        {/* Header of Active Case */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-white font-bold text-lg">{selectedCase.type} ({selectedCase.fiscalYear})</h3>
              <Badge className="bg-zinc-900 border-zinc-700 text-zinc-300 font-mono text-xs">
                برگ تشخیص: {selectedCase.assessmentNo}
              </Badge>
              {selectedCase.status !== 'ACTIVE_DISPUTE' ? (
                <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-xs gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مختومه شده با قطعیت
                </Badge>
              ) : (
                <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-xs gap-1 font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  در جریان دادرسی فعال
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
              <span>مستند قانونی: <strong className="text-amber-300">{selectedCase.legalReference}</strong></span>
              <span>•</span>
              <span>تاریخ ابلاغ: <strong className="font-mono text-zinc-200">{selectedCase.noticeDate}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800 text-xs">
              <span className="text-zinc-500">اصل مالیات تشخیصی: </span>
              <span className="text-red-400 font-bold font-mono">{selectedCase.issuedAmount}</span>
            </div>
            <div className="bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800 text-xs">
              <span className="text-zinc-500">مبلغ ابرازی مودی: </span>
              <span className="text-emerald-400 font-bold font-mono">{selectedCase.claimedAmount}</span>
            </div>
          </div>
        </div>

        {/* Dual Triggers Banner (Event-driven vs Timeout-driven) */}
        {selectedCase.status === 'ACTIVE_DISPUTE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs leading-relaxed text-amber-200">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 block mb-0.5">تریگر رویدادمحور (اقدام فعال مودی / سازمان):</strong>
                شما می‌توانید با انتخاب یکی از مسیرهای زیر (توافق، تمکین، تقاضای قرار کارشناسی یا ثبت عدم توافق)، وضعیت پرونده را فوراً هدایت نمایید.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-700/50 flex items-start gap-3 text-xs leading-relaxed text-cyan-200">
              <Timer className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-cyan-300 block mb-0.5">تریگر زمان‌محور خودکار (انقضای مهلت قانونی):</strong>
                {selectedCase.autoTimeoutTriggerDesc}{' '}
                <span className="font-bold text-amber-300 font-mono">({selectedCase.remainingDays} روز تا انقضا)</span>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Branching Transitions (Decision Options) */}
        {selectedCase.status === 'ACTIVE_DISPUTE' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-amber-300 font-bold text-sm flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-amber-400" />
                مسیرهای ممکن و گام‌های بعدی خروجی از این مرحله (Decision Branches):
              </h4>
              <span className="text-xs text-zinc-500">انتخاب مسیر مورد نظر طبق واقعیت پرونده</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableTransitions.map((trans) => {
                const isAutoTimeout = trans.trigger_type === 'TIMEOUT_AUTO'
                const isTerminal = trans.target_type.startsWith('TERMINAL_')
                const isLoop = trans.target_type === 'LOOP_PREVIOUS'

                return (
                  <div
                    key={trans.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-right transition-all ${
                      isAutoTimeout
                        ? 'bg-zinc-950 border-cyan-800/60 hover:border-cyan-500'
                        : isTerminal
                        ? 'bg-emerald-950/20 border-emerald-800/60 hover:border-emerald-500'
                        : isLoop
                        ? 'bg-amber-950/20 border-amber-800/60 hover:border-amber-500'
                        : 'bg-zinc-900/90 border-zinc-800 hover:border-amber-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          {isLoop && <RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                          {isTerminal && <Handshake className="w-3.5 h-3.5 text-emerald-400" />}
                          {trans.title}
                        </span>
                        {isAutoTimeout ? (
                          <Badge className="bg-cyan-950 text-cyan-300 border-cyan-700 text-[10px] font-mono">
                            انقضای خودکار ({trans.timeout_days} روز)
                          </Badge>
                        ) : isLoop ? (
                          <Badge className="bg-amber-950 text-amber-300 border-amber-700 text-[10px]">
                            حلقه بازگشتی (Loop)
                          </Badge>
                        ) : isTerminal ? (
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-700 text-[10px]">
                            خاتمه و قطعیت
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">
                            گام بعدی دادرسی
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">{trans.description}</p>
                      {trans.legal_reference && (
                        <span className="text-[11px] text-amber-400/90 mt-1 block font-mono">
                          استناد: {trans.legal_reference}
                        </span>
                      )}
                    </div>

                    <Button
                      onClick={() => handleExecuteTransition(trans)}
                      className={`w-full font-bold text-xs h-9 gap-2 mt-2 ${
                        isTerminal
                          ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          : isAutoTimeout
                          ? 'bg-cyan-800 hover:bg-cyan-700 text-white'
                          : isLoop
                          ? 'bg-amber-600 hover:bg-amber-500 text-zinc-950'
                          : 'bg-[#E5A93C] hover:bg-[#d49a2d] text-zinc-950'
                      }`}
                    >
                      {isTerminal ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                      {trans.action_label || 'ثبت و اعمال این مسیر'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800 text-emerald-200 text-xs leading-relaxed flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="text-emerald-300 block mb-0.5">وضعیت نهایی پرونده:</strong>
              {selectedCase.terminalOutcome}
            </div>
          </div>
        )}

        {/* Case Progression Timeline / Audit Trail */}
        <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
          <h4 className="text-zinc-200 font-bold text-xs flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            تاریخچه مسیر طی‌شده در این پرونده (مسیر انشعابی اختصاصی):
          </h4>

          <div className="space-y-2">
            {selectedCase.history.map((h, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 text-amber-300 font-mono text-[11px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-zinc-200 font-bold">{h.title}</span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{h.outcomeTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {h.isLoop && (
                    <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px] gap-1">
                      <RotateCcw className="w-3 h-3" />
                      حلقه کارشناسی
                    </Badge>
                  )}
                  <span className="text-zinc-500 font-mono text-[11px]">{h.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Petition Draft Box */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              متن لایحه دفاعیه قانونی (ماده مربوطه):
            </span>
            <Button
              variant="outline"
              onClick={() => toast.success('متن لایحه به فرمت رسمی دانلود شد.')}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-7 gap-1"
            >
              <Download className="w-3 h-3" />
              دانلود لایحه رسمی
            </Button>
          </div>
          <pre className="text-zinc-300 font-sans whitespace-pre-wrap leading-relaxed text-xs bg-zinc-900/70 p-3 rounded-lg border border-zinc-800/80">
            {selectedCase.petitionText}
          </pre>
        </div>
      </div>

      {/* Full Diagram Visualizer Modal */}
      <ObjectionFlowDiagramModal
        isOpen={isGraphOpen}
        onClose={() => setIsGraphOpen(false)}
        template={template}
      />
    </div>
  )
}
