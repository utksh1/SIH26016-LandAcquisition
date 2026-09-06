

export interface MapParcelFeature {
  id: string
  survey_number: string
  owner_name: string
  area_hectares: number
  status: 'completed' | 'under_process' | 'disputed'
  color: string
  coordinates: [number, number][]
}

export interface MapProjectResponse {
  project_id: string
  name: string
  authority: string
  stage: string
  boundary: [number, number][]
  parcels: MapParcelFeature[]
}

export interface DilrmpLookupResult {
  survey_number: string
  owner_name: string
  area_hectares: number
  ulpin: string
  land_classification: string
  status: string
  provider: string
}

export interface PfmsDisburseResult {
  reference: string
  status: string
  utr_number: string
  amount_paise: number
  amount_inr: number
  timestamp: string
}

export interface NoticeExtractionResult {
  survey_number: string
  owner_name: string
  area_hectares: number
  confidence: number
  source: string
}

export interface DelayPredictResult {
  score: number
  level: string
  factors: string[]
}

export interface AuditVerificationResult {
  verified: boolean
  entries_count: number
  chain_head: string
}

export interface WorkflowRegime {
  id: string
  name: string
  authority: string
  stages: string[]
  department_mapping: Record<string, string[]>
  rules: string[]
}

export interface DepartmentInfo {
  code: string
  name: string
  responsible_modules: string[]
  default_role: string
}

export interface StageDefinition {
  code: string
  name: string
  responsible_department: string
  responsible_role: string
  timeline_days: number
  required_documents: string[]
  approval_authority: string
  allowed_transitions: string[]
  audit_requirements: string[]
}

export interface WorkflowRoleInfo {
  code: string
  name: string
  department_code: string
  description: string
}

export interface WorkflowStakeholdersResponse {
  departments: DepartmentInfo[]
  roles: WorkflowRoleInfo[]
}

export interface DashboardKpi {
  label: string
  value: string
  delta: string
  tone: string
  icon: string
}

export interface AlertNotice {
  label: string
  title: string
  detail: string
  tone: string
}

export interface ObjectionItem {
  id: string
  project_id: string
  survey_number: string
  owner_name: string
  objection_type: string
  text: string
  status: string
  filed_at: string
  resolution?: string | null
}

export interface RehabilitationInfo {
  project_id: string
  affected_families_count: number
  displaced_families_count: number
  entitlements_total: number
  entitlements_delivered: number
  status: string
  last_updated_at: string
}

export interface DocumentItem {
  id: string
  project_id: string
  kind: string
  file_name: string
  content_hash: string
  version: number
  signed_by: string
  uploaded_at: string
}

export interface EhrmsEmployee {
  id: string
  employee_id: string
  name: string
  designation: string
  department: string
  role: string
}

export interface MockEhrmsLoginResponse {
  success: boolean
  employee: EhrmsEmployee
}


export interface WorkflowInstance {
  id: string
  project_id: string
  authority: string
  current_stage: ProjectStage
  started_at: string
  notification_at?: string | null
  deadline_at?: string | null
  completed_at?: string | null
  lapsed_at?: string | null
  responsible_department?: string | null
  responsible_role?: string | null
  stage_timeline_days?: number | null
}

export interface StageGateDecisionPayload {
  user: string
  decision?: 'APPROVE' | 'REJECT' | string
  remarks?: string
  documents?: string[]
}

export interface StageGateDecisionResponse {
  success: boolean
  message: string
  previous_stage: ProjectStage
  current_stage: ProjectStage
  responsible_department: string
  responsible_role: string
  timeline_days: number
  deadline_at?: string | null
  actor: string
  actor_role: string
  decision: string
  remarks?: string | null
  verified_documents: string[]
  audit_sequence: number
  audit_hash: string
  workflow: WorkflowInstance
}

