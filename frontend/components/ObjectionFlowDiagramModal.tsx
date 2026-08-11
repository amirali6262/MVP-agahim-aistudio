import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Workflow,
  User,
  Building2,
  Scale,
  Clock,
  Layers,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  CheckCircle2,
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '../lib/shadcn/button'
import type { ObjectionTemplate, ObjectionStep, StepActor, ObjectionStepNature, Obligation } from '../lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  template: ObjectionTemplate | null
  linkedObligations?: Obligation[]
}

// ---------------------------------------------------------------------------
// Helpers for Colors according to User Specification:
// 1. مودی (Taxpayer) => Red (قرمز)
// 2. سازمان مالیاتی (Tax Authority) => Green (سبز)
// 3. دیوان (Court / Divan) => Yellow (زرد)
// ---------------------------------------------------------------------------

export function resolveStepActor(step: ObjectionStep): StepActor {
  if (step.actor) return step.actor

  const title = step.title || ''
  const note = step.note || ''
  const text = `${title} ${note}`

  if (text.includes('دیوان') || text.includes('۲۵۱ مکرر') || step.step_nature === 'NEXT_STAGE') {
    if (text.includes('دیوان') || text.includes('وزیر')) return 'COURT_DIVAN'
  }
  if (
    text.includes('مودی') ||
    text.includes('ثبت اعتراض') ||
    text.includes('تمکین') ||
    text.includes('تقاضا') ||
    text.includes('پرداخت') ||
    text.includes('شکایت')
  ) {
    return 'TAXPAYER'
  }
  return 'TAX_AUTHORITY'
}

export function getActorTheme(actor: StepActor) {
  switch (actor) {
    case 'TAXPAYER': // مودی => قرمز (Red)
      return {
        label: 'مودی مالیاتی',
        bg: 'bg-red-950/80',
        border: 'border-red-500',
        nodeBg: 'bg-red-600',
        ring: 'ring-red-500/40',
        text: 'text-red-300',
        lightText: 'text-red-200',
        badgeBg: 'bg-red-900/60 text-red-200 border-red-700/80',
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
        icon: <User className="w-4 h-4 text-red-300" />,
        dotColor: '#ef4444',
      }
    case 'COURT_DIVAN': // دیوان => زرد (Yellow)
      return {
        label: 'دیوان عدالت اداری / مرجع عالی',
        bg: 'bg-amber-950/80',
        border: 'border-amber-400',
        nodeBg: 'bg-amber-500',
        ring: 'ring-amber-400/40',
        text: 'text-amber-300',
        lightText: 'text-amber-200',
        badgeBg: 'bg-amber-900/60 text-amber-200 border-amber-600/80',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
        icon: <Scale className="w-4 h-4 text-amber-300" />,
        dotColor: '#f59e0b',
      }
    case 'TAX_AUTHORITY': // سازمان مالیاتی => سبز (Green)
    default:
      return {
        label: 'سازمان امور مالیاتی',
        bg: 'bg-emerald-950/80',
        border: 'border-emerald-500',
        nodeBg: 'bg-emerald-600',
        ring: 'ring-emerald-500/40',
        text: 'text-emerald-300',
        lightText: 'text-emerald-200',
        badgeBg: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/80',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
        icon: <Building2 className="w-4 h-4 text-emerald-300" />,
        dotColor: '#10b981',
      }
  }
}

