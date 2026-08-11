import { useState } from 'react'
import TenantSwitcher from './TenantSwitcher'
import AddTenantForm from './AddTenantForm'

type View = 'switcher' | 'add'

export default function WorkspacePage() {
  const [view, setView] = useState<View>('switcher')

  if (view === 'add') {
    return (
      <AddTenantForm
        onBack={() => setView('switcher')}
        onSuccess={() => setView('switcher')}
      />
    )
  }

  return <TenantSwitcher onAddNew={() => setView('add')} />
}