export interface WorkflowStatusResponse {
  workflow_id: string
  project_id: string
  current_stage: ProjectStage
  current_stage_name: string
  responsible_department: string
  responsible_role: string
  approval_authority: string
  timeline_days: number
  deadline_at?: string | null
  is_terminal: boolean
  required_documents: string[]
  uploaded_documents: string[]
  missing_documents: string[]
  can_advance: boolean
  recent_actions: ApprovalAction[]
}

/** A task assigned to a stakeholder role — the per-persona task queue. */
export interface MyTaskItem {
  workflow_id: string
  project_id: string
  project_name: string
  current_stage: string
  current_stage_name: string
  responsible_department: string
  responsible_role: string
  approval_authority: string
  timeline_days: number
  deadline_at?: string | null
  days_remaining?: number | null
  is_overdue: boolean
  required_documents: string[]
  uploaded_documents: string[]
  missing_documents: string[]
  can_advance: boolean
  is_terminal: boolean
}

/** Full /me payload: identity + role + jurisdiction + permissions, all in one round-trip. */
export interface MeResponse {
  employee_id: string
  name: string
  designation: string
  department: string
  role: string
  role_code: string
  permissions: string[]
  jurisdiction: {
    scope_level: string
    scope_code: string
  }
}

/** Lighter /me/permissions response — just the role_code + permission list, for re-validation. */
export interface MePermissionsResponse {
  role_code: string
  permissions: string[]
}

/**
 * Rich task item returned by /me/tasks — superset of {@link MyTaskItem} that
 * also carries the backend-computed `allowed_actions` list (used by the RBAC
 * layer's `stageWorkflowActions()` to decide which buttons to render) and the
 * per-task document inventory split into required / uploaded / missing.
 */
export interface MeTaskItem {
  task_id: string
  project_id: string
  project_name: string
  stage: string
  stage_name: string
  action: string
  assigned_role: string
  department: string
  deadline: string | null
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  allowed_actions: string[]
  required_documents: string[]
  uploaded_documents: string[]
  missing_documents: string[]
  can_advance: boolean
}

export interface ApprovalAction {
  id: string
  workflow_instance_id: string
  from_stage: string
  to_stage: string
  actor_role: string
  decision: string
  reason?: string | null
  created_at: string
}

