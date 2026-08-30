import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Eye, Send, Pencil, Trash2,  GripVertical, ChevronDown, ChevronUp,
  Folder, Scale, Receipt, FileText, Shield, Building2, Briefcase,
  Banknote, Calendar, Layers, Search, X, Check, FileWarning, AlertTriangle,
  Loader2, FolderOpen, RefreshCw, Info,
} from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Switch } from '../../lib/shadcn/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../lib/shadcn/select'
import {
  fetchMenuDrafts, createMenuDraft, updateMenuDraft, deleteMenuDraft,
  reorderMenuDrafts, fetchSelectableObligations, fetchObligationFormPreview,
  publishCompanyMenu, fetchMenuPublishStatus,
  COMPANY_MENU_ICONS,
  type CompanyMenuDraft, type CompanyMenuDraftWrite, type SelectableObligation,
  type ObligationFormPreview, type MenuItemType,
} from '../../lib/supabaseDb'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import FullScreenDialog from '../../components/FullScreenDialog'

// ---------------------------------------------------------------------------
// Brand palette for this page (workspace visual language option #1)
// ---------------------------------------------------------------------------
const BRAND = '#5B4DE6' // آگاهیم purple
const OK = '#16A34A'
const DANGER = '#DC2626'

const ICON_MAP: Record<string, React.ElementType> = {
  folder: Folder, scale: Scale, receipt: Receipt, file: FileText, shield: Shield,
  building: Building2, briefcase: Briefcase, banknote: Banknote, calendar: Calendar,
  layers: Layers,
}

function iconOf(name?: string | null) {
  const Icon = ICON_MAP[name ?? ''] ?? Folder
  return <Icon className="w-4 h-4" />
}

const DOMAIN_LABEL: Record<string, string> = { TAX: 'مالیات', INSURANCE: 'بیمه' }

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------
interface TreeItem extends CompanyMenuDraft { children: TreeItem[] }

