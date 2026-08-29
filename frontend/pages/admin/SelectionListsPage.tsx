import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, Copy, Download, Eye, FileSpreadsheet, FileText, FolderTree,
  Layers, Loader2, Pencil, Plus, RefreshCw, Save, Search, Send, Trash2, Upload, X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Switch } from '../../lib/shadcn/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { supabase } from '../../lib/supabase'
import {
  fetchSelectionLists, saveSelectionList, setSelectionListActive, publishSelectionList,
  deleteSelectionList, saveSelectionListOption, saveSelectionListOptions, deleteSelectionListOption,
  SYSTEM_SOURCES, LIST_STATUS_LABEL, SOURCE_TYPE_LABEL,
  type SelectionList, type SelectionListOption, type SelectionListDesign, type SelectionListSourceType,
} from '../../lib/selectionLists'
import FullScreenDialog from '../../components/FullScreenDialog'
import KeyRegistryField from '../../components/KeyRegistryField'
import { rawFromFullKey, syncRegistryAfterSave } from '../../lib/systemKeys'

const BRAND = '#5B4DE6'

// ── Excel import helpers (shared by wizard step 3 and the options editor) ──
type ImportedRow = { key: string; label: string; parent_key?: string }

function parseExcelBuffer(buf: ArrayBuffer): ImportedRow[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('فایل اکسل شیت ندارد.')
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  if (json.length === 0) throw new Error('فایل اکسل شامل هیچ ردیف داده‌ای نیست (ردیف اول باید سربرگ باشد).')
  const headers = Object.keys(json[0]).map((h) => h.trim().toLowerCase())
  const idxKey = headers.indexOf('key')
  const idxLabel = headers.indexOf('label')
  const idxParent = headers.indexOf('parent_key')
  if (idxKey < 0 || idxLabel < 0) throw new Error('ستون‌های موردنیاز: key و label (اختیاری: parent_key, sort_order, is_active).')
  return json.map((r) => {
    const parent = idxParent >= 0 ? String(r[headers[idxParent]] ?? '').trim() : ''
    return {
      key: String(r[headers[idxKey]] ?? '').trim(),
      label: String(r[headers[idxLabel]] ?? '').trim(),
      parent_key: parent !== '' ? parent : undefined,
    }
  })
}

async function readExcelFile(file: File): Promise<ImportedRow[]> {
  const buf = await file.arrayBuffer()
  return parseExcelBuffer(buf)
}

