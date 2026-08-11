import { mockObligationsDb, mockObjectionTemplatesDb, mockDeadlineExtensionsDb } from './mockDb'

export interface DependencyItem {
  formName: string
  details: string
  iconType?: 'extension' | 'penalty' | 'workflow' | 'template' | 'obligation'
}

export interface DependencyCheckResult {
  hasDependencies: boolean
  dependencies: DependencyItem[]
}

/**
 * Checks whether an Obligation has any dependent data anywhere in the platform.
 */
export function checkObligationDependencies(obligationId: string): DependencyCheckResult {
  const dependencies: DependencyItem[] = []
  const obligation = mockObligationsDb.getById(obligationId)

  if (!obligation) {
    return { hasDependencies: false, dependencies: [] }
  }

  // 1. Check Deadline Extensions
  const extensions = mockDeadlineExtensionsDb.getAll().filter((e) => e.obligation_id === obligationId)
  extensions.forEach((ext) => {
    dependencies.push({
      formName: 'فرم تمدید مهلت‌های قانونی',
      details: `تمدید سال ${ext.fiscal_year} — ${ext.circular_description || 'بدون عنوان بخشنامه'} (${ext.extension_type}: ${ext.value})`,
      iconType: 'extension',
    })
  })

  // 2. Check Penalties
  if (obligation.penalties && obligation.penalties.length > 0) {
    obligation.penalties.forEach((p) => {
      dependencies.push({
        formName: 'فرم قوانین جرایم مالیاتی',
        details: `${p.legal_clause || 'قانون جریمه بدون ماده'} (${p.penalty_type} — ${p.rate_or_amount} ${p.calc_unit})`,
        iconType: 'penalty',
      })
    })
  }

  // 3. Check Workflow Steps (تسلسل اجرا / گام‌ها)
  if (obligation.workflow_steps && obligation.workflow_steps.length > 0) {
    dependencies.push({
      formName: 'فرم مراحل و تسلسل اجرای گام‌ها',
      details: `${obligation.workflow_steps.length} گام اجرایی تعریف‌شده (${obligation.workflow_steps.map((s) => s.title).join(' ، ')})`,
      iconType: 'workflow',
    })
  }

  // 4. Check Linked Objection Template
  if (obligation.objection_template_id) {
    const tmpl = mockObjectionTemplatesDb.getById(obligation.objection_template_id)
    dependencies.push({
      formName: 'فرم الگوهای اعتراض متصل',
      details: `اتصال به الگوی اعتراض «${tmpl?.template_name || 'الگوی شماره ' + obligation.objection_template_id}»`,
      iconType: 'template',
    })
  }

  return {
    hasDependencies: dependencies.length > 0,
    dependencies,
  }
}

/**
 * Checks whether an Objection Template is used in any Obligations.
 */
export function checkObjectionTemplateDependencies(templateId: string): DependencyCheckResult {
  const dependencies: DependencyItem[] = []

  // Check Obligations using this template
  const linkedObligations = mockObligationsDb
    .getAll()
    .filter((ob) => ob.objection_template_id === templateId)

  linkedObligations.forEach((ob) => {
    dependencies.push({
      formName: 'فرم تکالیف مالیات بر عملکرد اشخاص حقوقی',
      details: `تکلیف «${ob.title}» (فاز: ${ob.phase_group || 'تعریف نشده'} — دوره: ${ob.recurrence})`,
      iconType: 'obligation',
    })
  })

  return {
    hasDependencies: dependencies.length > 0,
    dependencies,
  }
}
