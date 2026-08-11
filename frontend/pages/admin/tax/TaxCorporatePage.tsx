import { useState } from 'react'
import ObligationsList from './ObligationsList'
import ObligationForm from './ObligationForm'
import WorkflowStepsManager from './WorkflowStepsManager'
import type { Obligation } from '../../../lib/supabase'

type View = 'list' | 'add' | 'edit' | 'steps'

interface Props {
  type?: string
}

export default function TaxCorporatePage({ type = 'TAX_CORPORATE' }: Props) {
  const [view, setView] = useState<View>('list')
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null)
  // Increment to signal list to re-fetch after a mutation
  const [refreshToken, setRefreshToken] = useState(0)

  const refresh = () => {
    setRefreshToken((t) => t + 1)
    setView('list')
    setSelectedObligation(null)
  }

  return (
    <>
      {/* Always-visible list (hidden behind full-screen takeovers) */}
      <ObligationsList
        obligationType={type}
        onAddNew={() => { setSelectedObligation(null); setView('add') }}
        onEdit={(ob) => { setSelectedObligation(ob); setView('edit') }}
        onManageSteps={(ob) => { setSelectedObligation(ob); setView('steps') }}
        refreshToken={refreshToken}
      />

      {/* Full-screen takeover: Add / Edit */}
      {(view === 'add' || view === 'edit') && (
        <ObligationForm
          obligation={view === 'edit' ? selectedObligation : null}
          defaultType={type}
          onBack={() => { setView('list'); setSelectedObligation(null) }}
          onSaved={refresh}
        />
      )}

      {/* Full-screen takeover: Workflow Steps */}
      {view === 'steps' && selectedObligation && (
        <WorkflowStepsManager
          obligation={selectedObligation}
          onBack={() => { setView('list'); setSelectedObligation(null) }}
          onSaved={refresh}
        />
      )}
    </>
  )
}