export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  code?: string
  message?: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly method: string
  readonly path: string
  readonly details?: unknown

  constructor(
    message: string,
    options: {
      status?: number
      code?: string
      method?: string
      path?: string
      details?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code ?? 'api_error'
    this.method = options.method ?? 'GET'
    this.path = options.path ?? ''
    this.details = options.details
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>
  post<TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse>

  health(): Promise<HealthResponse>
  getHealth(): Promise<HealthResponse>
  listProjects(): Promise<ApiProject[]>
  getProjects(): Promise<ApiProject[]>
  createProject(request: CreateProjectRequest): Promise<ApiProject>
  getProject(projectId: string): Promise<ApiProject>
  transitionProject(projectId: string, request: TransitionRequest): Promise<ApiProject>
  getDashboard(): Promise<DashboardResponse>
  listAudit(): Promise<AuditEntry[]>
  getAudit(): Promise<AuditEntry[]>
  getParcelMap(projectId: string): Promise<ParcelMapResponse>
  getDILRMP(projectId: string): Promise<DILRMPResponse>
  getDilrmp(projectId: string): Promise<DILRMPResponse>
  getPFMS(projectId: string): Promise<PFMSResponse>
  getPfms(projectId: string): Promise<PFMSResponse>
  submitPFMSPayment(request: PfmsPaymentRequest): Promise<PfmsPayment>
  extractDocument(request: DocumentExtractionRequest): Promise<DocumentExtractionResponse>
  getDelayRisk(projectId: string): Promise<DelayRiskResponse>

  // New Live MVP API methods
  listMapParcels(): Promise<MapParcelFeature[]>
  getProjectMap(projectId: string): Promise<MapProjectResponse>
  lookupDilrmp(surveyNumber: string): Promise<DilrmpLookupResult>
  disbursePfms(projectId: string, beneficiaryRef: string, amountPaise: number): Promise<PfmsDisburseResult>
  extractNotice(text: string): Promise<NoticeExtractionResult>
  predictDelay(pendingApprovals?: number, timelineDelayDays?: number, disputeCount?: number): Promise<DelayPredictResult>
  login(role: Role, username?: string): Promise<{ token: string; role: Role; display_name: string; jurisdiction: string }>
  getAuditTrail(): Promise<AuditEntry[]>
  verifyAudit(): Promise<AuditVerificationResult>
  advanceWorkflow(workflowId: string, to: ProjectStage): Promise<WorkflowInstance>
  approveWorkflow(id: string, payload: StageGateDecisionPayload): Promise<StageGateDecisionResponse>
  rejectWorkflow(id: string, payload: StageGateDecisionPayload): Promise<StageGateDecisionResponse>
  getWorkflowStatus(id: string): Promise<WorkflowStatusResponse>
  getMyTasks(role: string): Promise<MyTaskItem[]>
  getMyTasksAuthenticated(): Promise<MyTaskItem[]>

  // /me family — frontend RBAC layer consumes these (see src/rbac.ts)
  getMe(): Promise<MeResponse>
  getMePermissions(): Promise<MePermissionsResponse>
  getMeTasks(): Promise<MeTaskItem[]>
  getWorkflowHistory(workflowId: string): Promise<ApprovalAction[]>
  listWorkflowRegimes(): Promise<WorkflowRegime[]>
  listDepartments(): Promise<DepartmentInfo[]>
  submitObjection(payload: { project_id: string; survey_number: string; owner_name: string; objection_type: string; text: string }): Promise<ObjectionItem>
  listProjectObjections(projectId: string): Promise<ObjectionItem[]>
  resolveObjection(objectionId: string, resolution: string, status: string): Promise<ObjectionItem>
  getRehabilitation(projectId: string): Promise<RehabilitationInfo>
  updateRehabilitation(projectId: string, entitlementsDelivered: number, status: string): Promise<RehabilitationInfo>
  uploadDocument(payload: { project_id: string; kind: string; file_name: string; signed_by: string }): Promise<DocumentItem>
  listProjectDocuments(projectId: string): Promise<DocumentItem[]>
  mockEhrmsLogin(employeeId: string): Promise<MockEhrmsLoginResponse>
  listMockEhrmsEmployees(): Promise<EhrmsEmployee[]>
  listWorkflowStages(): Promise<StageDefinition[]>
  getWorkflowStage(code: string): Promise<StageDefinition>
  getWorkflowStakeholders(): Promise<WorkflowStakeholdersResponse>
  getDashboardKpis(): Promise<DashboardKpi[]>
  getAlerts(): Promise<AlertNotice[]>
  getParcelOwnership(parcelId: string): Promise<OwnershipStatusResponse>
  setParcelOwnership(parcelId: string, ownershipStatus: string, actor?: string): Promise<OwnershipStatusResponse>
  listDepositsForParcel(parcelId: string): Promise<DepositWithAuthorityRecord[]>
  createDeposit(payload: CreateDepositRequest): Promise<DepositWithAuthorityRecord>
  releaseDeposit(depositId: string, payload: ReleaseDepositRequest): Promise<DepositWithAuthorityRecord>
}

export interface OwnershipStatusResponse {
  parcel_id: string
  survey_number: string
  ownership_status: string  // 'clear' | 'disputed' | 'untraceable' | 'under_litigation' | 'multiple_claimants'
  has_active_deposit: boolean
}

export interface DepositWithAuthorityRecord {
  id: string
  parcel_id: string
  award_id: string | null
  amount_paise: number
  deposit_reason: string
  court_reference: string | null
  deposited_at: string
  released_at: string | null
  release_beneficiary: string | null
  status: string  // 'deposited' | 'released' | 'escheated'
  notes: string | null
}

export interface CreateDepositRequest {
  parcel_id: string
  award_id?: string | null
  amount_paise: number
  deposit_reason: string  // 'disputed' | 'untraceable' | 'under_litigation' | 'multiple_claimants'
  court_reference?: string | null
  notes?: string | null
  actor?: string
}

export interface ReleaseDepositRequest {
  release_beneficiary: string
  release_court_order?: string | null
  actor?: string
}

const defaultBaseUrl = 'http://localhost:3000'
const envBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '')
const activeBaseUrl = envBaseUrl || defaultBaseUrl
let activeToken: string | undefined = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim()