export function getNatureBadge(nature?: ObjectionStepNature) {
  switch (nature) {
    case 'MANDATORY':
      return { label: 'مرحله اصلی و الزامی', color: 'bg-blue-900/60 text-blue-300 border-blue-700' }
    case 'CONDITIONAL_EXPERT':
      return { label: 'مشروط (قرار کارشناسی)', color: 'bg-amber-900/60 text-amber-300 border-amber-700' }
    case 'AGREEMENT_END':
      return { label: 'خاتمه: توافق', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' }
    case 'SETTLEMENT_END':
      return { label: 'خاتمه: تمکین', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' }
    case 'EXPIRED_END':
      return { label: 'خاتمه: انقضای مهلت', color: 'bg-red-900/60 text-red-300 border-red-700' }
    case 'FINAL_NOTICE_ISSUANCE':
      return { label: 'صدور برگه قطعی', color: 'bg-purple-900/60 text-purple-300 border-purple-700' }
    case 'NEXT_STAGE':
      return { label: 'ارجاع به مرحله بعد', color: 'bg-cyan-900/60 text-cyan-300 border-cyan-700' }
    default:
      return { label: 'مرحله فرایند', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' }
  }
}

// Framer Motion Animation Variants
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 18 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: 'easeOut' as const,
      staggerChildren: 0.04,
      delayChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 12,
    transition: { duration: 0.2 },
  },
}

const nodeVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
}

