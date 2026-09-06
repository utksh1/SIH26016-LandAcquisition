/**
 * Frontend RBAC layer for SIH26016 Real-Time National Land Acquisition & Management System.
 *
 * Design philosophy:
 *   The frontend NEVER hardcodes `if (role === 'Collector')` checks. Instead it
 *   consumes the permission/action lists returned by the backend `/me` family of
 *   endpoints (see api/client.ts → getMe / getMePermissions / getMeTasks).
 *
 *   React components import:
 *     - `NAV_CONFIG` + `filterNavForPermissions()` to render the sidebar
 *     - `roleKpiCards()` to render role-specific dashboard tiles
 *     - `stageWorkflowActions()` to render the per-stage action buttons
 *     - `isLandOwnerRole()` to gate citizen-only views (grievances, my-land)
 *     - `RbacContext` to type the value stored after `/me/permissions`
 *
 *   All 45 permission codes (17 legacy + 28 granular) match the backend Rust
 *   `Permission` enum (services/api/src/rbac/permissions.rs) and the seeded rows
 *   in db/migrations/010_unify_user_role_mapping.sql — the dotted form is the
 *   canonical serialization on the wire.
 */

// ---------------------------------------------------------------------------
// 1. Permission — the full set of 45 permission codes (17 legacy + 28 granular)
// ---------------------------------------------------------------------------

export type Permission =
  // Legacy (17) — flat snake_case form, retained for backward compatibility
  | 'manage_users'
  | 'manage_roles'
  | 'view_projects'
  | 'create_projects'
  | 'update_projects'
  | 'transition_projects'
  | 'view_parcels'
  | 'create_parcels'
  | 'update_parcels'
  | 'view_owners'
  | 'create_owners'
  | 'update_owners'
  | 'view_stakeholders'
  | 'create_stakeholders'
  | 'update_stakeholders'
  | 'view_audit'
  | 'submit_grievances'
  // Granular (28) — dotted `<resource>.<verb>` form, matches backend wire format
  | 'dashboard.view'
  | 'parcel.verify'
  | 'parcel.geometry.edit'
  | 'sia.create'
  | 'sia.review'
  | 'notification.issue'
  | 'objection.submit'
  | 'objection.review'
  | 'hearing.conduct'
  | 'declaration.prepare'
  | 'declaration.approve'
  | 'award.prepare'
  | 'award.review'
  | 'award.approve'
  | 'compensation.calculate'
  | 'payment.initiate'
  | 'payment.approve'
  | 'possession.initiate'
  | 'rr.manage'
  | 'document.upload'
  | 'document.review'
  | 'document.approve'
  | 'workflow.reject'
  | 'analytics.view'
  | 'national.dashboard.view'
  | 'deposit.create'
  | 'deposit.release'
  | 'litigation.manage'

// ---------------------------------------------------------------------------
// 2 & 3. NavItem + NavSection — sidebar navigation model
// ---------------------------------------------------------------------------

export interface NavItem {
  id: string
  label: string
  permission: Permission
  icon?: string
}

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

// ---------------------------------------------------------------------------
// 4. NAV_CONFIG — the canonical full navigation tree. Each role's sidebar is a
//    filtered subset produced by `filterNavForPermissions()`.
// ---------------------------------------------------------------------------