export const setApiToken = (token: string | undefined) => {
  activeToken = token
}

export const apiPaths = {
  health: '/health',
  projects: '/projects',
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  transition: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/transition`,
  dashboard: '/dashboard',
  audit: '/audit',
  auditTrail: '/audit/trail',
  auditVerify: '/audit/verify',
  mapParcels: '/map/parcels',
  mapProject: (projectId: string) => `/map/projects/${encodeURIComponent(projectId)}`,
  dilrmpLookup: '/integrations/dilrmp/lookup',
  pfmsDisburse: '/integrations/pfms/disburse',
  aiExtractNotice: '/ai/extract-notice',
  aiPredictDelay: '/ai/predict-delay',
  authLogin: '/auth/login',
  ehrmsLogin: '/mock-ehrms/login',
  ehrmsEmployees: '/mock-ehrms/employees',
  workflowAdvance: (workflowId: string) => `/workflow/${encodeURIComponent(workflowId)}/advance`,
  workflowApprove: (workflowId: string) => `/workflow/${encodeURIComponent(workflowId)}/approve`,
  workflowReject: (workflowId: string) => `/workflow/${encodeURIComponent(workflowId)}/reject`,
  workflowHistory: (workflowId: string) => `/workflow/${encodeURIComponent(workflowId)}/history`,
  workflowStatus: (workflowId: string) => `/workflow/${encodeURIComponent(workflowId)}/status`,
  myTasks: (role: string) => `/workflow/my-tasks/${encodeURIComponent(role)}`,
  myTasksAuthenticated: '/workflow/my-tasks',
  me: '/me',
  mePermissions: '/me/permissions',
  meTasks: '/me/tasks',
  workflowRegimes: '/workflow/regimes',
  workflowStages: '/workflow/stages',
  workflowStage: (code: string) => `/workflow/stages/${encodeURIComponent(code)}`,
  workflowStakeholders: '/workflow/stakeholders',
  departments: '/departments',
  objections: '/objections',
  projectObjections: (projectId: string) => `/objections/project/${encodeURIComponent(projectId)}`,
  resolveObjection: (objectionId: string) => `/objections/${encodeURIComponent(objectionId)}/resolve`,
  rehabilitation: (projectId: string) => `/rehabilitation/project/${encodeURIComponent(projectId)}`,
  updateRehabilitation: (projectId: string) => `/rehabilitation/project/${encodeURIComponent(projectId)}/update`,
  documentUpload: '/documents/upload',
  projectDocuments: (projectId: string) => `/documents/project/${encodeURIComponent(projectId)}`,
  parcelMap: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/parcels/map`,
  dilrmp: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/dilrmp`,
  pfms: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/pfms`,
  pfmsPayments: '/pfms/payments',
  documentExtraction: '/documents/extract',
  delayRisk: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/delay-risk`,
  dashboardKpis: '/dashboard/kpis',
  alerts: '/alerts',
  parcelOwnership: (parcelId: string) => `/parcels/${encodeURIComponent(parcelId)}/ownership`,
  depositsForParcel: (parcelId: string) => `/deposits/parcel/${encodeURIComponent(parcelId)}`,
  deposits: '/deposits',
  releaseDeposit: (depositId: string) => `/deposits/${encodeURIComponent(depositId)}/release`,
} as const

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const pathOnly = (path: string) => {
  const withoutQuery = path.split(/[?#]/, 1)[0] || '/'
  const normalized = withoutQuery.replace(/\/+/g, '/')
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized
}

const projectIdFromPath = (path: string, suffix: string) => {
  const prefix = '/projects/'
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return undefined
  return decodeURIComponent(path.slice(prefix.length, -suffix.length).replace(/\/$/, ''))
}



const parseResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined
  const responseWithOptionalText = response as Response & { text?: () => Promise<string> }
  if (typeof responseWithOptionalText.text === 'function') {
    const text = await responseWithOptionalText.text()
    if (!text.trim()) return undefined
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new ApiError('API returned malformed JSON', { status: response.status, code: 'invalid_response' })
    }
  }
  return response.json()
}

const responseError = (method: string, path: string, status: number, payload: unknown): ApiError => {
  const value = payload && typeof payload === 'object' ? (payload as ApiErrorBody) : undefined
  const nested = value?.error
  const message =
    nested?.message ?? value?.message ?? (typeof payload === 'string' ? payload : `${method} ${path} failed with status ${status}`)
  return new ApiError(message, {
    status,
    code: nested?.code ?? value?.code ?? 'http_error',
    method,
    path,
    details: nested?.details ?? value?.details ?? payload,
  })
}

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    }
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`
    }
    const response = await fetch(`${activeBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers,
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    })
    if (response.ok) {
      const payload = await parseResponse(response)
      return payload as T
    }
    const errorPayload = await parseResponse(response).catch(() => undefined)
    throw responseError(method, path, response.status, errorPayload)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    // Removed mock logic entirely, throw error to UI
    console.error(`[LandFlow] Live backend at ${activeBaseUrl} unreachable for ${method} ${path}`, error)
    throw error
  }
}

export const apiClient: ApiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <TRequest, TResponse>(path: string, body: TRequest) => request<TResponse>('POST', path, body),

  health: () => request<HealthResponse>('GET', apiPaths.health),
  getHealth: () => request<HealthResponse>('GET', apiPaths.health),
  listProjects: () => request<ApiProject[]>('GET', apiPaths.projects),
  getProjects: () => request<ApiProject[]>('GET', apiPaths.projects),
  createProject: (body) => request<ApiProject>('POST', apiPaths.projects, body),
  getProject: (projectId) => request<ApiProject>('GET', apiPaths.project(projectId)),
  transitionProject: (projectId, body) => request<ApiProject>('POST', apiPaths.transition(projectId), body),
  getDashboard: () => request<DashboardResponse>('GET', apiPaths.dashboard),
  listAudit: () => request<AuditEntry[]>('GET', apiPaths.audit),
  getAudit: () => request<AuditEntry[]>('GET', apiPaths.audit),
  getParcelMap: (projectId) => request<ParcelMapResponse>('GET', apiPaths.parcelMap(projectId)),
  getDILRMP: (projectId) => request<DILRMPResponse>('GET', apiPaths.dilrmp(projectId)),
  getDilrmp: (projectId) => request<DILRMPResponse>('GET', apiPaths.dilrmp(projectId)),
  getPFMS: (projectId) => request<PFMSResponse>('GET', apiPaths.pfms(projectId)),
  getPfms: (projectId) => request<PFMSResponse>('GET', apiPaths.pfms(projectId)),
  submitPFMSPayment: (body) => request<PfmsPayment>('POST', apiPaths.pfmsPayments, body),
  extractDocument: (body) => request<DocumentExtractionResponse>('POST', apiPaths.documentExtraction, body),
  getDelayRisk: (projectId) => request<DelayRiskResponse>('GET', apiPaths.delayRisk(projectId)),

  // New MVP Live Methods
  listMapParcels: () => request<MapParcelFeature[]>('GET', apiPaths.mapParcels),
  getProjectMap: (projectId: string) => request<MapProjectResponse>('GET', apiPaths.mapProject(projectId)),
  lookupDilrmp: (surveyNumber: string) => request<DilrmpLookupResult>('POST', apiPaths.dilrmpLookup, { survey_number: surveyNumber }),
  disbursePfms: (projectId: string, beneficiaryRef: string, amountPaise: number) =>
    request<PfmsDisburseResult>('POST', apiPaths.pfmsDisburse, { project_id: projectId, beneficiary_reference: beneficiaryRef, amount_paise: amountPaise }),
  extractNotice: (text: string) => request<NoticeExtractionResult>('POST', apiPaths.aiExtractNotice, { text }),
  predictDelay: (pendingApprovals?: number, timelineDelayDays?: number, disputeCount?: number) =>
    request<DelayPredictResult>('POST', apiPaths.aiPredictDelay, { pending_approvals: pendingApprovals, timeline_delay_days: timelineDelayDays, dispute_count: disputeCount }),
  login: (role: Role, username?: string) =>
    request<{ token: string; role: Role; display_name: string; jurisdiction: string }>('POST', apiPaths.authLogin, { role, username }),
  getAuditTrail: () => request<AuditEntry[]>('GET', apiPaths.auditTrail),
  verifyAudit: () => request<AuditVerificationResult>('GET', apiPaths.auditVerify),
  advanceWorkflow: (workflowId: string, to: ProjectStage) =>
    request<WorkflowInstance>('POST', apiPaths.workflowAdvance(workflowId), { to }),
  approveWorkflow: (id: string, payload: StageGateDecisionPayload) =>
    request<StageGateDecisionResponse>('POST', apiPaths.workflowApprove(id), payload),
  rejectWorkflow: (id: string, payload: StageGateDecisionPayload) =>
    request<StageGateDecisionResponse>('POST', apiPaths.workflowReject(id), payload ?? {}),
  getWorkflowStatus: (id: string) =>
    request<WorkflowStatusResponse>('GET', apiPaths.workflowStatus(id)),
  getMyTasks: (role: string) => request<MyTaskItem[]>('GET', apiPaths.myTasks(role)),
  getMyTasksAuthenticated: () => request<MyTaskItem[]>('GET', apiPaths.myTasksAuthenticated),

  // /me family — consumed by src/rbac.ts (RbacContext, roleKpiCards, stageWorkflowActions)
  getMe: () => request<MeResponse>('GET', apiPaths.me),
  getMePermissions: () => request<MePermissionsResponse>('GET', apiPaths.mePermissions),
  getMeTasks: () => request<MeTaskItem[]>('GET', apiPaths.meTasks),
  getWorkflowHistory: (workflowId: string) =>
    request<ApprovalAction[]>('GET', apiPaths.workflowHistory(workflowId)),
  listWorkflowRegimes: () => request<WorkflowRegime[]>('GET', apiPaths.workflowRegimes),
  listDepartments: () => request<DepartmentInfo[]>('GET', apiPaths.departments),
  submitObjection: (body) => request<ObjectionItem>('POST', apiPaths.objections, body),
  listProjectObjections: (projectId: string) => request<ObjectionItem[]>('GET', apiPaths.projectObjections(projectId)),
  resolveObjection: (objectionId: string, resolution: string, status: string) =>
    request<ObjectionItem>('POST', apiPaths.resolveObjection(objectionId), { resolution, status }),
  getRehabilitation: (projectId: string) => request<RehabilitationInfo>('GET', apiPaths.rehabilitation(projectId)),
  updateRehabilitation: (projectId: string, entitlementsDelivered: number, status: string) =>
    request<RehabilitationInfo>('POST', apiPaths.updateRehabilitation(projectId), { entitlements_delivered: entitlementsDelivered, status }),
  uploadDocument: (body) => request<DocumentItem>('POST', apiPaths.documentUpload, body),
  listProjectDocuments: (projectId: string) => request<DocumentItem[]>('GET', apiPaths.projectDocuments(projectId)),
  mockEhrmsLogin: (employeeId: string) =>
    request<MockEhrmsLoginResponse>('POST', apiPaths.ehrmsLogin, { employee_id: employeeId }),
  listMockEhrmsEmployees: () =>
    request<EhrmsEmployee[]>('GET', apiPaths.ehrmsEmployees),
  listWorkflowStages: () => request<StageDefinition[]>('GET', apiPaths.workflowStages),
  getWorkflowStage: (code: string) => request<StageDefinition>('GET', apiPaths.workflowStage(code)),
  getWorkflowStakeholders: () => request<WorkflowStakeholdersResponse>('GET', apiPaths.workflowStakeholders),
  getDashboardKpis: () => request<DashboardKpi[]>('GET', apiPaths.dashboardKpis),
  getAlerts: () => request<AlertNotice[]>('GET', apiPaths.alerts),

  // Ownership status + deposit-with-authority sub-flow (Master PDF §3, migration 007)
  getParcelOwnership: (parcelId: string) => request<OwnershipStatusResponse>('GET', apiPaths.parcelOwnership(parcelId)),
  setParcelOwnership: (parcelId: string, ownershipStatus: string, actor?: string) =>
    request<OwnershipStatusResponse>('POST', apiPaths.parcelOwnership(parcelId), { ownership_status: ownershipStatus, actor }),
  listDepositsForParcel: (parcelId: string) => request<DepositWithAuthorityRecord[]>('GET', apiPaths.depositsForParcel(parcelId)),
  createDeposit: (payload: CreateDepositRequest) => request<DepositWithAuthorityRecord>('POST', apiPaths.deposits, payload),
  releaseDeposit: (depositId: string, payload: ReleaseDepositRequest) =>
    request<DepositWithAuthorityRecord>('POST', apiPaths.releaseDeposit(depositId), payload),
}

export const isApiConfigured = Boolean(activeBaseUrl)
export const isApiAuthenticated = Boolean(activeToken)

// Exported types from mockData.ts
export type Role =
  | 'Admin'
  | 'Collector'
  | 'Revenue Officer'
  | 'Land Owner'
  | 'Land Requiring Body'
  | 'Additional Collector'
  | 'GIS Officer'
  | 'SIA Officer'
  | 'Legal Officer'
  | 'Finance Officer'
  | 'Rehabilitation Officer'
  | 'Government Reviewer'
export type Language = 'en' | 'hi'

/** The statutory 15 RFCTLARR workflow stages emitted by the Rust domain service. */
export type ProjectStage =
  | 'proposal_initiation'
  | 'land_record_verification'
  | 'sia_preparation'
  | 'sia_review'
  | 'preliminary_notification'
  | 'objection_period'
  | 'hearing'
  | 'declaration'
  | 'award_preparation'
  | 'award_approval'
  | 'compensation_calculation'
  | 'payment_processing'
  | 'possession'
  | 'rr_completion'
  | 'project_closure'
  // Legacy aliases
  | 'draft'
  | 'sanctioned'
  | 'public_hearing'
  | 'survey'
  | 'compensation_award'
  | 'rr_scheme'
  | 'funds_disbursed'
  | 'completed'
  | 'lapsed'

export type Authority = 'larr' | 'national_highways'
export type ApiRole =
  | 'central_ministry_official'
  | 'state_revenue_department'
  | 'district_collector'
  | 'project_implementing_agency'
  | 'field_surveyor'
  | 'rr_administrator'
  | 'finance_controller'
  | 'legal_officer'
  | 'policy_maker'
  | 'audit_officer'
  | 'citizen_support_officer'

export type Jurisdiction =
  | 'national'
  | { state: { code: string } }
  | { district: { code: string } }
  | { field: { district_code: string } }
  | 'public'

export interface Actor {
  id: string
  role: ApiRole
  jurisdiction: Jurisdiction
}

/** UI projection retained for App.tsx. Backend records use ApiProject below. */
export interface Project {
  id: string
  name: string
  code: string
  location: string
  parcels: number
  acquired: number
  stage: string
  stageIndex: number
  status: 'On track' | 'Attention' | 'At risk'
  due: string
  owner: string
  amount: string
}

export interface WorkflowStage {
  name: string
  state: 'complete' | 'active' | 'queued'
  date?: string
}

export interface ApiParcel {
  id: string
  survey_number: string
  owner_name: string
  area_hectares: number
  district_code: string
}

/** Exact project shape currently serialized by services/api. */
export interface ApiProject {
  id: string
  name: string
  authority: Authority
  state_code: string
  district_code: string
  stage: ProjectStage
  parcels: ApiParcel[]
  preliminary_notification_at: string | null
  updated_at: string
}

export interface CreateProjectRequest {
  name: string
  authority: Authority
  state_code: string
  district_code: string
}

export interface TransitionRequest {
  to: ProjectStage
  actor: Actor
}

export interface HealthResponse {
  status: string
  service: string
}

export interface DashboardResponse {
  total_projects: number
  by_stage: Record<string, number>
}

export interface AuditEntry {
  sequence: number
  timestamp: string
  actor_id: string
  action: string
  resource: string
  payload: Record<string, unknown>
  previous_hash: string
  hash: string
}

export interface MapPoint {
  latitude: number
  longitude: number
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'Polygon'; coordinates: [number, number][][] }

export interface ParcelMapFeature {
  type: 'Feature'
  id: string
  geometry: GeoJsonGeometry
  properties: {
    parcel_id: string
    survey_number: string
    status: 'acquired' | 'under_review' | 'right_of_way'
    owner_name?: string
  }
}

export interface ParcelMapResponse {
  project_id: string
  source: 'dilrmp' | 'demo'
  center: MapPoint
  bounds: MapBounds
  parcels: ParcelMapFeature[]
  updated_at: string
}

export type DILRMPRecordStatus = 'matched' | 'pending' | 'mismatch'

export interface DILRMPRecord {
  id: string
  parcel_id: string
  survey_number: string
  ulpin: string | null
  owner_name: string
  district_code: string
  land_classification: string
  area_hectares: number
  status: DILRMPRecordStatus
  source: 'dilrmp'
  last_synced_at: string
}

export interface DILRMPResponse {
  project_id: string
  provider: 'DILRMP'
  status: 'connected' | 'degraded' | 'unavailable'
  records: DILRMPRecord[]
  matched_count: number
  pending_count: number
  last_synced_at: string
}

export type DilrmpResponse = DILRMPResponse

export interface PfmsPaymentRequest {
  project_id: string
  beneficiary_reference: string
  amount_paise: number
}

export interface PfmsPayment {
  reference: string
  project_id: string
  beneficiary_reference: string
  amount_paise: number
  status: 'accepted' | 'submitted' | 'settled' | 'failed'
  submitted_at: string
}

export interface PFMSResponse {
  project_id: string
  provider: 'PFMS'
  status: 'connected' | 'degraded' | 'unavailable'
  payments: PfmsPayment[]
  total_amount_paise: number
  last_synced_at: string
}

export type PfmsResponse = PFMSResponse

export interface DocumentExtractionRequest {
  file_name: string
  document_type?: 'award' | 'notification' | 'rr_scheme' | 'other'
  content_base64?: string
}

export interface ExtractedField {
  name: string
  value: string | number | null
  confidence: number
  source_page?: number
}

export interface DocumentExtractionResponse {
  document_id: string
  file_name: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  fields: ExtractedField[]
  warnings: string[]
  extracted_at: string | null
}

export type DocumentExtractionResult = DocumentExtractionResponse

export type DelayRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface DelayRiskFactor {
  code: string
  label: string
  impact: 'positive' | 'negative'
  score: number
  description: string
}

export interface DelayRiskResponse {
  project_id: string
  level: DelayRiskLevel
  score: number
  probability: number
  expected_delay_days: number
  factors: DelayRiskFactor[]
  generated_at: string
  model_version: string
}

export interface StatutoryStageMeta {
  code: ProjectStage
  name: string
  department: string
  role: string
  timelineDays: number
  approvalAuthority: string
  requiredDocs: string[]
  auditRequirements: string
}
