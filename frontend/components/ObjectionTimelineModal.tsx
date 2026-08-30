import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Layers, Handshake, FileCheck, GitBranch, CalendarClock, Info, Clock, CheckCircle2, ShieldCheck, Hourglass, FileText, User, Building2, Scale, Filter } from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import type { ObjectionTemplate, ObjectionStepNature, StepActor, Obligation } from '../lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  template: ObjectionTemplate | null
  linkedObligations?: Obligation[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
}

export default function ObjectionTimelineModal({
  isOpen,
  onClose,
  template,
  linkedObligations = [],
}: Props) {
  const [activeActorFilter, setActiveActorFilter] = useState<'ALL' | StepActor>('ALL')

  if (!isOpen || !template) return null

  const stepsToDisplay = (template.steps || []).filter((s) => {
    if (activeActorFilter === 'ALL') return true
    return (s.actor || 'TAX_AUTHORITY') === activeActorFilter
  })

  const getActorConfig = (actor?: string) => {
    switch (actor) {
      case 'TAXPAYER':
        return {
          label: 'مودی مالیاتی',
          badge: 'اقدام: مودی',
          bg: 'bg-emerald-950/50',
          border: 'border-emerald-700/70',
          text: 'text-emerald-300',
          icon: <User className="w-3.5 h-3.5 text-emerald-400" />,
        }
      case 'COURT_DIVAN':
        return {
          label: 'دیوان عدالت اداری',
          badge: 'اقدام: دیوان عدالت',
          bg: 'bg-cyan-950/50',
          border: 'border-cyan-700/70',
          text: 'text-cyan-300',
          icon: <Scale className="w-3.5 h-3.5 text-cyan-400" />,
        }
      case 'TAX_AUTHORITY':
      default:
        return {
          label: actor || 'سازمان امور مالیاتی',
          badge: 'اقدام: سازمان مالیاتی',
          bg: 'bg-amber-950/50',
          border: 'border-amber-700/70',
          text: 'text-amber-300',
          icon: <Building2 className="w-3.5 h-3.5 text-amber-400" />,
        }
    }
  }

  const getNatureConfig = (nature?: string) => {
    switch (nature) {
      case 'CONDITIONAL_EXPERT':
        return {
          badge: 'گام مشروط (قرار کارشناسی)',
          bg: 'bg-amber-950/40',
          border: 'border-amber-700/60',
          text: 'text-amber-300',
          dotBg: 'bg-amber-500',
          icon: <Layers className="w-4 h-4 text-amber-400" />,
          callout: 'این مرحله تنها در صورت صلاحدید ممیز کل یا هیأت حل اختلاف جهت صدور و اجرای قرار کارشناسی فعال می‌شود.',
        }
      case 'AGREEMENT_END':
        return {
          badge: 'نقطه پایان (توافق و ختم پرونده)',
          bg: 'bg-emerald-950/40',
          border: 'border-emerald-700/60',
          text: 'text-emerald-300',
          dotBg: 'bg-emerald-500',
          icon: <Handshake className="w-4 h-4 text-emerald-400" />,
          callout: 'در صورت دستیابی به توافق با اداره امور مالیاتی، پرونده در این مرحله مختومه شده و برگه قطعی صادر می‌گردد.',
        }
      case 'SETTLEMENT_END':
        return {
          badge: 'نقطه پایان (تمکین و بخشودگی)',
          bg: 'bg-purple-950/40',
          border: 'border-purple-700/60',
          text: 'text-purple-300',
          dotBg: 'bg-purple-500',
          icon: <FileCheck className="w-4 h-4 text-purple-400" />,
          callout: 'در صورت تمکین مودی، مالیات قطعی شده و از تسهیلات بخشودگی حداکثری جرایم استفاده می‌شود.',
        }
      case 'EXPIRED_END':
        return {
          badge: 'نقطه پایان (انقضای مهلت و برگ قطعی)',
          bg: 'bg-rose-950/40',
          border: 'border-rose-700/60',
          text: 'text-rose-300',
          dotBg: 'bg-rose-500',
          icon: <Hourglass className="w-4 h-4 text-rose-400" />,
          callout: 'عدم ثبت اعتراض یا عدم اقدام مودی در مهلت قانونی موجب انقضا، قطعیت مالیات و صدور برگ قطعی توسط سامانه مالیاتی می‌گردد.',
        }
      case 'FINAL_NOTICE_ISSUANCE':
        return {
          badge: 'صدور برگه قطعی مالیاتی',
          bg: 'bg-blue-950/40',
          border: 'border-blue-700/60',
          text: 'text-blue-300',
          dotBg: 'bg-blue-500',
          icon: <FileText className="w-4 h-4 text-blue-400" />,
          callout: 'صدور رسمی برگ قطعی پرونده مالیاتی و ارجاع به واحد اجرا و وصول.',
        }
      case 'NEXT_STAGE':
        return {
          badge: 'انتقال به مرحله بعدی',
          bg: 'bg-sky-950/40',
          border: 'border-sky-700/60',
          text: 'text-sky-300',
          dotBg: 'bg-sky-500',
          icon: <GitBranch className="w-4 h-4 text-sky-400" />,
          callout: 'در صورت عدم حصول توافق یا عدم تمکین، پرونده جهت رسیدگی به هیأت بدوی/تجدیدنظر/دیوان ارجاع داده می‌شود.',
        }
      default:
        return {
          badge: nature || 'مرحله اصلی و الزامی',
          bg: 'bg-zinc-900/80',
          border: 'border-zinc-700/80',
          text: 'text-zinc-200',
          dotBg: 'bg-[#E5A93C]',
          icon: <CheckCircle2 className="w-4 h-4 text-[#E5A93C]" />,
          callout: null,
        }
    }
  }

  return (
    <AnimatePresence>
      {isOpen && template && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
            className="w-full max-w-3xl rounded-2xl border border-zinc-800 p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: '#1c1917' }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-zinc-800 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/40 flex items-center justify-center flex-shrink-0">
                  <GitBranch className="w-6 h-6 text-[#E5A93C]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#E5A93C] bg-[#E5A93C]/10 px-2 py-0.5 rounded-md border border-[#E5A93C]/30">
                      نقشه راه و روندنما
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {template.steps?.length || 0} گام تعاملی
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    روند اجرایی اعتراض: {template.template_name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Toolbar for Responsible Party */}
            <div className="mt-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                <Filter className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>فیلتر بر اساس مرجع اقدام:</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveActorFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    activeActorFilter === 'ALL'
                      ? 'bg-[#E5A93C] text-black shadow'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  همه مراحل ({template.steps?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActorFilter('TAXPAYER')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    activeActorFilter === 'TAXPAYER'
                      ? 'bg-emerald-500 text-black shadow'
                      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/50'
                  }`}
                >
                  <User className="w-3 h-3" />
                  مودی
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActorFilter('TAX_AUTHORITY')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    activeActorFilter === 'TAX_AUTHORITY'
                      ? 'bg-amber-500 text-black shadow'
                      : 'bg-amber-950/40 text-amber-300 border border-amber-800/60 hover:bg-amber-900/50'
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  سازمان مالیاتی
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActorFilter('COURT_DIVAN')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    activeActorFilter === 'COURT_DIVAN'
                      ? 'bg-cyan-500 text-black shadow'
                      : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900/50'
                  }`}
                >
                  <Scale className="w-3 h-3" />
                  دیوان عدالت
                </button>
              </div>
            </div>

            {/* Linked Obligations Summary */}
            {linkedObligations.length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-[#E5A93C] flex-shrink-0" />
                <span className="text-zinc-400">تکالیف مرتبط با این الگو:</span>
                <span className="text-zinc-200 font-semibold">
                  {linkedObligations.map((o) => o.title).join(' ، ')}
                </span>
              </div>
            )}

            {/* Timeline Content Body */}
            <div className="flex-1 overflow-y-auto py-6 pr-2 pl-2 space-y-6 style-menu">
              {stepsToDisplay.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  هیچ گامی با فیلتر انتخاب شده یافت نشد.
                </div>
              ) : (
                <motion.div
                  key={activeActorFilter}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="relative pr-6 border-r-2 border-zinc-800 space-y-6"
                >
                  {stepsToDisplay.map((step, index) => {
                    const config = getNatureConfig(step.step_nature)
                    const actorConfig = getActorConfig(step.actor)

                    return (
                      <motion.div
                        key={step.id || index}
                        variants={itemVariants}
                        className="relative group"
                      >
                        {/* Timeline Dot / Node */}
                        <div
                          className={`absolute -right-[31px] top-1.5 w-4 h-4 rounded-full ${config.dotBg} ring-4 ring-[#1c1917] flex items-center justify-center shadow-lg`}
                        />

                        {/* Step Card */}
                        <div className={`p-4 rounded-xl border ${config.bg} ${config.border} shadow-sm transition-all hover:border-zinc-700`}>
                          {/* Step Title & Nature Header */}
                          <div className="flex items-start justify-between gap-3 pb-2 border-b border-zinc-800/60 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                گام #{index + 1}
                              </span>
                              <h4 className="text-sm font-bold text-white">{step.title}</h4>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${actorConfig.bg} ${actorConfig.border} ${actorConfig.text}`}>
                                {actorConfig.icon}
                                {actorConfig.badge}
                              </span>

                              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${config.bg} ${config.border} ${config.text}`}>
                                {config.icon}
                                {config.badge}
                              </span>
                            </div>
                          </div>

                          {/* Step Timing & Base Event Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                            <div className="flex items-center gap-2 text-zinc-300 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
                              <Clock className="w-3.5 h-3.5 text-[#E5A93C] flex-shrink-0" />
                              <span>
                                مهلت قانونی: <strong className="text-white font-bold">{step.gap_value} {step.gap_unit}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-zinc-300 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
                              <CalendarClock className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                              <span>
                                مبنا: <strong className="text-zinc-200">{step.base_event}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Step Note / Executive Guideline */}
                          {step.note && (
                            <div className="mt-2.5 p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-2 leading-relaxed">
                              <Info className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-zinc-200">راهنمای اجرایی: </span>
                                {step.note}
                              </div>
                            </div>
                          )}

                          {/* Callout Notice for special natures */}
                          {config.callout && (
                            <div className="mt-2.5 p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-2 leading-relaxed">
                              {config.icon}
                              <span>{config.callout}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <Button
                type="button"
                onClick={onClose}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-6 h-9"
              >
                بستن روندنما
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { ObjectionTimelineModal as TaxWorkflowTimeline }

