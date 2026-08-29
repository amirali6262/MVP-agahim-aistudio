import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  ListChecks,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '../../../lib/shadcn/button'
import { Input } from '../../../lib/shadcn/input'
import { Label } from '../../../lib/shadcn/label'
import { Badge } from '../../../lib/shadcn/badge'
import FullScreenDialog from '../../../components/FullScreenDialog'
import { fetchChecklistTemplates, createChecklistTemplate, updateChecklistTemplate, deleteChecklistTemplate } from '../../../lib/supabaseDb'
import type { ChecklistSection, ChecklistItem, ChecklistImportance } from '../../../lib/supabase'
import type { ChecklistTemplate } from '../../../lib/supabaseDb'

export default function ChecklistAdminPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null)

  // Form state for creating/editing template
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('اظهارنامه عملکرد')
  const [fiscalYear, setFiscalYear] = useState('1403')
  const [sections, setSections] = useState<ChecklistSection[]>([])

  const loadTemplates = async () => {
    const list = await fetchChecklistTemplates()
    setTemplates(list)
    if (list.length > 0 && !selectedTemplate) {
      setSelectedTemplate(list[0])
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleOpenAdd = () => {
    setEditingTemplate(null)
    setTitle('چک‌لیست جدید کنترلی مالیاتی')
    setDescription('توضیحات و راهنمای ممیزی جهت ارائه به کاربران شرکت‌ها...')
    setCategory('اظهارنامه عملکرد')
    setFiscalYear('1403')
    setSections([
      {
        id: 'sec-' + Date.now(),
        title: '۱. بخش اول کنترلی',
        items: [
          {
            id: 'item-' + Date.now(),
            code: '۱-۱',
            title: 'مورد جدید جهت بررسی',
            importance: 'HIGH',
          },
        ],
      },
    ])
    setModalOpen(true)
  }

  const handleOpenEdit = (tpl: ChecklistTemplate) => {
    setEditingTemplate(tpl)
    setTitle(tpl.title)
    setDescription(tpl.description || '')
    setCategory(tpl.category)
    setFiscalYear(tpl.fiscal_year || '1403')
    setSections(JSON.parse(JSON.stringify(tpl.sections)))
    setModalOpen(true)
  }

  const handleDeleteTemplate = async (id: string, itemTitle: string) => {
    if (confirm(`آیا از حذف چک‌لیست "${itemTitle}" اطمینان دارید؟`)) {
      await deleteChecklistTemplate(id)
      toast.success('چک‌لیست با موفقیت حذف شد.')
      loadTemplates()
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null)
      }
    }
  }

  // Section manipulation in modal
  const handleAddSection = () => {
    const nextNum = sections.length + 1
    setSections([
      ...sections,
      {
        id: 'sec-' + Date.now(),
        title: `${nextNum}. بخش کنترلی جدید`,
        items: [
          {
            id: 'item-' + Date.now(),
            code: `${nextNum}-۱`,
            title: 'کنترل جدید',
            importance: 'HIGH',
          },
        ],
      },
    ])
  }

  const handleRemoveSection = (secIdx: number) => {
    if (sections.length <= 1) {
      toast.error('حداقل یک بخش برای چک‌لیست الزامی است.')
      return
    }
    const updated = [...sections]
    updated.splice(secIdx, 1)
    setSections(updated)
  }

  const handleAddItem = (secIdx: number) => {
    const updated = [...sections]
    const sec = updated[secIdx]
    const itemNum = sec.items.length + 1
    sec.items.push({
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      code: `${secIdx + 1}-${itemNum}`,
      title: 'کنترل جدید...',
      importance: 'HIGH',
    })
    setSections(updated)
  }

  const handleRemoveItem = (secIdx: number, itemIdx: number) => {
    const updated = [...sections]
    if (updated[secIdx].items.length <= 1) {
      toast.error('هر بخش باید حداقل یک بند کنترلی داشته باشد.')
      return
    }
    updated[secIdx].items.splice(itemIdx, 1)
    setSections(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('عنوان چک‌لیست الزامی است.'); return }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      fiscal_year: fiscalYear,
      sections,
      is_active: true,
    }

    if (editingTemplate) {
      await updateChecklistTemplate(editingTemplate.id, payload)
      toast.success('چک‌لیست با موفقیت بروزرسانی شد.')
    } else {
      await createChecklistTemplate(payload)
      toast.success('چک‌لیست جدید با موفقیت طراحی و ذخیره گردید.')
    }

    setModalOpen(false)
    loadTemplates()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Top Banner Header */}
      <div
        className="rounded-2xl border border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg"
        style={{ background: '#211d1a' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E5A93C]">
            <CheckSquare className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl flex items-center gap-2">
              طراحی و مدیریت چک‌لیست‌های کنترلی و ویزارد مالیاتی
            </h1>
            <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
              تعریف چک‌لیست‌های استاندارد تسلیم اظهارنامه عملکرد، ارزش افزوده و دفاتر جهت چک و تیک هوشمند توسط کاربران شرکت‌ها
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-10 px-5 shadow-md gap-2"
        >
          <Plus className="w-4 h-4" />
          طراحی چک‌لیست جدید
        </Button>
      </div>

      {/* Main Split Content: List of Templates & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <h2 className="text-zinc-300 font-bold text-sm flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-amber-400" />
            چک‌لیست‌های طراحی‌شده پلتفرم
          </h2>

          <div className="flex flex-col gap-3">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id
              const totalItems = tpl.sections.reduce((acc, sec) => acc + sec.items.length, 0)

              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#E5A93C] bg-amber-950/20 shadow-md ring-1 ring-[#E5A93C]/40'
                      : 'border-zinc-800 bg-[#1c1917] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-bold text-sm leading-snug">{tpl.title}</h3>
                    <Badge className="bg-zinc-800 text-amber-300 border-zinc-700 text-[10px] shrink-0 font-mono">
                      {tpl.fiscal_year}
                    </Badge>
                  </div>

                  <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed mb-3">
                    {tpl.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-zinc-800/80">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      {tpl.sections.length} بخش | {totalItems} بند کنترلی
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEdit(tpl)
                        }}
                        className="text-amber-400 hover:text-white p-1 hover:bg-zinc-800 rounded"
                        title="ویرایش چک‌لیست"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTemplate(tpl.id, tpl.title)
                        }}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-zinc-800 rounded"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Template Detailed View */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="rounded-2xl border border-zinc-800 bg-[#1c1917] p-6 flex flex-col gap-5 shadow-xl">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-amber-500/20 text-[#E5A93C] border-amber-500/30 text-xs">
                      {selectedTemplate.category}
                    </Badge>
                    <span className="text-xs text-zinc-400 font-mono">سال مالی {selectedTemplate.fiscal_year}</span>
                  </div>
                  <h2 className="text-white font-bold text-lg">{selectedTemplate.title}</h2>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed">{selectedTemplate.description}</p>
                </div>

                <Button
                  onClick={() => handleOpenEdit(selectedTemplate)}
                  className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold text-xs h-9 px-4 gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  ویرایش بندهای چک‌لیست
                </Button>
              </div>

              {/* Sections & Items Render */}
              <div className="flex flex-col gap-6">
                {selectedTemplate.sections.map((sec, secIdx) => (
                  <div key={sec.id} className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
                    <h3 className="text-amber-300 font-bold text-sm mb-3 flex items-center gap-2 pb-2 border-b border-zinc-800">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      {sec.title}
                    </h3>

                    <div className="flex flex-col gap-2">
                      {sec.items.map((item: ChecklistItem) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 transition-all text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="font-mono text-amber-400 font-bold shrink-0">{item.code}</span>
                            <span className="text-zinc-200 leading-snug">{item.title}</span>
                          </div>

                          <div className="shrink-0">
                            {item.importance === 'HIGH' && (
                              <Badge className="bg-red-950 border-red-800 text-red-300 text-[10px] gap-1">
                                🔴 ضروری و با اهمیت بالا
                              </Badge>
                            )}
                            {item.importance === 'CONDITIONAL' && (
                              <Badge className="bg-amber-950 border-amber-800 text-amber-300 text-[10px] gap-1">
                                🟠 ضروری حسب مورد
                              </Badge>
                            )}
                            {item.importance === 'SUPPLEMENTARY' && (
                              <Badge className="bg-yellow-950/60 border-yellow-800/60 text-yellow-300 text-[10px] gap-1">
                                🟡 کنترلی و تکمیلی
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-zinc-500 text-xs bg-[#1c1917] rounded-2xl border border-zinc-800">
              یک چک‌لیست را جهت مشاهده بندها انتخاب کنید.
            </div>
          )}
        </div>
      </div>

      {/* Modal for Creating / Editing Template */}
      {modalOpen && (
        <FullScreenDialog
          open
          title={editingTemplate ? 'ویرایش ساختار چک‌لیست' : 'طراحی چک‌لیست مالیاتی جدید'}
          subtitle="تعریف بخش‌ها و بندهای کنترلی چک‌لیست و انتشار آن"
          onBack={() => setModalOpen(false)}
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-10 font-medium text-xs"
              >
                انصراف
              </Button>
              <Button
                type="submit"
                form="checklist-template-form"
                className="bg-[#E5A93C] hover:bg-[#d49a2d] text-[#181614] font-bold h-10 text-xs px-6 shadow"
              >
                ذخیره و انتشار چک‌لیست
              </Button>
            </div>
          }
        >
          <form id="checklist-template-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">عنوان چک‌لیست</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="عنوان چک‌لیست..."
                    className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-white font-medium text-xs">دسته‌بندی مالیاتی</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="اظهارنامه عملکرد / ارزش افزوده / سامانه مودیان"
                    className="bg-zinc-900 border-zinc-700 text-white h-10 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-white font-medium text-xs">توضیحات و راهنما</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="راهنمای کاربردی برای ممیزان و حسابداران شرکت..."
                  className="bg-zinc-900 border border-zinc-700 text-white rounded-lg p-2.5 text-xs h-16 resize-none"
                />
              </div>

              {/* Sections & Items Editor */}
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-amber-300 font-bold text-xs">بخش‌ها و بندهای کنترلی:</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSection}
                    className="border-zinc-700 text-amber-300 hover:bg-zinc-800 h-8 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن بخش جدید
                  </Button>
                </div>

                {sections.map((sec, secIdx) => (
                  <div key={sec.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/90 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={sec.title}
                        onChange={(e) => {
                          const updated = [...sections]
                          updated[secIdx].title = e.target.value
                          setSections(updated)
                        }}
                        className="bg-zinc-800 border-zinc-700 text-amber-300 font-bold h-9 text-xs w-full max-w-md"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSection(secIdx)}
                        className="text-red-400 hover:bg-red-950/40 h-8 text-xs"
                      >
                        حذف بخش
                      </Button>
                    </div>

                    {/* Items inside section */}
                    <div className="flex flex-col gap-2 pl-2">
                      {sec.items.map((item, itemIdx) => (
                        <div key={item.id} className="flex items-center gap-2 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800">
                          <Input
                            value={item.code}
                            onChange={(e) => {
                              const updated = [...sections]
                              updated[secIdx].items[itemIdx].code = e.target.value
                              setSections(updated)
                            }}
                            className="bg-zinc-900 border-zinc-700 text-amber-400 font-mono font-bold h-8 text-xs w-16 text-center"
                          />

                          <Input
                            value={item.title}
                            onChange={(e) => {
                              const updated = [...sections]
                              updated[secIdx].items[itemIdx].title = e.target.value
                              setSections(updated)
                            }}
                            className="bg-zinc-900 border-zinc-700 text-white h-8 text-xs flex-1"
                          />

                          <select
                            value={item.importance}
                            onChange={(e) => {
                              const updated = [...sections]
                              updated[secIdx].items[itemIdx].importance = e.target.value as ChecklistImportance
                              setSections(updated)
                            }}
                            className="bg-zinc-900 border border-zinc-700 text-white text-[11px] rounded h-8 px-2"
                          >
                            <option value="HIGH">🔴 ضروری با اهمیت بالا</option>
                            <option value="CONDITIONAL">🟠 ضروری حسب مورد</option>
                            <option value="SUPPLEMENTARY">🟡 کنترلی و تکمیلی</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(secIdx, itemIdx)}
                            className="text-red-400 hover:text-red-300 px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddItem(secIdx)}
                        className="text-amber-400 hover:bg-zinc-800 h-7 text-[11px] self-start mt-1 gap-1"
                      >
                        <Plus className="w-3 h-3" /> افزودن بند به این بخش
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

            </form>
        </FullScreenDialog>
      )}
    </div>
  )
}