export default function ObjectionFlowDiagramModal({
  isOpen,
  onClose,
  template,
  linkedObligations = [],
}: Props) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | StepActor>('ALL')
  const [selectedStep, setSelectedStep] = useState<ObjectionStep | null>(null)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [viewMode, setViewMode] = useState<'TREE' | 'GRID'>('TREE')

  if (!template) return null

  const steps = template.steps || []

  // Auto select first step if none selected
  const currentStep = selectedStep || steps[0] || null

  const filteredSteps = steps.filter((s) => {
    if (activeFilter === 'ALL') return true
    return resolveStepActor(s) === activeFilter
  })

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.5))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.7))
  const handleResetZoom = () => setZoomLevel(1)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-7xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-800 bg-[#191614] text-white shadow-2xl overflow-hidden z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C]">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#E5A93C] bg-[#E5A93C]/10 px-2 py-0.5 rounded-full border border-[#E5A93C]/20">
                      نمودار درختی / روندنما
                    </span>
                    <span className="text-xs text-zinc-400">({steps.length} گام تعاملی)</span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5">{template.template_name}</h2>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center bg-zinc-950/80 border border-zinc-800 rounded-lg p-1 gap-1 text-xs">
                  <button
                    onClick={() => setViewMode('TREE')}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                      viewMode === 'TREE'
                        ? 'bg-[#E5A93C] text-black font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    نمودار درختی
                  </button>
                  <button
                    onClick={() => setViewMode('GRID')}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                      viewMode === 'GRID'
                        ? 'bg-[#E5A93C] text-black font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    شبکه‌ای
                  </button>
                </div>

                <div className="hidden sm:flex items-center bg-zinc-950/80 border border-zinc-800 rounded-lg p-1 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    title="کوچک‌نمایی"
                    className="w-7 h-7 text-zinc-300 hover:bg-zinc-800"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-[11px] font-mono text-amber-400 px-1">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    title="بزرگ‌نمایی"
                    className="w-7 h-7 text-zinc-300 hover:bg-zinc-800"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetZoom}
                    title="بازنشانی زوم"
                    className="w-7 h-7 text-zinc-300 hover:bg-zinc-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="w-9 h-9 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Legend & Filter Bar */}
            <div className="px-6 py-3 border-b border-zinc-800/60 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-zinc-400 font-medium">راهنمای رنگ مراجع:</span>
                
                {/* Red: Taxpayer */}
                <button
                  onClick={() => setActiveFilter(activeFilter === 'TAXPAYER' ? 'ALL' : 'TAXPAYER')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                    activeFilter === 'TAXPAYER'
                      ? 'bg-red-950 border-red-500 text-red-200 ring-2 ring-red-500/40'
                      : 'bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/40'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.8)] inline-block" />
                  <span className="font-bold">تکالیف مودی (قرمز)</span>
                </button>

                {/* Green: Tax Authority */}
                <button
                  onClick={() => setActiveFilter(activeFilter === 'TAX_AUTHORITY' ? 'ALL' : 'TAX_AUTHORITY')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                    activeFilter === 'TAX_AUTHORITY'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/40'
                      : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.8)] inline-block" />
                  <span className="font-bold">تکالیف سازمان مالیاتی (سبز)</span>
                </button>

                {/* Yellow: Court / Divan */}
                <button
                  onClick={() => setActiveFilter(activeFilter === 'COURT_DIVAN' ? 'ALL' : 'COURT_DIVAN')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                    activeFilter === 'COURT_DIVAN'
                      ? 'bg-amber-950 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                      : 'bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/40'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] inline-block" />
                  <span className="font-bold">تکالیف دیوان / مرجع عالی (زرد)</span>
                </button>

                {activeFilter !== 'ALL' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveFilter('ALL')}
                    className="text-zinc-400 hover:text-white h-7 px-2 text-[11px]"
                  >
                    نمایش همه
                  </Button>
                )}
              </div>

              {linkedObligations.length > 0 && (
                <div className="text-zinc-400 text-xs">
                  متصل به <span className="text-[#E5A93C] font-bold">{linkedObligations.length}</span> تکلیف قانونی
                </div>
              )}
            </div>

            {/* Main Interactive Canvas & Detail Split Area */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-zinc-950/80">
              {/* Flowchart Diagram Canvas Area */}
              <div className="flex-1 overflow-auto p-6 relative style-menu border-b lg:border-b-0 lg:border-l border-zinc-800/80">
                <div
                  className="min-w-[750px] transition-transform origin-top-right duration-200 ease-out"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  {viewMode === 'TREE' ? (
                    <div className="flex flex-col gap-8 pb-10">
                      {/* Flowchart Tree Rows */}
                      {filteredSteps.map((step, idx) => {
                        const actor = resolveStepActor(step)
                        const theme = getActorTheme(actor)
                        const isSelected = currentStep?.id === step.id
                        const nature = getNatureBadge(step.step_nature)
                        const isConditional = step.step_nature === 'CONDITIONAL_EXPERT'
                        const isEnd =
                          step.step_nature === 'AGREEMENT_END' || step.step_nature === 'SETTLEMENT_END'

                        return (
                          <motion.div
                            key={step.id}
                            variants={nodeVariants}
                            className="relative flex items-center gap-4 group"
                          >
                            {/* Branch connector line to next step */}
                            {idx < filteredSteps.length - 1 && (
                              <div
                                className="absolute right-6 top-10 w-0.5 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-700 z-0 group-hover:from-amber-500/50"
                                style={{ height: 'calc(100% + 20px)' }}
                              />
                            )}

                            {/* Circular Node Icon (Colored dot according to Actor) */}
                            <button
                              onClick={() => setSelectedStep(step)}
                              className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 transform group-hover:scale-110 ${
                                theme.border
                              } ${theme.bg} ${isSelected ? `${theme.glow} ring-4 ${theme.ring} scale-110` : ''}`}
                            >
                              <span
                                className={`w-4 h-4 rounded-full ${theme.nodeBg} shadow-inner flex items-center justify-center`}
                              >
                                {isSelected && (
                                  <motion.span
                                    layoutId="selected-pulse"
                                    className="w-2 h-2 rounded-full bg-white animate-ping"
                                  />
                                )}
                              </span>
                            </button>

                            {/* Node Card Box */}
                            <div
                              onClick={() => setSelectedStep(step)}
                              className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? `${theme.bg} ${theme.border} ${theme.glow} ring-1 ${theme.ring}`
                                  : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${theme.badgeBg}`}
                                  >
                                    {theme.label}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${nature.color}`}
                                  >
                                    {nature.label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>
                                    {step.gap_value} {step.gap_unit}
                                  </span>
                                </div>
                              </div>

                              <h3 className={`font-bold text-sm md:text-base ${isSelected ? theme.lightText : 'text-white'}`}>
                                {step.title}
                              </h3>

                              <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/60 pt-2">
                                <span>مبنا: {step.base_event}</span>
                                {step.note && (
                                  <span className="text-zinc-500 truncate max-w-xs">{step.note}</span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  ) : (
                    /* Grid Mode View */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                      {filteredSteps.map((step) => {
                        const actor = resolveStepActor(step)
                        const theme = getActorTheme(actor)
                        const isSelected = currentStep?.id === step.id
                        const nature = getNatureBadge(step.step_nature)

                        return (
                          <motion.div
                            key={step.id}
                            variants={nodeVariants}
                            onClick={() => setSelectedStep(step)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${
                              isSelected
                                ? `${theme.bg} ${theme.border} ${theme.glow}`
                                : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${theme.badgeBg}`}
                              >
                                {theme.label}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${nature.color}`}
                              >
                                {nature.label}
                              </span>
                            </div>

                            <h4 className="font-bold text-sm text-white mb-2">{step.title}</h4>

                            <div className="text-xs text-zinc-400 space-y-1">
                              <div>مهلت: <span className="text-amber-400 font-bold">{step.gap_value} {step.gap_unit}</span></div>
                              <div>مبنا: {step.base_event}</div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Step Detail Inspector Sidebar */}
              <div className="w-full lg:w-96 p-6 bg-zinc-900/90 border-t lg:border-t-0 border-zinc-800 overflow-y-auto flex flex-col justify-between">
                {currentStep ? (
                  <div className="space-y-5">
                    {/* Header info */}
                    <div className="pb-4 border-b border-zinc-800">
                      <div className="flex items-center gap-2 mb-2">
                        {(() => {
                          const actor = resolveStepActor(currentStep)
                          const theme = getActorTheme(actor)
                          return (
                            <span
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${theme.badgeBg}`}
                            >
                              {theme.icon}
                              {theme.label}
                            </span>
                          )
                        })()}
                        {(() => {
                          const nature = getNatureBadge(currentStep.step_nature)
                          return (
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${nature.color}`}
                            >
                              {nature.label}
                            </span>
                          )
                        })()}
                      </div>

                      <h3 className="text-base font-bold text-white leading-snug">
                        {currentStep.title}
                      </h3>
                    </div>

                    {/* Step Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                        <div className="text-[11px] text-zinc-400 mb-1">مهلت قانونی اقدام</div>
                        <div className="text-base font-bold text-[#E5A93C] flex items-center gap-1">
                          <Clock className="w-4 h-4 text-[#E5A93C]" />
                          <span>
                            {currentStep.gap_value} {currentStep.gap_unit}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                        <div className="text-[11px] text-zinc-400 mb-1">مبنای شروع مهلت</div>
                        <div className="text-xs font-semibold text-zinc-200 truncate">
                          {currentStep.base_event}
                        </div>
                      </div>
                    </div>

                    {/* Description & Legal Guidance */}
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <Info className="w-4 h-4 text-amber-400" />
                        <span>راهنمای اجرا و تکالیف مربوطه</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {currentStep.note ||
                          'اقدام لازم در این گام باید دقیقاً مطابق با تشریفات قانونی و در مهلت مقرر صورت پذیرد.'}
                      </p>
                    </div>

                    {/* Action Color Guide in Details */}
                    {(() => {
                      const actor = resolveStepActor(currentStep)
                      const theme = getActorTheme(actor)
                      return (
                        <div className={`p-3 rounded-xl border text-xs ${theme.bg} ${theme.border}`}>
                          <div className="font-bold text-white mb-1">مسئول اقدام این گام:</div>
                          <div className={theme.text}>{theme.label}</div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="p-6 text-center text-zinc-500 text-xs">
                    جهت مشاهده جزئیات کامل، بر روی یکی از گام‌های نمودار درختی کلیک کنید.
                  </div>
                )}

                {/* Modal Footer Close */}
                <div className="pt-6 border-t border-zinc-800/80 mt-6">
                  <Button
                    onClick={onClose}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold h-10 rounded-xl"
                  >
                    بستن روندنما
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
