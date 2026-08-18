import AdminComplianceStudioV5 from './AdminComplianceStudioV5'

/**
 * Stable route entry point for the obligation studio.
 *
 * Keep the router importing this module so feature implementations can evolve
 * without repeatedly creating merge conflicts in App.tsx or AdminLayout.tsx.
 */
// Named export is intentional: it prevents a stale default export left by a
// GitHub conflict resolution from producing a second default declaration.
export const AdminComplianceStudio = AdminComplianceStudioV5