function downloadExcelSample() {
  const sample: Array<Array<string | number | boolean>> = [
    ['key', 'label', 'parent_key', 'sort_order', 'is_active'],
    ['prov_tehran', 'استان تهران', '', 1, true],
    ['cnt_tehran', 'شهرستان تهران', 'prov_tehran', 1, true],
    ['city_tehran', 'شهر تهران', 'cnt_tehran', 1, true],
    ['city_rey', 'شهر ری', 'cnt_tehran', 2, true],
    ['prov_alborz', 'استان البرز', '', 2, true],
    ['cnt_karaj', 'شهرستان کرج', 'prov_alborz', 1, true],
    ['city_karaj', 'شهر کرج', 'cnt_karaj', 1, true],
    ['city_mahdasht', 'شهر ماهدشت', 'cnt_karaj', 2, true],
  ]
  const ws = XLSX.utils.aoa_to_sheet(sample)
  ws['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'گزینه‌ها')
  XLSX.writeFile(wb, 'نمونه-فهرست-انتخابی.xlsx')
}

// Build a dependent-option tree for preview.
function optionChildren(options: SelectionListOption[], parentId: string | null): SelectionListOption[] {
  return options.filter((o) => (o.parent_option_id ?? null) === parentId).sort((a, b) => a.sort_order - b.sort_order)
}

export default function SelectionListsPage() {
  const [design, setDesign] = useState<SelectionListDesign>({ lists: [], options: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | SelectionListSourceType>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED'>('ALL')

  // List modal (3-step create wizard)
  const [listModalOpen, setListModalOpen] = useState(false)
  const [editingList, setEditingList] = useState<SelectionList | null>(null)
  const [listStep, setListStep] = useState(1)
  const [listForm, setListForm] = useState<Partial<SelectionList>>({})
  const [optionsRows, setOptionsRows] = useState<Array<{ id?: string; key: string; label: string; parent_key?: string; sort_order: number; is_active: boolean }>>([])

  // Options editor modal for a chosen list
  const [optionsList, setOptionsList] = useState<SelectionList | null>(null)

  // Cascade preview
  const [previewList, setPreviewList] = useState<SelectionList | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDesign(await fetchSelectionLists())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'دریافت فهرستها ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const listsById = useMemo(() => {
    const m: Record<string, SelectionList> = {}
    design.lists.forEach((l) => { m[l.id] = l })
    return m
  }, [design.lists])

  const optionsByList = useMemo(() => {
    const m: Record<string, SelectionListOption[]> = {}
    design.options.forEach((o) => { (m[o.list_id] = m[o.list_id] ?? []).push(o) })
    return m
  }, [design.options])

  const filteredLists = useMemo(() => {
    return design.lists.filter((l) => {
      if (typeFilter !== 'ALL' && l.source_type !== typeFilter) return false
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return l.title.toLowerCase().includes(q) || l.key.toLowerCase().includes(q)
    })
  }, [design.lists, query, typeFilter, statusFilter])

  const openCreate = () => {
    setEditingList(null)
    setListStep(1)
    setListForm({ title: '', key: '', description: '', source_type: 'STATIC', is_dependent: false, parent_list_id: null, system_source_key: null, parent_selection_message: '' })
    setOptionsRows([{ key: '', label: '', sort_order: 1, is_active: true }])
    setListModalOpen(true)
  }

  const openEdit = (list: SelectionList) => {
    setEditingList(list)
    setListStep(1)
    setListForm({ ...list })
    setOptionsRows((optionsByList[list.id] ?? []).map((o, i) => ({
      id: o.id, key: o.key, label: o.label, parent_key: o.parent_option_id ?? undefined, sort_order: o.sort_order || i + 1, is_active: o.is_active,
    })))
    setListModalOpen(true)
  }

  const duplicate = async (list: SelectionList) => {
    const draftTitle = `${list.title} (کپی)`
    try {
      const saved = await saveSelectionList({ title: draftTitle, key: (list.key || 'list') + '_copy_' + Date.now(), description: list.description, source_type: list.source_type, is_dependent: list.is_dependent, parent_list_id: list.parent_list_id, system_source_key: list.system_source_key, status: 'DRAFT' })
      if (!saved) throw new Error('ثبت فهرست کپی ناموفق بود.')
      if (list.source_type === 'STATIC') {
        const src = optionsByList[list.id] ?? []
        await saveSelectionListOptions(saved.id!, src.map((o) => ({ key: o.key, label: o.label, parent_option_id: o.parent_option_id, sort_order: o.sort_order, is_active: o.is_active })))
      }
      toast.success('فهرست کپی شد.')
      void load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'کپی فهرست ناموفق بود.') }
  }

  const publishList = async (id: string) => {
    try { await publishSelectionList(id); toast.success('فهرست منتشر شد.'); void load() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'انتشار ناموفق بود.') }
  }

  const toggleActive = async (list: SelectionList) => {
    try { await setSelectionListActive(list.id, !list.is_active); void load() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'تغییر وضعیت ناموفق بود.') }
  }

  const removeList = async (list: SelectionList) => {
    if (!window.confirm(`آیا از حذف فهرست «${list.title}» اطمینان دارید؟ این عمل قابل بازگشت نیست.`)) return
    try { await deleteSelectionList(list.id); toast.success('فهرست حذف شد.'); void load() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'حذف فهرست ناموفق بود (ممکن است استفادهشده باشد).') }
  }

  const persistList = async () => {
    if (!listForm.title?.trim()) return toast.error('عنوان فهرست الزامی است.')
    if (!listForm.key?.trim()) return toast.error('کلید ثابت فهرست الزامی است.')
    if (listForm.source_type === 'STATIC' && listForm.is_dependent && !listForm.parent_list_id) {
      return toast.error('برای فهرست وابسته، فهرست والد الزامی است.')
    }
    if (listForm.source_type === 'SYSTEM' && !listForm.system_source_key) {
      return toast.error('برای منبع پویای سیستم، منبع را انتخاب کنید.')
    }
    try {
      const saved = await saveSelectionList({
        ...(editingList ? { id: editingList.id } : {}),
        title: listForm.title.trim(),
        key: listForm.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''),
        description: listForm.description?.trim() || null,
        source_type: listForm.source_type,
        is_dependent: listForm.is_dependent === true && listForm.source_type === 'STATIC',
        parent_list_id: (listForm.source_type === 'STATIC' && listForm.is_dependent) ? listForm.parent_list_id || null : null,
        system_source_key: listForm.source_type === 'SYSTEM' ? listForm.system_source_key : null,
        parent_selection_message: listForm.parent_selection_message?.trim() || null,
      })
      if (!saved) throw new Error('فهرست ویرایش نشد.')
      // Persist static options
      if (saved.source_type === 'STATIC') {
        const valid = optionsRows.filter((r) => r.key.trim() && r.label.trim())
        await saveSelectionListOptions(saved.id, valid.map((r, i) => ({
          ...(r.id ? { id: r.id } : {}),
          key: r.key.trim(),
          label: r.label.trim(),
          parent_option_id: null,
          sort_order: r.sort_order || i + 1,
          is_active: r.is_active,
        })))
        // Link dependent options by key (same rule as the options editor).
        if (valid.some((r) => r.parent_key)) {
          const { data: savedOpts } = await (supabase as any).from('selection_list_options').select('id,key,parent_option_id').eq('list_id', saved.id)
          const idByKey: Record<string, string> = {}
          ;(savedOpts ?? []).forEach((o: any) => { idByKey[o.key] = o.id })
          for (const r of valid) {
            if (r.parent_key && idByKey[r.key] && idByKey[r.parent_key] && idByKey[r.parent_key] !== idByKey[r.key]) {
              await (supabase as any).from('selection_list_options').update({ parent_option_id: idByKey[r.parent_key] }).eq('id', idByKey[r.key])
            }
          }
        }
      }
      toast.success(editingList ? 'فهرست بهروزرسانی شد.' : 'فهرست ساخته شد.')
      setListModalOpen(false)
      void load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'ذخیره فهرست ناموفق بود.') }
  }

  // ── CSV import (for the options editor) ──
  const [csvText, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState<Array<{ key: string; label: string; parent_key?: string }>>([])
  const [csvError, setCsvError] = useState<string | null>(null)

  const parseCsv = () => {
    setCsvError(null)
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) { setCsvError('CSV باید شامل ردیف سربرگ و حداقل یک ردیف داده باشد.'); setCsvPreview([]); return }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    if (!header.includes('key') || !header.includes('label')) { setCsvError('ستونهای موردنیاز: key و label (اختیاری: parent_key, sort_order, is_active).'); setCsvPreview([]); return }
    const idxKey = header.indexOf('key'); const idxLabel = header.indexOf('label'); const idxParent = header.indexOf('parent_key')
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(',').map((p) => p.trim())
      return { key: parts[idxKey] ?? '', label: parts[idxLabel] ?? '', parent_key: idxParent >= 0 ? parts[idxParent] : undefined }
    })
    const bad = rows.filter((r) => !r.key || !r.label)
    if (bad.length > 0) { setCsvError(`${bad.length.toLocaleString('fa-IR')} ردیف ناقص است (key و label الزامی).`); setCsvPreview([]); return }
    setCsvPreview(rows)
  }

  const applyCsv = async () => {
    if (!optionsList) return
    const dupeKeys = csvPreview.filter((r, i) => csvPreview.findIndex((x) => x.key === r.key) !== i)
    if (dupeKeys.length > 0) { setCsvError('کلید تکراری در CSV وجود دارد.'); return }
    try {
      await saveSelectionListOptions(optionsList.id, csvPreview.map((r, i) => ({ key: r.key, label: r.label, sort_order: i + 1 })))
      toast.success('گزینهها ثبت شد.')
      setCsvText(''); setCsvPreview([]); setOptionsList(null); void load()
    } catch (err) { setCsvError(err instanceof Error ? err.message : 'ثبت CSV ناموفق بود.') }
  }

  // ── Cascade preview state ──
  const [previewSelected, setPreviewSelected] = useState<Record<string, string>>({})

  const renderedParentListId = previewList?.parent_list_id ?? null
  const parentList = renderedParentListId ? listsById[renderedParentListId] : null
  const options = previewList ? (optionsByList[previewList.id] ?? []) : []

  const cascadeDepth = (list: SelectionList | null): number => {
    if (!list || !list.parent_list_id) return 1
    return 1 + cascadeDepth(listsById[list.parent_list_id ?? ''])
  }

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}><Layers className="h-5 w-5" /></span>
          <div>
            <h1 className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">فهرستهای انتخابی</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-6 text-zinc-500 dark:text-zinc-400">
              منبع مرکزی گزینههای کل پلتفرم؛ فهرستهای ثابت (مستقل/وابسته) و پویای سیستم تعریف، مدیریت، پیشنمایش و منتشر میشوند. تمام داده در Supabase ذخیره میشود.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}><Plus className="h-3.5 w-3.5" />ایجاد فهرست</Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-16 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-[#161618]">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND }} /> در حال بارگذاری فهرستها از Supabase...
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <TriangleAlertIcon />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">دریافت فهرستها ناموفق بود</p>
          <p className="max-w-md text-xs leading-6 text-red-600/90 dark:text-red-300/80">{loadError}</p>
          <Button size="sm" onClick={() => void load()} className="gap-2 text-xs text-white" style={{ background: BRAND }}>تلاش دوباره</Button>
        </div>
      ) : (
        <>
          {/* Filter / search bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#161618] sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستوجو با عنوان یا کلید..." dir="rtl" className="h-10 pr-9" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه انواع</SelectItem>
                  <SelectItem value="STATIC">ثابت</SelectItem>
                  <SelectItem value="SYSTEM">پویای سیستم</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه وضعیتها</SelectItem>
                  <SelectItem value="DRAFT">پیشنویس</SelectItem>
                  <SelectItem value="PUBLISHED">منتشرشده</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lists table */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] text-zinc-400 dark:border-zinc-800">
                    <th className="px-5 py-3 font-bold">عنوان</th><th className="px-3 py-3 font-bold">کلید</th>
                    <th className="px-3 py-3 font-bold">نوع</th><th className="px-3 py-3 font-bold">والد</th>
                    <th className="px-3 py-3 font-bold">گزینهها</th><th className="px-3 py-3 font-bold">وضعیت</th>
                    <th className="px-3 py-3 font-bold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLists.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-zinc-400">فهرستی یافت نشد.</td></tr>
                  ) : filteredLists.map((list) => {
                    const parent = list.parent_list_id ? listsById[list.parent_list_id] : null
                    const optCount = (optionsByList[list.id] ?? []).length
                    return (
                      <tr key={list.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/20">
                        <td className="px-5 py-3">
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{list.title}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-400">{list.description ?? '—'}</p>
                        </td>
                        <td className="px-3 py-3"><span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">{list.key}</span></td>
                        <td className="px-3 py-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                          {SOURCE_TYPE_LABEL[list.source_type]}{list.is_dependent ? ' · وابسته' : ''}
                          {list.source_type === 'SYSTEM' && list.system_source_key ? <p className="text-[10px] text-zinc-400">{SYSTEM_SOURCES.find((s) => s.key === list.system_source_key)?.label ?? list.system_source_key}</p> : null}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-zinc-600 dark:text-zinc-300">{parent?.title ?? '—'}</td>
                        <td className="px-3 py-3 text-[11px]">{optCount.toLocaleString('fa-IR')}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${list.status === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/20 dark:text-emerald-300' : list.is_active ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200' : 'border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'}`}>
                            {list.status === 'PUBLISHED' ? 'منتشرشده' : list.is_active ? 'پیشنویس' : 'غیرفعال'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <IconBtn title="ویرایش" onClick={() => openEdit(list)}><Pencil className="h-4 w-4" /></IconBtn>
                            <IconBtn title="کپی" onClick={() => void duplicate(list)}><Copy className="h-4 w-4" /></IconBtn>
                            <IconBtn title="پیشنمایش آبشاری" onClick={() => { setPreviewList(list); setPreviewSelected({}) }}><Eye className="h-4 w-4" /></IconBtn>
                            <IconBtn title="مدیریت گزینهها" onClick={() => { setOptionsList(list); setCsvText(''); setCsvPreview([]); setCsvError(null) }}><FolderTree className="h-4 w-4" /></IconBtn>
                            {list.status !== 'PUBLISHED' && (
                              <IconBtn title="انتشار" onClick={() => void publishList(list.id)}><Send className="h-4 w-4 text-emerald-600" /></IconBtn>
                            )}
                            <IconBtn title={list.is_active ? 'غیرفعال کردن' : 'فعال کردن'} onClick={() => void toggleActive(list)}><RefreshCw className="h-4 w-4" /></IconBtn>
                            {list.status !== 'PUBLISHED' && (
                              <IconBtn title="حذف" danger onClick={() => void removeList(list)}><Trash2 className="h-4 w-4" /></IconBtn>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ── Create/Edit list wizard — full page ── */}
      <FullScreenDialog
        open={listModalOpen}
        title={editingList ? `ویرایش فهرست: ${editingList.title}` : listStep === 1 ? 'ایجاد فهرست · مشخصات' : listStep === 2 ? 'ایجاد فهرست · وابستگی/منبع' : 'ایجاد فهرست · گزینهها'}
        subtitle="فهرست انتخابی مرکزی: ثابت (مستقل یا وابسته) یا پویای سیستم"
        onBack={() => setListModalOpen(false)}
        footer={(
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {listStep > 1 ? (
                <Button variant="outline" size="sm" onClick={() => setListStep(listStep - 1)} className="gap-1 border-zinc-300 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"><ArrowRight className="h-3.5 w-3.5" />قبلی</Button>
              ) : <span />}
              {listStep < (listForm.source_type === 'SYSTEM' ? 2 : 3) ? (
                <Button size="sm" onClick={() => setListStep(listStep + 1)} className="gap-1 text-xs text-white" style={{ background: BRAND }}>بعدی<ArrowLeft className="h-3.5 w-3.5" /></Button>
              ) : (
                <Button size="sm" onClick={() => void persistList()} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}><Save className="h-3.5 w-3.5" />ذخیره فهرست</Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setListModalOpen(false)} className="text-xs text-zinc-400">انصراف</Button>
          </div>
        )}
      >
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
              {listStep === 1 && (
                <>
                  <Field label="عنوان *"><Input value={listForm.title ?? ''} onChange={(e) => setListForm({ ...listForm, title: e.target.value })} className="h-10" placeholder="مثلاً نوع شخصیت" /></Field>
                  <Field label="کلید ثابت *">
                    <KeyRegistryField
                      title={listForm.title ?? ''}
                      entityType="SELECTION_LIST"
                      module="selection"
                      formName={listForm.is_dependent ? 'فهرست وابسته' : 'فهرست مستقل'}
                      initialKey={listForm.key ?? ''}
                      locked={!!editingList && editingList.status === 'PUBLISHED'}
                      lockReason={!!editingList && editingList.status === 'PUBLISHED' ? 'پس از انتشار قابل تغییر نیست' : undefined}
                      sourceTable="selection_lists"
                      sourceRecordId={editingList?.id ?? null}
                      onFullKeyChange={(fullKey) => setListForm({ ...listForm, key: rawFromFullKey(fullKey) })}
                    />
                  </Field>
                  <Field label="توضیح"><textarea rows={2} value={listForm.description ?? ''} onChange={(e) => setListForm({ ...listForm, description: e.target.value })} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100" /></Field>
                  <Field label="نوع منبع">
                    <Select value={listForm.source_type ?? 'STATIC'} disabled={!!editingList && editingList.status === 'PUBLISHED'} onValueChange={(v) => setListForm({ ...listForm, source_type: v as SelectionListSourceType, is_dependent: false, parent_list_id: null, system_source_key: null })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STATIC" className="text-xs">فهرست ثابت (گزینهها دستی)</SelectItem>
                        <SelectItem value="SYSTEM" className="text-xs">منبع پویای سیستم</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {listStep === 2 && (
                listForm.source_type === 'SYSTEM' ? (
                  <div className="space-y-4">
                    <Field label="منبع پویای سیستم *">
                      <Select value={listForm.system_source_key ?? ''} onValueChange={(v) => setListForm({ ...listForm, system_source_key: v })}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="انتخاب منبع..." /></SelectTrigger>
                        <SelectContent>{SYSTEM_SOURCES.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label} ({s.key})</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <p className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] leading-5 text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
                      گزینههای این فهرست بهصورت زنده از همان منبع سیستم دریافت میشوند و نباید دستی وارد شوند. برای منبع پویا، مرحله گزینهها نمایش داده نمیشود.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ToggleField label="وابسته (آبشاری)" checked={listForm.is_dependent ?? false} disabled={!!editingList && editingList.status === 'PUBLISHED'} onChange={(v) => setListForm({ ...listForm, is_dependent: v })} />
                    {listForm.is_dependent && (
                      <>
                        <Field label="فهرست والد">
                          <Select value={listForm.parent_list_id ?? ''} onValueChange={(v) => setListForm({ ...listForm, parent_list_id: v || null })}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="" className="text-xs">—</SelectItem>
                              {design.lists.filter((l) => l.id !== editingList?.id && (l.id === previewList?.id ? true : true)).map((l) => <SelectItem key={l.id} value={l.id} className="text-xs">{l.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="پیام قبل از انتخاب والد"><Input value={listForm.parent_selection_message ?? ''} onChange={(e) => setListForm({ ...listForm, parent_selection_message: e.target.value })} className="h-10" placeholder="ابتدا شهرستان را انتخاب کنید." /></Field>
                      </>
                    )}
                  </div>
                )
              )}

              {listStep === 3 && listForm.source_type === 'STATIC' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-zinc-500">گزینههای فهرست (هر گزینه از کلید ثابت و عنوان نمایشی تشکیل میشود). برای فهرست وابسته، والد با شناسه گزینه ذخیره میشود.</p>
                  {optionsRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input value={row.key} onChange={(e) => { const next = [...optionsRows]; next[index] = { ...next[index], key: e.target.value }; setOptionsRows(next) }} placeholder="کلید (key)" dir="ltr" className="h-9 w-44" />
                      <Input value={row.label} onChange={(e) => { const next = [...optionsRows]; next[index] = { ...next[index], label: e.target.value }; setOptionsRows(next) }} placeholder="عنوان نمایشی (label)" className="h-9 flex-1" />
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-500" onClick={() => setOptionsRows(optionsRows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setOptionsRows([...optionsRows, { key: '', label: '', sort_order: optionsRows.length + 1, is_active: true }])}><Plus className="h-3.5 w-3.5" />افزودن گزینه</Button>
                  <div className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                    <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">ورود گروهی: CSV یا فایل اکسل (key,label,parent_key,sort_order,is_active)</p>
                    <textarea rows={3} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={'key,label\nnatural_person,حقیقی\nlegal_entity,حقوقی'} dir="ltr" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-[11px] text-zinc-800 focus:outline-none focus:ring-2 dark:border-zinc-700 dark:bg-[#1d1d20] dark:text-zinc-100" />
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={parseCsv} className="gap-1 text-xs"><Upload className="h-3.5 w-3.5" />تجزیه و پیشنمایش</Button>
                      {csvPreview.length > 0 && <Button type="button" size="sm" onClick={() => { setOptionsRows(csvPreview.map((r) => ({ key: r.key, label: r.label, parent_key: r.parent_key, sort_order: 0, is_active: true }))); toast.success(`${csvPreview.length.toLocaleString('fa-IR')} گزینه از CSV بارگذاری شد.`); setCsvText(''); setCsvPreview([]) }} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"><CheckIcon />اعمال در لیست</Button>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[11px] text-zinc-500">یا از فایل اکسل بخوانید (ستون‌ها: key, label, parent_key):</span>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file) return
                            void (async () => {
                              try {
                                const imported = await readExcelFile(file)
                                const dupe = imported.filter((r, i) => imported.findIndex((x) => x.key === r.key) !== i)
                                if (dupe.length > 0) { setCsvError('کلید تکراری در فایل اکسل وجود دارد.'); setCsvPreview([]); return }
                                setCsvError(null)
                                setCsvPreview(imported)
                                toast.success(`${imported.length.toLocaleString('fa-IR')} ردیف از فایل اکسل خوانده شد.`)
                              } catch (err) { setCsvError(err instanceof Error ? err.message : 'خواندن فایل اکسل ناموفق بود.'); setCsvPreview([]) }
                            })()
                          }}
                        />
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"><Upload className="h-3 w-3" />انتخاب فایل اکسل</span>
                      </label>
                      <Button type="button" variant="outline" size="sm" onClick={downloadExcelSample} className="gap-1 text-[11px]"><Download className="h-3 w-3" />دانلود نمونه (استان/شهرستان/شهر)</Button>
                    </div>
                    {csvError && <p className="text-[11px] text-red-500">{csvError}</p>}
                    {csvPreview.length > 0 && (
                      <div className="max-h-32 overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
                        <table className="w-full text-right text-[11px]">
                          <thead><tr className="border-b border-zinc-200 dark:border-zinc-700">{csvPreview.length > 0 ? ['key', 'label', 'parent_key'].map((h) => <th key={h} className="px-2 py-1 font-bold">{h}</th>) : null}</tr></thead>
                          <tbody>{csvPreview.map((r, i) => <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800"><td className="px-2 py-1 font-mono">{r.key}</td><td className="px-2 py-1">{r.label}</td><td className="px-2 py-1 font-mono">{r.parent_key ?? ''}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
        </div>
      </FullScreenDialog>

      {/* ── Options editor — full page ── */}
      <FullScreenDialog
        open={!!optionsList}
        title={optionsList ? `گزینههای فهرست «${optionsList.title}»` : ''}
        subtitle="کلید مقدار ذخیرهشده و عنوان نمایشی؛ برای فهرست وابسته، والد با کلید گزینه ثبت میشود."
        onBack={() => setOptionsList(null)}
      >
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
          {optionsList && (optionsList.source_type === 'SYSTEM' ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-6 text-center text-xs text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">
                  این فهرست پویای سیستم است؛ گزینهها بهصورت زنده از منبع «{SYSTEM_SOURCES.find((s) => s.key === optionsList.system_source_key)?.label ?? optionsList.system_source_key}» دریافت میشوند و قابل ویرایش دستی نیستند.
                </div>
              ) : (
                <OptionsEditor
                  list={optionsList}
                  options={optionsByList[optionsList.id] ?? []}
                  onSaved={() => void load()}
                />
              ))}
        </div>
      </FullScreenDialog>

      {/* ── Cascade preview — full page ── */}
      <FullScreenDialog
        open={!!previewList}
        title={previewList ? `پیشنمایش «${previewList.title}»` : ''}
        subtitle="ساختار آبشاری فهرستهای وابسته پیش از انتشار"
        onBack={() => setPreviewList(null)}
      >
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
          {previewList && (previewList.source_type === 'STATIC' && previewList.is_dependent && parentList ? (
                <CascadePreview
                  chain={[parentList, previewList]}
                  lists={listsById}
                  optionsByList={optionsByList}
                  selected={previewSelected}
                  setSelected={setPreviewSelected}
                />
              ) : (
                <div className="grid gap-2">
                  {options.map((o) => <div key={o.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"><span className="text-zinc-600 dark:text-zinc-300">{o.label}</span></div>)}
                  {options.length === 0 && <p className="py-8 text-center text-xs text-zinc-400">گزینهی منتشرشدهای برای این فهرست تعریف نشده است.</p>}
                </div>
              ))}
        </div>
      </FullScreenDialog>
    </div>
  )
}

// ── Small helpers ──
function IconBtn({ title, danger, children, onClick }: { title: string; danger?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" title={title} onClick={onClick}
      className={`h-8 w-8 p-0 ${danger ? 'text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400'}`}>
      {children}
    </Button>
  )
}

function TriangleAlertIcon() {
  return <span className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-400"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-zinc-700 dark:text-zinc-200">{label}</Label>{children}</div>
}

function ToggleField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
      <Label className="text-xs text-zinc-700 dark:text-zinc-200">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

// ── Options editor with add/edit/deactivate/delete + cascade parent select ──
function OptionsEditor({
  list, options, onSaved,
}: { list: SelectionList; options: SelectionListOption[]; onSaved: () => void }) {
  const [rows, setRows] = useState<Array<{ id?: string; key: string; label: string; parent_key?: string; sort_order: number; is_active: boolean }>>(() =>
    options.map((o, i) => ({ id: o.id, key: o.key, label: o.label, parent_key: o.parent_option_id ?? undefined, sort_order: o.sort_order || i + 1, is_active: o.is_active }))
  )
  const [excelError, setExcelError] = useState<string | null>(null)

  const handleExcelFile = async (file: File | null) => {
    setExcelError(null)
    if (!file) return
    try {
      const imported = await readExcelFile(file)
      const dupe = imported.filter((r, i) => imported.findIndex((x) => x.key === r.key) !== i)
      if (dupe.length > 0) { setExcelError('کلید تکراری در فایل اکسل وجود دارد.'); return }
      setRows((prev) => {
        const next = [...prev]
        for (const r of imported) {
          const existing = next.find((x) => x.key === r.key)
          if (existing) {
            existing.label = r.label
            existing.parent_key = r.parent_key
          } else {
            next.push({ key: r.key, label: r.label, parent_key: r.parent_key, sort_order: next.length + 1, is_active: true })
          }
        }
        return next
      })
      toast.success(`${imported.length.toLocaleString('fa-IR')} گزینه از فایل اکسل بارگذاری شد.`)
    } catch (err) { setExcelError(err instanceof Error ? err.message : 'خواندن فایل اکسل ناموفق بود.') }
  }

  // Resolve parent option id from the user-selected parent key (children store parent by id).
  const resolveParent = (parentKey?: string): string | null => {
    if (!parentKey) return null
    const row = rows.find((r) => r.key === parentKey)
    if (!row?.id) return null // new rows don't have an id yet — parent linkage for new-only sets is handled post-save
    return row.id!
  }

  const save = async () => {
    const valid = rows.filter((r) => r.key.trim() && r.label.trim())
    if (valid.length === 0) return toast.error('حداقل یک گزینه با key و label وارد کنید.')
    try {
      // First pass: persist all rows (so new rows get ids), then link parents by key.
      await saveSelectionListOptions(list.id, valid.map((r, i) => ({ id: r.id, key: r.key.trim(), label: r.label.trim(), sort_order: r.sort_order || i + 1, is_active: r.is_active })))
      // Fetch to resolve ids for parent linkage.
      const { data } = await (supabase as any).from('selection_list_options').select('id,key,parent_option_id').eq('list_id', list.id)
      const idByKey: Record<string, string> = {}
      ;(data ?? []).forEach((o: any) => { idByKey[o.key] = o.id })
      for (const r of valid) {
        if (r.parent_key && idByKey[r.key] && idByKey[r.parent_key] && idByKey[r.parent_key] !== idByKey[r.key]) {
          await (supabase as any).from('selection_list_options').update({ parent_option_id: idByKey[r.parent_key] }).eq('id', idByKey[r.key])
        }
      }
      for (const r of valid) {
        const oid = idByKey[r.key]
        if (oid) {
          try {
            await syncRegistryAfterSave({
              full_key: `selection_option.${String(list.key).toLowerCase()}.${r.key.toLowerCase()}`,
              title_fa: r.label.trim(),
              entity_type: 'SELECTION_OPTION',
              module: 'selection',
              form_name: 'گزینه‌های فهرست «' + list.title + '»',
              source_table: 'selection_list_options',
              source_record_id: oid,
              locked: list.status === 'PUBLISHED',
              lock_reason: list.status === 'PUBLISHED' ? 'پس از انتشار قفل است' : null,
            })
          } catch { /* advisory */ }
        }
      }
      toast.success('گزینهها ذخیره شدند.')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ذخیره گزینهها ناموفق بود (وجود دور/والد نامعتبر).')
    }
  }

  const remove = async (row: { id?: string }) => {
    if (!row.id) { setRows(rows.filter((r) => r !== row)); return }
    if (!window.confirm('آیا گزینه حذف شود؟ گزینههای استفادهشده قابل حذف نیستند.')) return
    try { await deleteSelectionListOption(row.id); toast.success('گزینه حذف شد.'); onSaved() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'حذف گزینه ناموفق بود (ممکن است والد سایر گزینهها باشد).') }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-right text-[11px]">
            <thead className="sticky top-0 bg-white dark:bg-[#1d1d20]"><tr className="border-b border-zinc-200 text-zinc-400 dark:border-zinc-700">{['عنوان', 'کلید', 'والد', 'ترتیب', 'فعال', ''].map((h) => <th key={h} className="px-2 py-1.5 font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-zinc-400">گزینهی تعریف نشده.</td></tr>}
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-2 py-1"><Input value={row.label} onChange={(e) => { const n = [...rows]; n[index] = { ...n[index], label: e.target.value }; setRows(n) }} className="h-8 text-xs" /></td>
                  <td className="px-2 py-1">
                    <KeyRegistryField
                      compact
                      title={row.label}
                      entityType="SELECTION_OPTION"
                      module="selection"
                      parentKey={list.key}
                      initialKey={row.key}
                      sourceTable="selection_list_options"
                      sourceRecordId={row.id ?? null}
                      onFullKeyChange={(fullKey) => { const n = [...rows]; n[index] = { ...n[index], key: rawFromFullKey(fullKey) }; setRows(n) }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Select value={row.parent_key ?? ''} onValueChange={(v) => { const n = [...rows]; n[index] = { ...n[index], parent_key: v || undefined }; setRows(n) }}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="" className="text-xs">—</SelectItem>
                        {rows.filter((r) => r.key !== row.key).map((r) => <SelectItem key={r.key} value={r.key} className="text-xs">{r.label || r.key}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1"><Input type="number" value={row.sort_order || index + 1} onChange={(e) => { const n = [...rows]; n[index] = { ...n[index], sort_order: Number(e.target.value) }; setRows(n) }} className="h-8 w-16 text-xs" /></td>
                  <td className="px-2 py-1"><Switch checked={row.is_active} onCheckedChange={(v) => { const n = [...rows]; n[index] = { ...n[index], is_active: v }; setRows(n) }} /></td>
                  <td className="px-2 py-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => void remove(row)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
        <span className="text-[11px] text-zinc-500">ورود از فایل اکسل (key, label, parent_key) — نمونه استان/شهرستان/شهر را دانلود کنید:</span>
        <label className="cursor-pointer">
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void handleExcelFile(f ?? null) }} />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"><Upload className="h-3 w-3" />انتخاب فایل اکسل</span>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={downloadExcelSample} className="gap-1 text-[11px]"><Download className="h-3 w-3" />دانلود نمونه (استان/شهرستان/شهر)</Button>
        {excelError && <span className="text-[11px] text-red-500">{excelError}</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setRows([...rows, { key: '', label: '', sort_order: rows.length + 1, is_active: true }])}><Plus className="h-3.5 w-3.5" />افزودن سریع</Button>
        <Button size="sm" onClick={() => void save()} className="gap-1.5 text-xs font-bold text-white" style={{ background: BRAND }}><Save className="h-3.5 w-3.5" />ذخیره گزینهها</Button>
      </div>
    </div>
  )
}

// (supabase is imported at the top for the OptionsEditor persistence step)

// ── Dependent (cascading) live preview ──
function CascadePreview({
  chain, lists, optionsByList, selected, setSelected,
}: {
  chain: SelectionList[]
  lists: Record<string, SelectionList>
  optionsByList: Record<string, SelectionListOption[]>
  selected: Record<string, string>
  setSelected: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  // chain is ordered parent -> child; render each level, deriving children from selection above.
  const renderLevel = (listIndex: number): React.ReactNode => {
    const list = chain[listIndex]
    const parentList = listIndex > 0 ? chain[listIndex - 1] : null
    const parentSelection = parentList ? selected[parentList.id] : null
    const options = (optionsByList[list.id] ?? []).filter((o) => o.is_active)
      .filter((o) => !parentSelection ? (o.parent_option_id ?? null) === null : o.parent_option_id === parentSelection)
      .sort((a, b) => a.sort_order - b.sort_order)
    return (
      <div key={list.id} className="space-y-1.5">
        <Label className="text-[11px] text-zinc-600 dark:text-zinc-300">{list.title}</Label>
        <Select
          value={selected[list.id] ?? ''}
          onValueChange={(v) => setSelected((prev) => {
            // Clear this level and all descendants when it changes.
            const next: Record<string, string> = { ...prev, [list.id]: v }
            for (let i = listIndex + 1; i < chain.length; i++) delete next[chain[i].id]
            return next
          })}
        >
          <SelectTrigger className="h-10" disabled={!!parentList && !parentSelection}><SelectValue placeholder={!parentList ? '' : (list.parent_selection_message ?? 'ابتدا والد را انتخاب کنید.')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">—</SelectItem>
            {options.map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {listIndex < chain.length - 1 ? renderLevel(listIndex + 1) : null}
      </div>
    )
  }

  return <div className="space-y-3">{renderLevel(0)}</div>
}