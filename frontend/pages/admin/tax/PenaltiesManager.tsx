import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Plus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../lib/shadcn/select'
import { mockObligationsDb } from '../../../lib/mockDb'
import type { Obligation, PenaltyItem } from '../../../lib/supabase'
import DeleteGuardModal from '../../../components/DeleteGuardModal'
import type { DependencyCheckResult } from '../../../lib/dependencyChecker'

interface Props {
  obligation: Obligation
  onBack: () => void
  onSaved: () => void
}

const PENALTY_TYPE_OPTIONS = ['درصدی/روزشمار', 'مبلغ ثابت', 'لغو مجوز/ممنوع‌الخروجی']
const CALC_UNIT_OPTIONS = ['در روز', 'در ماه', 'یکجا']
const CALC_BASE_OPTIONS = ['مبلغ اصل مالیات', 'مبلغ معاملات', 'روزهای تاخیر']

export default function PenaltiesManager({ obligation, onBack, onSaved }: Props) {
  const [penalties, setPenalties] = useState<PenaltyItem[]>(
    obligation.penalties && obligation.penalties.length > 0
      ? obligation.penalties
      : [
          {
            id: 'p-' + Date.now(),
            penalty_type: 'درصدی/روزشمار',
            rate_or_amount: 2.5,
            calc_unit: 'در ماه',
            calc_base: 'مبلغ اصل مالیات',
            cap_limit: null,
            legal_clause: 'ماده ۱۹۰ ق.م.م',
          },
        ]
  )
  const [saving, setSaving] = useState(false)

  const handleAddRow = () => {
    const newItem: PenaltyItem = {
      id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      penalty_type: 'درصدی/روزشمار',
      rate_or_amount: 0,
      calc_unit: 'یکجا',
      calc_base: 'مبلغ اصل مالیات',
      cap_limit: null,
      legal_clause: '',
    }
    setPenalties((prev) => [...prev, newItem])
  }

  // Delete Guard State
  const [itemToDelete, setItemToDelete] = useState<PenaltyItem | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const handleInitiateDeleteRow = (item: PenaltyItem) => {
    setItemToDelete(item)
    setDeleteModalOpen(true)
  }

  const handleConfirmDeleteRow = () => {
    if (!itemToDelete) return
    setPenalties((prev) => prev.filter((p) => p.id !== itemToDelete.id))
    toast.success('قانون جریمه با موفقیت حذف شد.')
    setDeleteModalOpen(false)
    setItemToDelete(null)
  }

  const handleDeleteRow = (id: string) => {
    setPenalties((prev) => prev.filter((p) => p.id !== id))
  }

  const handleUpdateField = (id: string, key: keyof PenaltyItem, value: any) => {
    setPenalties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    )
  }

  const handleSave = () => {
    setSaving(true)
    const updated = mockObligationsDb.update(obligation.id, { penalties })
    if (updated) {
      toast.success('جرایم با موفقیت ذخیره شدند.')
      onSaved()
    } else {
      toast.error('خطا در ذخیره جرایم.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#0a0c0b' }}>
      {/* Sticky Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 h-16 border-b border-zinc-800"
        style={{ background: '#141615' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-zinc-100 font-bold text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              مدیریت جرایم تکلیف: {obligation.title}
            </h2>
            <p className="text-zinc-500 text-xs">تعریف قوانین جریمه و ماده‌های مربوطه</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9"
          >
            انصراف
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-2 h-9 px-6"
          >
            <Save className="w-4 h-4" />
            ذخیره جرایم
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-200/90 leading-relaxed">
            در این بخش می‌توانید انواع جرایم متعلقه به عدم انجام یا تأخیر در این تکلیف را تعریف کنید. این فرم قوانین محاسبه جریمه را به صورت داینامیک ثبت و ذخیره می‌کند.
          </div>
        </div>

        {penalties.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 p-12 text-center bg-zinc-900/50">
            <p className="text-zinc-400 text-sm mb-4">هیچ جریمه‌ای تعریف نشده است.</p>
            <Button
              onClick={handleAddRow}
              className="bg-amber-600 hover:bg-amber-500 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              افزودن اولین جریمه
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {penalties.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 p-6 relative transition-all hover:border-zinc-700"
                style={{ background: '#141615' }}
              >
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
                  <span className="text-amber-400 font-semibold text-sm">
                    قانون جریمه #{index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInitiateDeleteRow(item)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8 px-2"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 ml-1" />
                    حذف جریمه
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* ۱. نوع جریمه */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300 text-xs">نوع جریمه</Label>
                    <Select
                      value={item.penalty_type}
                      onValueChange={(v) => handleUpdateField(item.id, 'penalty_type', v)}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700 style-menu" style={{ background: '#1e2020' }}>
                        {PENALTY_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o} className="text-zinc-100 focus:bg-zinc-700">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ۲. نرخ/مقدار جریمه */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300 text-xs">نرخ / مقدار جریمه</Label>
                    <Input
                      type="number"
                      step="any"
                      value={item.rate_or_amount}
                      onChange={(e) =>
                        handleUpdateField(item.id, 'rate_or_amount', parseFloat(e.target.value) || 0)
                      }
                      placeholder="مثال: ۲.۵"
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 h-10 text-sm"
                      dir="ltr"
                    />
                  </div>

                  {/* ۳. واحد محاسبه */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300 text-xs">واحد محاسبه</Label>
                    <Select
                      value={item.calc_unit}
                      onValueChange={(v) => handleUpdateField(item.id, 'calc_unit', v)}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                        {CALC_UNIT_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o} className="text-zinc-100 focus:bg-zinc-700">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ۴. مبنای محاسبه */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300 text-xs">مبنای محاسبه</Label>
                    <Select
                      value={item.calc_base}
                      onValueChange={(v) => handleUpdateField(item.id, 'calc_base', v)}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700" style={{ background: '#1e2020' }}>
                        {CALC_BASE_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o} className="text-zinc-100 focus:bg-zinc-700">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ۵. سقف جریمه (اختیاری) */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300 text-xs">سقف جریمه (درصد یا مبلغ - اختیاری)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={item.cap_limit ?? ''}
                      onChange={(e) =>
                        handleUpdateField(
                          item.id,
                          'cap_limit',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="بدون سقف / مثال: ۵۰"
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 h-10 text-sm"
                      dir="ltr"
                    />
                  </div>

                  {/* ۶. شرح قانون/ماده */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-zinc-300 text-xs">شرح قانون / ماده قانون</Label>
                    <Input
                      value={item.legal_clause ?? ''}
                      onChange={(e) => handleUpdateField(item.id, 'legal_clause', e.target.value)}
                      placeholder="مثال: ماده ۱۹۲ ق.م.م"
                      className="bg-zinc-900 border-zinc-700 text-zinc-100 h-10 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              onClick={handleAddRow}
              className="mt-2 border border-dashed border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 h-12 gap-2"
            >
              <Plus className="w-4 h-4" />
              افزودن جریمه جدید
            </Button>
          </div>
        )}
      </div>

      {/* Delete Guard Modal */}
      {itemToDelete && (
        <DeleteGuardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={`قانون جریمه (${itemToDelete.legal_clause || itemToDelete.penalty_type})`}
          entityType="قانون جریمه"
          checkResult={{
            hasDependencies: false,
            dependencies: [],
          }}
          onConfirmDelete={handleConfirmDeleteRow}
        />
      )}
    </div>
  )
}
