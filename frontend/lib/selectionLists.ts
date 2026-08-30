import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SelectionListSourceType = 'STATIC' | 'SYSTEM'
export type SelectionListStatus = 'DRAFT' | 'PUBLISHED'

export interface SelectionList {
  id: string
  key: string
  title: string
  description: string | null
  source_type: SelectionListSourceType
  is_dependent: boolean
  parent_list_id: string | null
  system_source_key: string | null
  parent_selection_message: string | null
  is_active: boolean
  status: SelectionListStatus
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SelectionListOption {
  id: string
  list_id: string
  key: string
  label: string
  parent_option_id: string | null
  sort_order: number
  is_active: boolean
  extra_info: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface SelectionListDesign {
  lists: SelectionList[]
  options: SelectionListOption[]
}

// SYSTEM sources: dynamic sources whose options are fetched live from the system.
export const SYSTEM_SOURCES: Array<{ key: string; label: string }> = [
  { key: 'TENANT_FISCAL_YEARS', label: 'سالهای مالی شرکت' },
  { key: 'TENANT_MEMBERS', label: 'اعضای شرکت' },
  { key: 'OBLIGATIONS', label: 'تعهدات فعال' },
  { key: 'PUBLISHED_FORMS', label: 'فرمهای منتشرشده' },
  { key: 'WORKFLOW_STEPS', label: 'مراحل پرونده' },
  { key: 'OBJECTION_TEMPLATES', label: 'الگوهای اعتراض' },
]

// Static UI label maps (presentation only — values always come from Supabase).
export const LIST_STATUS_LABEL: Record<SelectionListStatus, string> = {
  DRAFT: 'پیشنویس',
  PUBLISHED: 'منتشرشده',
}
export const SOURCE_TYPE_LABEL: Record<SelectionListSourceType, string> = {
  STATIC: 'ثابت',
  SYSTEM: 'پویای سیستم',
}

function mapRow<T>(row: unknown, fallback: T): T {
  return (row ?? fallback) as T
}

// ---------------------------------------------------------------------------
// Admin designer: all statuses.
// ---------------------------------------------------------------------------
export async function fetchSelectionLists(): Promise<SelectionListDesign> {
  const empty: SelectionListDesign = { lists: [], options: [] }
  if (!isSupabaseConfigured) return empty
  const [listsRes, optsRes] = await Promise.all([
    (supabase as any).from('selection_lists').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('selection_list_options').select('*').order('sort_order', { ascending: true }),
  ])
  if (listsRes.error || optsRes.error) {
    throw new Error(listsRes.error?.message ?? optsRes.error?.message ?? 'دریافت فهرستهای انتخابی ناموفق بود.')
  }
  return { lists: listsRes.data ?? [], options: optsRes.data ?? [] }
}

// Workspace: published + active only.
export async function fetchPublishedSelectionLists(): Promise<SelectionListDesign> {
  const empty: SelectionListDesign = { lists: [], options: [] }
  if (!isSupabaseConfigured) return empty
  const [listsRes, optsRes] = await Promise.all([
    (supabase as any).from('selection_lists').select('*').eq('status', 'PUBLISHED').eq('is_active', true).order('title', { ascending: true }),
    (supabase as any).from('selection_list_options').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
  ])
  if (listsRes.error || optsRes.error) {
    throw new Error(listsRes.error?.message ?? optsRes.error?.message ?? 'دریافت فهرستهای منتشرشده ناموفق بود.')
  }
  return { lists: listsRes.data ?? [], options: optsRes.data ?? [] }
}

export async function listOptions(listId: string): Promise<SelectionListOption[]> {
  if (!isSupabaseConfigured || !listId) return []
  const { data, error } = await (supabase as any)
    .from('selection_list_options').select('*').eq('list_id', listId).order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Resolve a published, active list's options by its stable key.
// Returns [{ key, label }] in sort_order — used by forms that previously
// hardcoded option arrays (Studio, penalties, extensions, objections, …).
// ---------------------------------------------------------------------------
export async function fetchSelectionListOptions(listKey: string): Promise<Array<{ key: string; label: string }>> {
  if (!isSupabaseConfigured || !listKey) return []
  const { data: list, error: listError } = await (supabase as any)
    .from('selection_lists')
    .select('id')
    .eq('key', listKey)
    .eq('status', 'PUBLISHED')
    .eq('is_active', true)
    .maybeSingle()
  if (listError || !list) return []
  const { data, error } = await (supabase as any)
    .from('selection_list_options')
    .select('key, label')
    .eq('list_id', list.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) return []
  return (data ?? []).map((option: any) => ({ key: option.key, label: option.label }))
}

export function useSelectionListOptions(listKey: string): Array<{ key: string; label: string }> {
  const [options, setOptions] = useState<Array<{ key: string; label: string }>>([])
  useEffect(() => {
    let cancelled = false
    void fetchSelectionListOptions(listKey)
      .then((rows) => {
        if (!cancelled) setOptions(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [listKey])
  return options
}

// ---------------------------------------------------------------------------
// Mutations (admin)
// ---------------------------------------------------------------------------
export async function saveSelectionList(list: Partial<SelectionList>): Promise<SelectionList | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('selection_lists')
    .upsert({
      ...(list.id ? { id: list.id } : {}),
      key: list.key,
      title: list.title,
      description: list.description ?? null,
      source_type: list.source_type ?? 'STATIC',
      is_dependent: list.is_dependent ?? false,
      parent_list_id: list.parent_list_id ?? null,
      system_source_key: list.system_source_key ?? null,
      parent_selection_message: list.parent_selection_message ?? null,
      is_active: list.is_active ?? true,
      status: list.status ?? 'DRAFT',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function setSelectionListActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await (supabase as any).from('selection_lists').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setSelectionListStatus(id: string, status: SelectionListStatus): Promise<void> {
  const { error } = await (supabase as any).from('selection_lists').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function publishSelectionList(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('اتصال به پایگاه داده برقرار نیست.')
  const { error } = await (supabase as any).rpc('publish_selection_list', { p_list_id: id })
  if (error) throw new Error(error.message)
}

export async function deleteSelectionList(id: string): Promise<void> {
  const { error } = await (supabase as any).from('selection_lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveSelectionListOption(option: Partial<SelectionListOption>): Promise<SelectionListOption | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await (supabase as any)
    .from('selection_list_options')
    .upsert({
      ...(option.id ? { id: option.id } : {}),
      list_id: option.list_id,
      key: option.key,
      label: option.label,
      parent_option_id: option.parent_option_id ?? null,
      sort_order: option.sort_order ?? 0,
      is_active: option.is_active ?? true,
      extra_info: option.extra_info ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function saveSelectionListOptions(listId: string, options: Array<Partial<SelectionListOption> & { key: string; label: string }>): Promise<void> {
  if (!isSupabaseConfigured) return
  if (options.length === 0) return
  const { error } = await (supabase as any)
    .from('selection_list_options')
    .upsert(options.map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      list_id: listId,
      key: o.key,
      label: o.label,
      parent_option_id: o.parent_option_id ?? null,
      sort_order: o.sort_order ?? 0,
      is_active: o.is_active ?? true,
      extra_info: o.extra_info ?? null,
    })))
  if (error) throw new Error(error.message)
}

export async function deleteSelectionListOption(id: string): Promise<void> {
  const { error } = await (supabase as any).from('selection_list_options').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Usage: structs used by fields. We store the reference directly on each
// owning field; options and lists guard deletes via DB triggers + here we
// surface friendly messages.
// ---------------------------------------------------------------------------
export interface OptionSourceRef {
  kind: 'LIST' | 'SYSTEM'
  listId?: string
  systemSourceKey?: string
  parentFieldKey?: string
}