function buildTree(items: CompanyMenuDraft[]): TreeItem[] {
  const map: Record<string, TreeItem> = {}
  items.forEach((i) => (map[i.id] = { ...i, children: [] }))
  const roots: TreeItem[] = []
  items
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((i) => {
      const node = map[i.id]
      if (i.parent_id && map[i.parent_id]) map[i.parent_id].children.push(node)
      else roots.push(node)
    })
  return roots
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CompanyMenuManagerPage() {
  const [drafts, setDrafts] = useState<CompanyMenuDraft[]>([])
  const [forms, setForms] = useState<SelectableObligation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [publishStatus, setPublishStatus] = useState<{ published_at: string | null; item_count: number }>({ published_at: null, item_count: 0 })

  // panel / modals
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CompanyMenuDraft | null>(null)
  const [panelDefaultParent, setPanelDefaultParent] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [formPreview, setFormPreview] = useState<ObligationFormPreview | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompanyMenuDraft | null>(null)
  const [publishing, setPublishing] = useState(false)

  // drag reordering
  const [dragId, setDragId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [d, f, pub] = await Promise.all([
        fetchMenuDrafts(),
        fetchSelectableObligations(),
        fetchMenuPublishStatus(),
      ])
      setDrafts(d)
      setForms(f)
      setPublishStatus(pub)
    } catch (e: any) {
      setLoadError(e?.message ?? 'خطا در بارگذاری داده‌ها')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ---- validation ---------------------------------------------------------
  const validation = useMemo(() => {
    const errors: Record<string, string[]> = {}
    const byId: Record<string, CompanyMenuDraft> = {}
    drafts.forEach((d) => (byId[d.id] = d))
    const childCount: Record<string, number> = {}
    drafts.forEach((d) => {
      if (d.parent_id) childCount[d.parent_id] = (childCount[d.parent_id] ?? 0) + 1
    })

    for (const d of drafts) {
      const list: string[] = []
      if (!d.title_fa || !d.title_fa.trim()) list.push('عنوان منو الزامی است.')
      if (d.item_type === 'FORM') {
        if (!d.form_obligation_id) list.push('آیتم نوع فرم باید یک فرم انتخاب‌شده داشته باشد.')
        else if (!forms.some((f) => f.id === d.form_obligation_id)) {
          list.push('فرم متصل غیرفعال است یا نسخه‌ی منتشر شده ندارد.')
        }
        if ((childCount[d.id] ?? 0) > 0) list.push('آیتم نوع فرم نمی‌تواند زیرمنو داشته باشد.')
      } else {
        if (d.form_obligation_id) list.push('آیتم گروه نباید به فرم متصل باشد.')
      }
      if (list.length) errors[d.id] = list
    }
    const total = Object.keys(errors).length
    return { errors, blocked: total > 0, total }
  }, [drafts, forms])

  // ---- actions ------------------------------------------------------------
  const markDirty = (next: CompanyMenuDraft[]) => {
    setDrafts(next)
    setDirty(true)
  }

  const openAdd = (parentId: string | null) => {
    const parent = parentId ? drafts.find((d) => d.id === parentId) ?? null : null
    setEditingItem(null)
    setPanelDefaultParent(parentId)
    setPanelOpen(true)
    void parent // parent used for initial item type hinting
  }

  const openEdit = (item: CompanyMenuDraft) => {
    setEditingItem(item)
    setPanelDefaultParent(item.parent_id)
    setPanelOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const hadChildren = drafts.some((d) => d.parent_id === deleteTarget.id)
    if (hadChildren) {
      toast.warning('این گروه دارای زیرمنو است؛ با حذف آن همه‌ی زیرمنوها نیز حذف می‌شوند.')
    }
    const ok = await deleteMenuDraft(deleteTarget.id)
    if (!ok) { toast.error('حذف انجام نشد.'); return }
    markDirty(drafts.filter((d) => d.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('آیتم حذف شد.')
  }

  const handleSavePanel = async (payload: CompanyMenuDraftWrite) => {
    let targetId: string | null = null
    if (editingItem) {
      const upd = await updateMenuDraft(editingItem.id, payload)
      if (!upd) { toast.error('ذخیره انجام نشد.'); return }
      markDirty(drafts.map((d) => (d.id === upd.id ? { ...d, ...upd } : d)))
      targetId = editingItem.id
    } else {
      const created = await createMenuDraft(payload)
      if (!created) { toast.error('ایجاد آیتم انجام نشد.'); return }
      markDirty([...drafts, created])
      targetId = created.id
    }
    setPanelOpen(false)
    toast.success('ذخیره شد (پیش‌نویس).')
    // Smooth flow: a freshly created FORM item without a chosen form opens the picker.
    if (payload.item_type === 'FORM' && !payload.form_obligation_id && targetId) {
      openFormPicker(targetId)
    }
  }

  // Native drag-to-reorder among siblings of the same parent.
  const handleDrop = async (overId: string) => {
    if (!dragId || dragId === overId) { setDragId(null); return }
    const drag = drafts.find((d) => d.id === dragId)
    const over = drafts.find((d) => d.id === overId)
    if (!drag || !over || drag.parent_id !== over.parent_id) { setDragId(null); return }
    // order current siblings including the dragged one
    const siblings = drafts
      .filter((d) => d.parent_id === drag.parent_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const withoutDrag = siblings.filter((s) => s.id !== drag.id)
    const overIdx = withoutDrag.findIndex((s) => s.id === over.id)
    withoutDrag.splice(overIdx, 0, drag)
    const updates = withoutDrag.map((s, idx) => ({ id: s.id, parent_id: s.parent_id, sort_order: idx + 1 }))
    const ok = await reorderMenuDrafts(updates)
    if (!ok) { await loadAll(); toast.error('مرتب‌سازی انجام نشد.'); setDragId(null); return }
    const byId: Record<string, CompanyMenuDraft> = {}
    drafts.forEach((d) => (byId[d.id] = d))
    withoutDrag.forEach((s, idx) => (byId[s.id] = { ...byId[s.id], sort_order: idx + 1 }))
    markDirty(Object.values(byId))
    setDragId(null)
  }

  const moveBy = async (item: CompanyMenuDraft, dir: -1 | 1) => {
    const siblings = drafts
      .filter((d) => d.parent_id === item.parent_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const idx = siblings.findIndex((s) => s.id === item.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const list = siblings.slice()
    ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
    const updates = list.map((s, i) => ({ id: s.id, parent_id: s.parent_id, sort_order: i + 1 }))
    const ok = await reorderMenuDrafts(updates)
    if (!ok) { await loadAll(); toast.error('جابه‌جایی انجام نشد.'); return }
    const byId: Record<string, CompanyMenuDraft> = {}
    drafts.forEach((d) => (byId[d.id] = d))
    list.forEach((s, i) => (byId[s.id] = { ...byId[s.id], sort_order: i + 1 }))
    markDirty(Object.values(byId))
  }

  const handlePublish = async () => {
    if (validation.blocked) { toast.error('قبل از انتشار، خطاهای موجود را برطرف کنید.'); return }
    if (drafts.length === 0) { toast.error('منوی خالی را نمی‌توان منتشر کرد.'); return }
    const byId: Record<string, CompanyMenuDraft> = {}
    drafts.forEach((d) => (byId[d.id] = d))
    const items = drafts.map((d) => ({
      code: d.code,
      title_fa: d.title_fa,
      item_type: d.item_type,
      parent_code: d.parent_id ? byId[d.parent_id]?.code ?? null : null,
      form_obligation_id: d.form_obligation_id,
      icon: d.icon,
      sort_order: d.sort_order ?? 0,
      is_active: d.is_active,
    }))
    setPublishing(true)
    const res = await publishCompanyMenu(items)
    setPublishing(false)
    if (!res.ok) { toast.error(res.message ?? 'انتشار انجام نشد.'); return }
    const pub = await fetchMenuPublishStatus()
    setPublishStatus(pub)
    setDirty(false)
    toast.success(`منو منتشر شد (${items.length} آیتم).`)
  }

  // ---- picker / preview ---------------------------------------------------
  const openFormPicker = (itemId: string) => {
    setPickerTarget(itemId)
    setPickerOpen(true)
  }

  const selectForm = (form: SelectableObligation) => {
    const item = drafts.find((d) => d.id === pickerTarget)
    if (!item) return
    const upd = updateMenuDraft(item.id, { form_obligation_id: form.id }).then((r) => {
      if (r) markDirty(drafts.map((d) => (d.id === r.id ? { ...d, ...r } : d)))
    })
    void upd
    setPickerOpen(false)
    toast.success(`فرم «${form.title}» انتخاب شد.`)
  }

  const previewThisForm = async (obligationId: string) => {
    const f = await fetchObligationFormPreview(obligationId)
    setFormPreview(f)
  }

  // ---- render helpers -----------------------------------------------------
  const renderTree = (nodes: TreeItem[], depth: number): React.ReactNode => {
    return nodes.map((node) => {
      const errs = validation.errors[node.id] ?? []
      const linkedForm = node.form_obligation_id ? forms.find((f) => f.id === node.form_obligation_id) : null
      return (
        <div key={node.id} className="flex flex-col">
          <div
            draggable
            onDragStart={(e) => { setDragId(node.id); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleDrop(node.id) }}
            className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
              node.is_active
                ? 'border-zinc-200 bg-white hover:border-purple-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-purple-500/50'
                : 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40'
            } ${dragId === node.id ? 'opacity-50 ring-2 ring-purple-300' : ''}`}
            style={{ marginRight: `${depth * 22}px` }}
            title={node.is_active ? '' : 'غیرفعال'}
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-300 dark:text-zinc-600" />
            <span className="text-zinc-400 shrink-0">{iconOf(node.icon)}</span>
            {node.children.length > 0 && (
              <span className="text-zinc-400 shrink-0"><ChevronDown className="h-3.5 w-3.5" /></span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{node.title_fa}</span>
                {!node.is_active && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">غیرفعال</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${node.item_type === 'GROUP' ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'}`} style={node.item_type === 'GROUP' ? { color: BRAND } : undefined}>
                  {node.item_type === 'GROUP' ? 'گروه' : 'فرم'}
                </span>
                {node.item_type === 'FORM' && (
                  <span className="inline-flex items-center gap-1">
                    {linkedForm ? (
                      <>
                        <span className="text-purple-700 dark:text-purple-300">{linkedForm.title}</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">نسخه {linkedForm.version_number}</span>
                      </>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">فرمی انتخاب نشده</span>
                    )}
                  </span>
                )}
                {errs.map((er, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> {er}
                  </span>
                ))}
              </div>
            </div>
            {/* actions */}
            <div className="flex shrink-0 items-center gap-1 opacity-100 lg:opacity-0 lg:transition lg:group-hover:opacity-100">
              {node.item_type === 'FORM' && node.form_obligation_id && (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="پیش‌نمایش فرم" onClick={() => previewThisForm(node.form_obligation_id!)}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" title="حرکت بالا" onClick={() => moveBy(node, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="حرکت پایین" onClick={() => moveBy(node, 1)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              {node.item_type === 'GROUP' && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-700 dark:text-purple-300" title="افزودن زیرمنو" onClick={() => openAdd(node.id)}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" title="ویرایش" onClick={() => openEdit(node)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" title="حذف" onClick={() => setDeleteTarget(node)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </div>
      )
    })
  }

  const tree = useMemo(() => buildTree(drafts), [drafts])

  // -------------------------------------------------------------------------
  return (
    <div dir="rtl" className="min-h-full bg-[#F7F6FB] p-4 sm:p-6 text-zinc-900 dark:bg-[#131318] dark:text-zinc-100">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-white">مدیریت منوی فضای شرکت</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
              ساختار منوی عمودی فضای کاری شرکت را بدون تغییر کد تعریف، پیش‌نمایش و سپس منتشر کنید.
              تغییرات تا زمان انتشار صرفاً پیش‌نویس می‌مانند و روی فضای شرکت اثری ندارند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setPreviewOpen(true); }}>
              <Eye className="h-4 w-4" /> پیش‌نمایش
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 " onClick={() => loadAll()}>
              <RefreshCw className="h-4 w-4" /> بازیابی
            </Button>
            <Button
              size="sm"
              className="gap-1.5 font-semibold text-white"
              style={{ background: (validation.blocked || drafts.length === 0) ? undefined : BRAND }}
              disabled={validation.blocked || drafts.length === 0 || publishing}
              onClick={handlePublish}
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              انتشار منو
            </Button>
          </div>
        </div>

        {/* Status strip */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            وضعیت: پیش‌نویس {dirty ? 'با تغییرات ذخیره‌نشده' : 'ذخیره‌شده'}
          </span>
          {validation.blocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white" style={{ background: DANGER }}>
              <FileWarning className="h-3.5 w-3.5" /> {validation.total} خطا
            </span>
          )}
          {!validation.blocked && drafts.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white" style={{ background: OK }}>
              <Check className="h-3.5 w-3.5" /> آماده انتشار
            </span>
          )}
          {publishStatus.published_at ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              آخرین انتشار: {new Date(publishStatus.published_at).toLocaleString('fa-IR')} ({publishStatus.item_count} آیتم)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              هنوز منتشر نشده است.
            </span>
          )}
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            اتصال به پایگاه‌داده (Supabase) برقرار نیست. داده‌ها قابل ذخیره یا انتشار نیستند.
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} />
            <span>در حال بارگذاری منو...</span>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> خطا در بارگذاری</div>
            {loadError}
            <div className="mt-3"><Button variant="outline" size="sm" onClick={loadAll}>تلاش دوباره</Button></div>
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState onAdd={() => openAdd(null)} />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-600 dark:text-zinc-300">ساختار منو</h2>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openAdd(null)}>
                <Plus className="h-4 w-4" /> افزودن آیتم
              </Button>
            </div>
            <div className="divide-y divide-transparent">{renderTree(tree, 0)}</div>
            <p className="pt-1 text-xs text-zinc-400">برای تغییر ترتیب، آیتم را بکشید و رها کنید یا از فلش‌ها استفاده کنید.</p>
          </div>
        )}

        {/* Side panel (add / edit) */}
        {panelOpen && (
          <MenuItemPanel
            item={editingItem}
            defaultParent={panelDefaultParent}
            parents={drafts.filter((d) => d.item_type === 'GROUP' && d.id !== editingItem?.id)}
            onClose={() => setPanelOpen(false)}
            onSave={handleSavePanel}
            onPickForm={openFormPicker}
            pickedForm={editingItem?.form_obligation_id ? forms.find((f) => f.id === editingItem.form_obligation_id) : undefined}
          />
        )}

        {/* Form picker modal */}
        {pickerOpen && (
          <FormPickerModal
            forms={forms}
            onClose={() => setPickerOpen(false)}
            onSelect={selectForm}
            onPreview={previewThisForm}
          />
        )}

        {/* Form preview modal */}
        {formPreview && (
          <FormPreviewModal form={formPreview} onClose={() => setFormPreview(null)} />
        )}          {/* Publish preview modal (shows the would-be menu from the draft tree) */}
        {previewOpen && (
          <PreviewModal items={drafts} forms={forms} onClose={() => setPreviewOpen(false)} />
        )}

        {/* Delete confirm */}
        {deleteTarget && (
          <DeleteModal
            item={deleteTarget}
            hasChildren={drafts.some((d) => d.parent_id === deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white/60 py-20 px-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: BRAND }}>
        <FolderOpen className="h-7 w-7" />
      </div>
      <div>
        <p className="font-bold text-zinc-800 dark:text-zinc-100">هیچ آیتم منویی تعریف نشده است.</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">برای شروع، یک گروه یا زیرمنوی فرم بسازید. گروه‌ها زیرمنو دارند و فرم‌ها به یک فرم منتشرشده متصل می‌شوند.</p>
      </div>
      <Button className="gap-1.5 text-white" style={{ background: BRAND }} onClick={onAdd}>
        <Plus className="h-4 w-4" /> افزودن اولین آیتم
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit side panel
// ---------------------------------------------------------------------------
function MenuItemPanel({
  item, defaultParent, parents, onClose, onSave, onPickForm, pickedForm,
}: {
  item: CompanyMenuDraft | null
  defaultParent: string | null
  parents: CompanyMenuDraft[]
  onClose: () => void
  onSave: (p: CompanyMenuDraftWrite) => void
  onPickForm: (itemId: string) => void
  pickedForm?: SelectableObligation
}) {
  const [title, setTitle] = useState(item?.title_fa ?? '')
  const [itemType, setItemType] = useState<MenuItemType>(item?.item_type ?? 'GROUP')
  const [parentId, setParentId] = useState<string>(item?.parent_id ?? defaultParent ?? '')
  const [icon, setIcon] = useState<string>(item?.icon ?? 'folder')
  const [isActive, setIsActive] = useState<boolean>(item?.is_active ?? true)
  const [formId, setFormId] = useState<string>(item?.form_obligation_id ?? '')

  const titleMissing = !title.trim()

  const submit = () => {
    if (titleMissing) { toast.error('عنوان منو الزامی است.'); return }
    onSave({
      title_fa: title.trim(),
      item_type: itemType,
      parent_id: parentId || null,
      form_obligation_id: itemType === 'FORM' ? (formId || null) : null,
      icon,
      is_active: isActive,
    })
  }

  return (
    <FullScreenDialog
      open
      title={item ? 'ویرایش آیتم منو' : 'افزودن آیتم منو'}
      subtitle="آیتم گروه برای دسته‌بندی و آیتم فرم آخرین سطح منوی فضای شرکت است."
      onBack={onClose}
      footer={(
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button disabled={titleMissing} style={{ background: BRAND }} className="text-white" onClick={submit}>{item ? 'ذخیره تغییرات' : 'افزودن'}</Button>
        </div>
      )}
    >
      <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
          <Field label="عنوان منو" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اظهارنامه عملکرد" dir="rtl" />
          </Field>

          <Field label="نوع آیتم">
            <div className="grid grid-cols-2 gap-2">
              <TypeChip active={itemType === 'GROUP'} label="گروه" desc="دارای زیرمنو، فرم ندارد" onClick={() => { setItemType('GROUP'); setFormId('') }} color={BRAND} />
              <TypeChip active={itemType === 'FORM'} label="فرم" desc="آخرین سطح، متصل به فرم" onClick={() => setItemType('FORM')} color={BRAND} />
            </div>
          </Field>

          <Field label="منوی والد">
            <Select value={parentId || 'root'} onValueChange={(v) => setParentId(v === 'root' ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="بدون والد (ریشه)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="root">بدون والد (ریشه)</SelectItem>
                {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.title_fa}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="آیکون (از فهرست محدود)">
            <div className="grid grid-cols-5 gap-2">
              {COMPANY_MENU_ICONS.map((ic) => (
                <button key={ic.value} onClick={() => setIcon(ic.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition ${icon === ic.value ? 'border-2 text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400'}`}
                  style={icon === ic.value ? { borderColor: BRAND, background: BRAND } : undefined}
                >
                  {iconOf(ic.value)}
                  <span>{ic.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="وضعیت">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{isActive ? 'فعال' : 'غیرفعال'}</p>
                <p className="text-xs text-zinc-500">آیتم غیرفعال منتشر و در فضای شرکت نمایش داده نمی‌شود.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
          </Field>

          {itemType === 'FORM' && (
            <Field label="فرم متصل" required>
              {formId && pickedForm ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{pickedForm.title}</p>
                    <p className="text-xs text-zinc-500">{DOMAIN_LABEL[pickedForm.domain] ?? pickedForm.domain} · نسخه {pickedForm.version_number}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => item && onPickForm(item.id)}>تغییر</Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full justify-start gap-2 text-zinc-600 dark:text-zinc-300" onClick={() => item && onPickForm(item.id)}>
                  <Search className="h-4 w-4" /> انتخاب فرم...
                </Button>
              )}
              <p className="text-xs text-zinc-400">منو همواره آخرین نسخه‌ی منتشرشده‌ی فرم را باز می‌کند.</p>
            </Field>
          )}
      </div>
    </FullScreenDialog>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{label}{required && <span className="text-red-500"> *</span>}</Label>
      {children}
    </div>
  )
}

function TypeChip({ active, label, desc, onClick, color }: { active: boolean; label: string; desc: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border p-3 text-right transition ${active ? 'border-2 text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300'}`}
      style={active ? { borderColor: color } as React.CSSProperties : undefined}
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className={`block text-[10px] ${active ? 'opacity-90' : 'text-zinc-400'}`}>{desc}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Form picker modal
// ---------------------------------------------------------------------------
function FormPickerModal({ forms, onClose, onSelect, onPreview }: {
  forms: SelectableObligation[]
  onClose: () => void
  onSelect: (f: SelectableObligation) => void
  onPreview: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [domain, setDomain] = useState('ALL')
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)

  const filtered = forms.filter((f) => {
    if (domain !== 'ALL' && f.domain !== domain) return false
    const name = (f.title + ' ' + f.code).toLowerCase()
    return name.includes(q.trim().toLowerCase())
  }).sort((a, b) => (DOMAIN_LABEL[a.domain] ?? '').localeCompare(DOMAIN_LABEL[b.domain] ?? ''))

  // وقتی هیچ فرمی یافت نمی‌شود، وضعیت دیتابیس را نشان می‌دهد تا علت مشخص شود.
  const [dbInfo, setDbInfo] = useState<{ active: number | null; published: number | null } | null>(null)

  useEffect(() => {
    if (filtered.length > 0 || !isSupabaseConfigured) return
    let cancelled = false
    void (async () => {
      const [a, p] = await Promise.all([
        (supabase as any).from('obligations').select('id', { count: 'exact', head: true }).eq('is_active', true),
        (supabase as any).from('obligation_versions').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
      ])
      if (!cancelled) setDbInfo({ active: a.count ?? null, published: p.count ?? null })
    })()
    return () => { cancelled = true }
  }, [filtered.length])

  return (
    <FullScreenDialog
      open
      title="انتخاب فرم"
      subtitle="فقط فرم‌های فعال با نسخه‌ی منتشرشده و مجاز برای فضای شرکت"
      onBack={onClose}
    >
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
        <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو بر اساس نام فرم..." className="pr-9" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
          {([['ALL', 'همه'], ['TAX', 'مالیات'], ['INSURANCE', 'بیمه']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setDomain(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${domain === v ? 'text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100'}`}
              style={domain === v ? { background: BRAND } : undefined}
            >{l}</button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        فقط فرم‌های فعال با نسخه‌ی منتشرشده و مجاز برای فضای شرکت نمایش داده می‌شوند.
      </p>

      <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
            <p>فرم انتخاب‌شده‌ای یافت نشد. ابتدا در استودیوی تعهدات یک فرم را منتشر کنید.</p>
            {dbInfo && (
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
                وضعیت دیتابیس: {dbInfo.active ?? '؟'} تعهد فعال · {dbInfo.published ?? '؟'} نسخهٔ منتشرشده
              </p>
            )}
          </div>
        ) : filtered.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{f.title}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{f.code}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: BRAND }}>
                  <Scale className="h-3 w-3" /> {DOMAIN_LABEL[f.domain] ?? f.domain}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Check className="h-3 w-3" /> نسخه {f.version_number} منتشرشده
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={async () => { setLoadingPreview(f.id); await onPreview(f.id); setLoadingPreview(null); }}>
                {loadingPreview === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} پیش‌نمایش
              </Button>
              <Button size="sm" className="text-xs gap-1 text-white" style={{ background: BRAND }} onClick={() => onSelect(f)}>
                انتخاب
              </Button>
            </div>
          </div>
        ))}
        </div>
        </div>
    </FullScreenDialog>
  )
}

// ---------------------------------------------------------------------------
// Form preview modal
// ---------------------------------------------------------------------------
function FormPreviewModal({ form, onClose }: { form: ObligationFormPreview; onClose: () => void }) {
  return (
    <FullScreenDialog
      open
      title="پیش‌نمایش فرم"
      subtitle="اطلاعات نسخه‌ی منتشرشده‌ی فرم متصل به منو"
      onBack={onClose}
    >
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900 dark:text-white">{form.title}</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{form.code}</span>
          </div>
          {form.summary && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{form.summary}</p>}
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="حوزه" value={DOMAIN_LABEL[form.domain] ?? form.domain} />
          <Row label="نسخه منتشرشده" value={`نسخه ${form.version_number} · ${form.published_at ? new Date(form.published_at).toLocaleString('fa-IR') : '—'}`} />
          <Row label="از تاریخ موثر" value={form.effective_from ? new Date(form.effective_from + 'T00:00:00').toLocaleDateString('fa-IR') : '—'} />
          {form.legal_reference && <Row label="مبنای قانونی" value={form.legal_reference} />}
          <Row label="وضعیت" render={<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Check className="h-3 w-3" /> فعال و منتشرشده</span>} />
        </dl>
        <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700 dark:bg-purple-500/10 dark:text-purple-200">
          با کلیک کاربر، آخرین نسخه‌ی منتشرشده‌ی همین فرم در فضای شرکت باز می‌شود.
        </p>
      </div>
    </FullScreenDialog>
  )
}

function Row({ label, value, render }: { label: string; value?: string; render?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-left text-zinc-800 dark:text-zinc-100">{render ?? (value ?? '—')}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Publish preview modal (shows the would-be company menu from the draft tree)
// ---------------------------------------------------------------------------
function PreviewModal({ items, forms, onClose }: {
  items: CompanyMenuDraft[]
  forms: SelectableObligation[]
  onClose: () => void
}) {
  const nodes = useMemo(() => buildTree(items), [items])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const all: Record<string, boolean> = {}
    nodes.forEach((n) => (all[n.id] = true))
    setOpen(all)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasErrors = Object.values(validationOf(items, forms)).some((e) => e.length > 0)

  const renderTree = (list: TreeItem[], depth: number): React.ReactNode => (
    list.map((n) => (
      <div key={n.id} className="flex flex-col">
        <button
          onClick={() => n.children.length && setOpen((o) => ({ ...o, [n.id]: !o[n.id] }))}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${n.is_active ? '' : 'opacity-50'}`}
          style={{ marginRight: `${depth * 18}px` }}
        >
          {n.children.length > 0 && <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition ${open[n.id] ? '' : '-rotate-90'}`} />}
          <span className="text-zinc-400">{iconOf(n.icon)}</span>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{n.title_fa}</span>
          {n.children.length === 0 && (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold dark:bg-purple-500/15" style={{ color: BRAND }}>
              {forms.find((f) => f.id === n.form_obligation_id)?.title ?? 'فرم'}
            </span>
          )}
        </button>
        {n.children.length > 0 && open[n.id] && renderTree(n.children, depth + 1)}
      </div>
    ))
  )

  return (
    <FullScreenDialog
      open
      title="پیش‌نمایش منوی فضای شرکت (پیش از انتشار)"
      subtitle="ساختار درختی که پس از «انتشار منو» در فضای شرکت نمایش داده می‌شود"
      onBack={onClose}
    >
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#161618]">
        {nodes.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">هنوز آیتمی تعریف نشده است.</div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-700 dark:bg-zinc-800/40">{renderTree(nodes, 0)}</div>
        )}
        {nodes.length > 0 && (
          <>
            {hasErrors ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> برخی آیتم‌ها خطا دارند و منو قابل انتشار نیست.
              </p>
            ) : (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <Info className="h-3.5 w-3.5" /> این همان ساختاری است که پس از «انتشار منو» در فضای شرکت نمایش داده می‌شود.
              </p>
            )}
          </>
        )}
      </div>
    </FullScreenDialog>
  )
}

// Standalone validation used by the preview modal (mirrors the page validation).
function validationOf(items: CompanyMenuDraft[], forms: SelectableObligation[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const childCount: Record<string, number> = {}
  items.forEach((d) => { if (d.parent_id) childCount[d.parent_id] = (childCount[d.parent_id] ?? 0) + 1 })
  for (const d of items) {
    const list: string[] = []
    if (!d.title_fa || !d.title_fa.trim()) list.push('عنوان منو الزامی است.')
    if (d.item_type === 'FORM') {
      if (!d.form_obligation_id) list.push('آیتم نوع فرم باید یک فرم انتخاب‌شده داشته باشد.')
      else if (!forms.some((f) => f.id === d.form_obligation_id)) list.push('فرم متصل غیرفعال است یا نسخه‌ی منتشر شده ندارد.')
      if ((childCount[d.id] ?? 0) > 0) list.push('آیتم نوع فرم نمی‌تواند زیرمنو داشته باشد.')
    } else if (d.form_obligation_id) {
      list.push('آیتم گروه نباید به فرم متصل باشد.')
    }
    if (list.length) errors[d.id] = list
  }
  return errors
}

// ---------------------------------------------------------------------------
// Delete confirm modal
// ---------------------------------------------------------------------------
function DeleteModal({ item, hasChildren, onCancel, onConfirm }: {
  item: CompanyMenuDraft
  hasChildren: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal onClose={onCancel} title="تأیید حذف" maxW="max-w-md">
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        آیا از حذف «<b>{item.title_fa}</b>» مطمئن هستید؟
      </p>
      {hasChildren && (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" /> این گروه دارای زیرمنو است و با حذف آن، همه‌ی زیرمنوهایش نیز حذف می‌شوند.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>انصراف</Button>
        <Button className="text-white" style={{ background: DANGER }} onClick={onConfirm}>حذف</Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Generic modal scaffold
// ---------------------------------------------------------------------------
function Modal({ onClose, title, maxW, children }: { onClose: () => void; title: string; maxW?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[90vh] w-full ${maxW ?? 'max-w-md'} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900`}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