export const NAV_CONFIG: NavSection[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', permission: 'dashboard.view' },
      { id: 'projects', label: 'Projects', permission: 'view_projects' },
      { id: 'my-tasks', label: 'My Pending Actions', permission: 'dashboard.view' },
    ],
  },
  {
    id: 'land',
    label: 'Land & Parcels',
    items: [
      { id: 'parcels', label: 'Land & Parcels', permission: 'view_parcels' },
      { id: 'gis-map', label: 'GIS Map', permission: 'view_parcels' },
      { id: 'dilrmp', label: 'DILRMP Sync', permission: 'parcel.verify' },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { id: 'sia', label: 'SIA Cases', permission: 'sia.create' },
      { id: 'objections', label: 'Objections & Hearings', permission: 'objection.review' },
      { id: 'awards', label: 'Awards', permission: 'award.review' },
      { id: 'compensation', label: 'Compensation', permission: 'compensation.calculate' },
      { id: 'payments', label: 'Payments', permission: 'payment.initiate' },
      { id: 'possession', label: 'Possession', permission: 'possession.initiate' },
      { id: 'rr', label: 'R&R', permission: 'rr.manage' },
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    items: [
      { id: 'deposits', label: 'Deposits with Authority', permission: 'deposit.create' },
      { id: 'litigation', label: 'Litigation', permission: 'litigation.manage' },
    ],
  },
  {
    id: 'oversight',
    label: 'Oversight',
    items: [
      { id: 'analytics', label: 'Analytics', permission: 'analytics.view' },
      { id: 'audit', label: 'Audit Ledger', permission: 'view_audit' },
      { id: 'national', label: 'National Dashboard', permission: 'national.dashboard.view' },
    ],
  },
  {
    id: 'citizen',
    label: 'My Land',
    items: [
      { id: 'my-land', label: 'My Land', permission: 'view_parcels' },
      { id: 'my-notices', label: 'My Notices', permission: 'view_projects' },
      { id: 'my-objections', label: 'My Objections', permission: 'objection.submit' },
      { id: 'my-compensation', label: 'My Compensation', permission: 'view_projects' },
      { id: 'my-payments', label: 'My Payments', permission: 'view_projects' },
      { id: 'grievances', label: 'Grievances', permission: 'submit_grievances' },
    ],
  },
]

// ---------------------------------------------------------------------------
// 5. filterNavForPermissions — returns only the sections/items the user can
//    actually access. A section is included if at least one item passes; within
//    an included section, only the passing items are kept.
// ---------------------------------------------------------------------------

export function filterNavForPermissions(permissions: Permission[]): NavSection[] {
  const allowed = new Set<Permission>(permissions)
  const sections: NavSection[] = []
  for (const section of NAV_CONFIG) {
    const items = section.items.filter((item) => allowed.has(item.permission))
    if (items.length > 0) {
      sections.push({ ...section, items })
    }
  }
  return sections
}

// ---------------------------------------------------------------------------
// 6 & 7. KpiCard + roleKpiCards — role-specific dashboard tiles
// ---------------------------------------------------------------------------

export interface KpiCard {
  label: string
  value: string
  delta?: string
  tone: 'mint' | 'gold' | 'coral' | 'blue'
  icon: string
}

export interface RoleKpiContext {
  projectCount: number
  pendingTasks: number
  overdueTasks: number
}

/**
 * Returns the 4 KPI tiles appropriate for `role`. Where a context value is
 * semantically meaningful (e.g. projectCount for the Collector's "Active
 * Projects" tile), the real number is rendered; where the value would require
 * additional fetches not yet wired up, the placeholder '—' is shown so the
 * dashboard still renders a stable shape.
 *
 * Role normalization: the input is lowercased and spaces are replaced with
 * underscores. Common aliases (rehabilitation_officer→rr_officer,
 * gis_surveyor→gis_officer) are mapped so callers may pass either the
 * App.tsx StakeholderId or the canonical backend role_code.
 */
export function roleKpiCards(role: string, context: RoleKpiContext): KpiCard[] {
  const normalized = normalizeRole(role)
  const projectCount = String(context.projectCount ?? 0)
  const pendingTasks = String(context.pendingTasks ?? 0)
  const overdueTasks = String(context.overdueTasks ?? 0)

  switch (normalized) {
    case 'collector':
      return [
        { label: 'Active Projects', value: projectCount, tone: 'mint', icon: '⌁', delta: '+1 this quarter' },
        { label: 'Pending Approvals', value: pendingTasks, tone: 'gold', icon: '⌁' },
        { label: 'SLA Risk', value: overdueTasks, tone: 'coral', icon: '⚠', delta: overdueTasks === '0' ? 'On schedule' : 'Needs attention' },
        { label: 'Compensation Pending', value: '—', tone: 'blue', icon: '₹' },
      ]
    case 'revenue_officer':
      return [
        { label: 'Assigned Parcels', value: '—', tone: 'mint', icon: '◒' },
        { label: 'Pending Verification', value: pendingTasks, tone: 'gold', icon: '⌁' },
        { label: 'Ownership Disputes', value: '—', tone: 'coral', icon: '⚠' },
        { label: 'DILRMP Sync Status', value: '—', tone: 'blue', icon: '↻' },
      ]
    case 'finance_officer':
      return [
        { label: 'Awards Pending', value: pendingTasks, tone: 'mint', icon: '⌁' },
        { label: 'Compensation Amount', value: '—', tone: 'gold', icon: '₹' },
        { label: 'Payments Pending', value: '—', tone: 'coral', icon: '₹' },
        { label: 'PFMS Submitted', value: '—', tone: 'blue', icon: '↗' },
      ]
    case 'land_owner':
      return [
        { label: 'My Parcels', value: '—', tone: 'mint', icon: '◒' },
        { label: 'Acquisition Stage', value: '—', tone: 'gold', icon: '↗' },
        { label: 'Notice Status', value: '—', tone: 'coral', icon: '⚠' },
        { label: 'Compensation', value: '—', tone: 'blue', icon: '₹' },
      ]
    case 'government_reviewer':
      return [
        { label: 'National Projects', value: '—', tone: 'mint', icon: '⌁' },
        { label: 'State Projects', value: '—', tone: 'gold', icon: '⌁' },
        { label: 'At-Risk Projects', value: overdueTasks, tone: 'coral', icon: '⚠' },
        { label: 'SLA Compliance', value: '—', tone: 'blue', icon: '↗' },
      ]
    case 'gis_officer':
      return [
        { label: 'Parcel Maps', value: '—', tone: 'mint', icon: '◒' },
        { label: 'Boundary Verification', value: '—', tone: 'gold', icon: '⌁' },
        { label: 'Survey Pending', value: pendingTasks, tone: 'coral', icon: '⌁' },
        { label: 'GIS Evidence', value: '—', tone: 'blue', icon: '⌁' },
      ]
    case 'sia_officer':
      return [
        { label: 'SIA Cases', value: pendingTasks, tone: 'mint', icon: '⌁' },
        { label: 'Affected Families', value: '—', tone: 'gold', icon: '◒' },
        { label: 'Public Hearings', value: '—', tone: 'coral', icon: '⌁' },
        { label: 'SIMP Status', value: '—', tone: 'blue', icon: '↗' },
      ]
    case 'legal_officer':
      return [
        { label: 'Active Litigation', value: '—', tone: 'mint', icon: '⚠' },
        { label: 'Award Scrutiny', value: pendingTasks, tone: 'gold', icon: '⌁' },
        { label: 'Deposits', value: '—', tone: 'coral', icon: '₹' },
        { label: 'Court Stays', value: '—', tone: 'blue', icon: '⚠' },
      ]
    case 'rr_officer':
      return [
        { label: 'Affected Families', value: '—', tone: 'mint', icon: '◒' },
        { label: 'Entitlements', value: '—', tone: 'gold', icon: '⌁' },
        { label: 'Resettlement', value: '—', tone: 'coral', icon: '⌁' },
        { label: 'Benefits', value: '—', tone: 'blue', icon: '↗' },
      ]
    case 'land_requiring_body':
      return [
        { label: 'My Projects', value: projectCount, tone: 'mint', icon: '⌁' },
        { label: 'New Acquisition', value: '—', tone: 'gold', icon: '⌁' },
        { label: 'DPR Status', value: '—', tone: 'coral', icon: '⌁' },
        { label: 'Workflow Status', value: '—', tone: 'blue', icon: '↗' },
      ]
    case 'additional_collector':
      return [
        { label: 'Declarations', value: pendingTasks, tone: 'mint', icon: '⌁' },
        { label: 'Awards', value: '—', tone: 'gold', icon: '⌁' },
        { label: 'Objections', value: '—', tone: 'coral', icon: '⚠' },
        { label: 'Documents', value: '—', tone: 'blue', icon: '⌁' },
      ]
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// 8 & 9. WorkflowAction + stageWorkflowActions — per-stage action buttons
// ---------------------------------------------------------------------------

export interface WorkflowAction {
  action: string // e.g. 'approve', 'reject', 'review', 'view_documents'
  label: string // e.g. 'Approve Stage', 'Return for Correction'
  permission: Permission
  variant: 'primary' | 'secondary' | 'danger'
}

/**
 * The complete map from a workflow stage code (one of the 15 RFCTLARR stages
 * emitted by services/workflow) to the *possible* action buttons for that
 * stage. The actual subset shown to the current user is computed by
 * `stageWorkflowActions()` below, intersected with the backend-provided
 * `allowed_actions` list (which encodes both the stage's responsible-role
 * contract and the per-task document-completeness check).
 */
const STAGE_ACTIONS: Record<string, WorkflowAction[]> = {
  proposal_initiation: [
    { action: 'submit_proposal', label: 'Submit Proposal', permission: 'create_projects', variant: 'primary' },
    { action: 'view_documents', label: 'View Documents', permission: 'document.review', variant: 'secondary' },
  ],
  land_record_verification: [
    { action: 'verify', label: 'Verify Parcel', permission: 'parcel.verify', variant: 'primary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
    { action: 'view_documents', label: 'View Documents', permission: 'document.review', variant: 'secondary' },
    { action: 'upload_ror', label: 'Upload RoR', permission: 'document.upload', variant: 'secondary' },
  ],
  sia_preparation: [
    { action: 'create_sia', label: 'Create SIA', permission: 'sia.create', variant: 'primary' },
    { action: 'upload_hearing', label: 'Upload Hearing', permission: 'document.upload', variant: 'secondary' },
    { action: 'submit_sia', label: 'Submit SIA', permission: 'sia.create', variant: 'primary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
  ],
  sia_review: [
    { action: 'review', label: 'Review SIA', permission: 'sia.review', variant: 'primary' },
    { action: 'approve', label: 'Approve SIA', permission: 'sia.review', variant: 'primary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
    { action: 'view_documents', label: 'View Documents', permission: 'document.review', variant: 'secondary' },
  ],
  preliminary_notification: [
    { action: 'issue_notification', label: 'Issue Notification', permission: 'notification.issue', variant: 'primary' },
    { action: 'view_documents', label: 'View Documents', permission: 'document.review', variant: 'secondary' },
  ],
  objection_period: [
    { action: 'submit_objection', label: 'Submit Objection', permission: 'objection.submit', variant: 'primary' },
    { action: 'view_objections', label: 'View Objections', permission: 'objection.review', variant: 'secondary' },
  ],
  hearing: [
    { action: 'conduct_hearing', label: 'Conduct Hearing', permission: 'hearing.conduct', variant: 'primary' },
    { action: 'issue_order', label: 'Issue Order', permission: 'hearing.conduct', variant: 'primary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
  ],
  declaration: [
    { action: 'prepare_declaration', label: 'Prepare Declaration', permission: 'declaration.prepare', variant: 'primary' },
    { action: 'approve_declaration', label: 'Approve Declaration', permission: 'declaration.approve', variant: 'primary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
  ],
  award_preparation: [
    { action: 'prepare_award', label: 'Prepare Award', permission: 'award.prepare', variant: 'primary' },
    { action: 'review_award', label: 'Review Award', permission: 'award.review', variant: 'secondary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
  ],
  award_approval: [
    { action: 'approve_award', label: 'Approve Award', permission: 'award.approve', variant: 'primary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
  ],
  compensation_calculation: [
    { action: 'calculate', label: 'Calculate', permission: 'compensation.calculate', variant: 'primary' },
    { action: 'verify', label: 'Verify', permission: 'parcel.verify', variant: 'secondary' },
    { action: 'return', label: 'Return for Correction', permission: 'workflow.reject', variant: 'danger' },
  ],
  payment_processing: [
    { action: 'initiate_payment', label: 'Initiate Payment', permission: 'payment.initiate', variant: 'primary' },
    { action: 'approve_payment', label: 'Approve Payment', permission: 'payment.approve', variant: 'primary' },
    { action: 'record_payment', label: 'Record Payment', permission: 'payment.approve', variant: 'secondary' },
  ],
  possession: [
    { action: 'initiate_possession', label: 'Initiate Possession', permission: 'possession.initiate', variant: 'primary' },
    { action: 'view_evidence', label: 'View Evidence', permission: 'document.review', variant: 'secondary' },
  ],
  rr_completion: [
    { action: 'verify_family', label: 'Verify Family', permission: 'rr.manage', variant: 'secondary' },
    { action: 'approve_entitlement', label: 'Approve Entitlement', permission: 'rr.manage', variant: 'primary' },
    { action: 'complete_rr', label: 'Complete R&R', permission: 'rr.manage', variant: 'primary' },
  ],
  project_closure: [
    { action: 'view_audit', label: 'View Audit', permission: 'view_audit', variant: 'secondary' },
    { action: 'export_report', label: 'Export Report', permission: 'analytics.view', variant: 'secondary' },
  ],
}

/**
 * Returns the action buttons for `stageCode` filtered by the backend-supplied
 * `allowedActions` list. The backend computes `allowed_actions` from:
 *   (a) the stage's responsible_role contract (workflow_stage_definition), and
 *   (b) the per-task document-completeness check (can_advance).
 * The frontend therefore NEVER decides on its own which buttons to show — it
 * simply renders whichever ones the backend explicitly permits.
 */
export function stageWorkflowActions(stageCode: string, allowedActions: string[]): WorkflowAction[] {
  const allowed = new Set<string>(allowedActions)
  const candidates = STAGE_ACTIONS[stageCode]
  if (!candidates) return []
  return candidates.filter((candidate) => allowed.has(candidate.action))
}

// ---------------------------------------------------------------------------
// 10. isLandOwnerRole — gates citizen-only views (grievances, my-land portal)
// ---------------------------------------------------------------------------

export function isLandOwnerRole(role: string): boolean {
  return normalizeRole(role) === 'land_owner'
}

// ---------------------------------------------------------------------------
// 11. RbacContext — the cached result of /me + /me/permissions. The frontend
//     should fetch this once on app boot and store it in React context.
// ---------------------------------------------------------------------------

export interface RbacContext {
  employeeId: string
  name: string
  designation: string
  department: string
  role: string
  roleCode: string // lowercase snake_case for backend lookups
  permissions: Permission[]
  jurisdiction: {
    scope_level: 'national' | 'state' | 'district' | 'tehsil' | 'parcel'
    scope_code: string
  }
  allowedActions: string[] // from /me/tasks or stage status
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a role string to canonical lowercase snake_case form used by the
 * backend `role_code` enum. Handles:
 *   - 'Collector' / 'COLLECTOR' / 'collector'           → 'collector'
 *   - 'Land Owner' / 'LAND_OWNER' / 'land_owner'       → 'land_owner'
 *   - 'Revenue Officer' / 'REVENUE_OFFICER' / ...      → 'revenue_officer'
 *   - alias 'rehabilitation_officer' / 'Rehabilitation Officer' → 'rr_officer'
 *   - alias 'gis_surveyor' / 'GIS Surveyor'            → 'gis_officer'
 *   - alias 'requiring_body' / 'Requiring Body'        → 'land_requiring_body'
 *   - alias 'government_dashboard' / 'Government Dashboard' → 'government_reviewer'
 */
function normalizeRole(role: string): string {
  if (!role) return ''
  const snake = role.trim().toLowerCase().replace(/\s+/g, '_')
  switch (snake) {
    case 'rehabilitation_officer':
    case 'rehab_officer':
      return 'rr_officer'
    case 'gis_surveyor':
      return 'gis_officer'
    case 'requiring_body':
    case 'land_requiring_body':
      return 'land_requiring_body'
    case 'government_dashboard':
    case 'government_reviewer':
      return 'government_reviewer'
    default:
      return snake
  }
}
