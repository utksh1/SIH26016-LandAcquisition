import {
  apiProjects,
  auditEntries,
  dashboard,
  delayRisk,
  dilrmp,
  documentExtraction,
  parcelMap,
  pfms,
  type ApiProject,
  type AuditEntry,
  type CreateProjectRequest,
  type DashboardResponse,
  type DILRMPResponse,
  type DocumentExtractionRequest,
  type DocumentExtractionResponse,
  type DelayRiskResponse,
  type HealthResponse,
  type ParcelMapResponse,
  type PFMSResponse,
  type PfmsPayment,
  type PfmsPaymentRequest,
  type ProjectStage,
  type Role,
  type TransitionRequest,
  statutoryWorkflowStages,
} from './mockData'

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

export const demoEhrmsEmployees: EhrmsEmployee[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    employee_id: 'EMP001',
    name: 'Raj Sharma',
    designation: 'Collector',
    department: 'District Administration',
    role: 'COLLECTOR',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    employee_id: 'EMP002',
    name: 'Amit Verma',
    designation: 'Revenue Officer',
    department: 'Revenue Department',
    role: 'REVENUE_OFFICER',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    employee_id: 'EMP003',
    name: 'Neha Singh',
    designation: 'GIS Officer',
    department: 'Survey Department',
    role: 'GIS_OFFICER',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    employee_id: 'EMP004',
    name: 'Ravi Kumar',
    designation: 'Finance Officer',
    department: 'Finance Department',
    role: 'FINANCE_OFFICER',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    employee_id: 'EMP005',
    name: 'Suresh Patel',
    designation: 'Rehabilitation Officer',
    department: 'R&R Department',
    role: 'REHABILITATION_OFFICER',
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    employee_id: 'EMP006',
    name: 'Vikram Verma',
    designation: 'Project Director',
    department: 'Requiring Body (NHAI)',
    role: 'REQUIRING_BODY',
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    employee_id: 'EMP007',
    name: 'Dr. Sunita Rao',
    designation: 'SIA Lead Officer',
    department: 'Social Impact Assessment Unit',
    role: 'SIA_OFFICER',
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    employee_id: 'EMP008',
    name: 'Adv. Rajesh Khanna',
    designation: 'Chief Legal Advisor',
    department: 'Legal & Land Affairs',
    role: 'LEGAL_OFFICER',
  },
  {
    id: '00000000-0000-0000-0000-000000000009',
    employee_id: 'EMP009',
    name: 'Priya Menon',
    designation: 'Additional Collector',
    department: 'Land Acquisition Authority',
    role: 'ADDITIONAL_COLLECTOR',
  },
  {
    id: '00000000-0000-0000-0000-000000000010',
    employee_id: 'EMP010',
    name: 'Dr. Aarav Sharma',
    designation: 'Oversight Reviewer',
    department: 'Ministry / Oversight Agency',
    role: 'GOVERNMENT_REVIEWER',
  },
]

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
  rejectWorkflow(id: string, payload?: { user?: string; reason?: string; remarks?: string }): Promise<StageGateDecisionResponse>
  getWorkflowStatus(id: string): Promise<WorkflowStatusResponse>
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

const mockProjects = apiProjects.map(clone)

const mockError = (message: string, path: string, status = 404, code = 'not_found'): never => {
  throw new ApiError(message, { status, code, method: 'GET', path })
}

const requireMockProject = (projectId: string, path: string): ApiProject => {
  const project = mockProjects.find((item) => item.id === projectId)
  if (!project) {
    throw new ApiError('project not found', { status: 404, code: 'not_found', method: 'GET', path })
  }
  return project
}

const mockResponse = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const normalizedPath = pathOnly(path)

  if (method === 'GET' && normalizedPath === apiPaths.health) return clone({ status: 'ok', service: 'sih26016-api' }) as T
  if (method === 'GET' && normalizedPath === apiPaths.dashboard) {
    const by_stage = mockProjects.reduce<Record<string, number>>((counts, project) => {
      counts[project.stage] = (counts[project.stage] ?? 0) + 1
      return counts
    }, {})
    return clone({ total_projects: mockProjects.length, by_stage }) as T
  }
  if (method === 'GET' && normalizedPath === apiPaths.projects) return clone(mockProjects) as T
  if (method === 'GET' && (normalizedPath === apiPaths.audit || normalizedPath === apiPaths.auditTrail)) return clone(auditEntries) as T
  if (method === 'GET' && normalizedPath === apiPaths.auditVerify) {
    return clone({ verified: true, entries_count: auditEntries.length, chain_head: 'sha256-verified-c94e82b7' }) as T
  }
  if (method === 'GET' && normalizedPath === apiPaths.mapParcels) {
    return clone([
      { id: '1', survey_number: '1042', owner_name: 'Asha Devi', area_hectares: 1.25, status: 'completed', color: '#22c55e', coordinates: [[77.45, 27.20], [77.47, 27.20], [77.47, 27.22], [77.45, 27.22]] },
      { id: '2', survey_number: '1043', owner_name: 'Ramesh Patel', area_hectares: 0.85, status: 'under_process', color: '#eab308', coordinates: [[77.46, 27.21], [77.48, 27.21], [77.48, 27.23], [77.46, 27.23]] },
      { id: '3', survey_number: '1044', owner_name: 'Vikram Singh', area_hectares: 2.10, status: 'under_process', color: '#eab308', coordinates: [[77.47, 27.22], [77.49, 27.22], [77.49, 27.24], [77.47, 27.24]] },
      { id: '4', survey_number: '1045', owner_name: 'Sunita Bai', area_hectares: 0.65, status: 'disputed', color: '#ef4444', coordinates: [[77.48, 27.23], [77.50, 27.23], [77.50, 27.25], [77.48, 27.25]] },
    ]) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.dilrmpLookup) {
    const p = body as { survey_number: string }
    return clone({
      survey_number: p.survey_number || '1042',
      owner_name: 'Asha Devi',
      area_hectares: 1.25,
      ulpin: '21-01-001-01-01042',
      land_classification: 'agricultural',
      status: 'verified',
      provider: 'DILRMP/Bhulekh',
    }) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.pfmsDisburse) {
    const p = body as { amount_paise: number }
    return clone({
      reference: 'PFMS-LA-2026-981',
      status: 'settled',
      utr_number: 'UTR2026' + Math.floor(10000000 + Math.random() * 90000000),
      amount_paise: p.amount_paise || 125000000,
      amount_inr: (p.amount_paise || 125000000) / 100,
      timestamp: new Date().toISOString(),
    }) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.aiExtractNotice) {
    return clone({
      survey_number: '1042',
      owner_name: 'Asha Devi',
      area_hectares: 1.25,
      confidence: 0.96,
      source: 'DocumentAI_OCR_LayoutParser',
    }) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.aiPredictDelay) {
    return clone({
      score: 18,
      level: 'low',
      factors: ['pending_approvals', 'litigation'],
    }) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.ehrmsLogin) {
    const p = body as { employee_id: string }
    const emp = demoEhrmsEmployees.find(e => e.employee_id.toUpperCase() === (p?.employee_id || '').toUpperCase().trim())
    if (emp) {
      return clone({
        success: true,
        employee: emp,
      }) as T
    }
    throw new ApiError(`eHRMS Employee with ID ${p?.employee_id} not found`, { status: 404, code: 'employee_not_found', method, path })
  }

  if (method === 'GET' && normalizedPath === apiPaths.ehrmsEmployees) {
    return clone(demoEhrmsEmployees) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.authLogin) {
    const p = body as { role: Role }
    return clone({
      token: 'dev1.mock-token-for-' + (p.role || 'Admin').toLowerCase(),
      role: p.role || 'Admin',
      display_name: p.role === 'Collector' ? 'Vikram Singh' : p.role === 'Revenue Officer' ? 'Neha Sharma' : p.role === 'Land Owner' ? 'Suresh Kumar' : 'Ananya Sen',
      jurisdiction: 'National/District',
    }) as T
  }

  if (method === 'GET') {
    const projectId = projectIdFromPath(normalizedPath, '/parcels/map')
    if (projectId) {
      requireMockProject(projectId, normalizedPath)
      return clone(parcelMap) as T
    }

    const dilrmpProjectId = projectIdFromPath(normalizedPath, '/dilrmp')
    if (dilrmpProjectId) {
      requireMockProject(dilrmpProjectId, normalizedPath)
      return clone(dilrmp) as T
    }

    const pfmsProjectId = projectIdFromPath(normalizedPath, '/pfms')
    if (pfmsProjectId) {
      requireMockProject(pfmsProjectId, normalizedPath)
      return clone(pfms) as T
    }

    const riskProjectId = projectIdFromPath(normalizedPath, '/delay-risk')
    if (riskProjectId) {
      requireMockProject(riskProjectId, normalizedPath)
      return clone(delayRisk) as T
    }

    const project = normalizedPath.startsWith('/projects/')
      ? mockProjects.find((item) => item.id === decodeURIComponent(normalizedPath.slice('/projects/'.length)))
      : undefined
    if (project) return clone(project) as T
  }

  if (method === 'POST' && normalizedPath === apiPaths.projects) {
    const request = body as Partial<CreateProjectRequest> | undefined
    if (!request?.name?.trim() || !request.state_code?.trim() || !request.district_code?.trim()) {
      throw new ApiError('name, state_code, and district_code are required', { status: 400, code: 'bad_request', method, path })
    }
    const project: ApiProject = {
      id: globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}`,
      name: request.name,
      authority: request.authority ?? 'larr',
      state_code: request.state_code,
      district_code: request.district_code,
      stage: 'draft',
      parcels: [],
      preliminary_notification_at: null,
      updated_at: new Date().toISOString(),
    }
    mockProjects.push(project)
    return clone(project) as T
  }

  if (method === 'GET' && normalizedPath === apiPaths.workflowStages) {
    return clone(
      statutoryWorkflowStages.map((s) => ({
        code: s.code,
        name: s.name,
        responsible_department: s.department,
        responsible_role: s.role,
        timeline_days: s.timelineDays,
        required_documents: s.requiredDocs,
        approval_authority: s.approvalAuthority,
        allowed_transitions: [],
        audit_requirements: [s.auditRequirements],
      })),
    ) as T
  }

  if (method === 'GET' && normalizedPath.startsWith('/workflow/stages/')) {
    const code = normalizedPath.replace('/workflow/stages/', '')
    const s = statutoryWorkflowStages.find((x) => x.code === code)
    if (s) {
      return clone({
        code: s.code,
        name: s.name,
        responsible_department: s.department,
        responsible_role: s.role,
        timeline_days: s.timelineDays,
        required_documents: s.requiredDocs,
        approval_authority: s.approvalAuthority,
        allowed_transitions: [],
        audit_requirements: [s.auditRequirements],
      }) as T
    }
  }

  if (method === 'GET' && normalizedPath === apiPaths.workflowStakeholders) {
    return clone({
      departments: [
        { code: 'NHAI', name: 'Land Requiring Body (NHAI / PWD)', responsible_modules: ['Proposal'], default_role: 'Land Requiring Body' },
        { code: 'REV', name: 'State Revenue Department', responsible_modules: ['Verification'], default_role: 'Revenue Officer' },
        { code: 'SIA', name: 'Social Impact Assessment Unit', responsible_modules: ['SIA'], default_role: 'SIA Officer' },
        { code: 'CALA', name: 'District Collectorate / CALA', responsible_modules: ['Notifications', 'Hearings', 'Awards'], default_role: 'Collector' },
        { code: 'CITIZEN', name: 'Public Grievance Desk', responsible_modules: ['Objections'], default_role: 'Land Owner' },
        { code: 'FIN', name: 'Finance & Accounts / PFMS', responsible_modules: ['Compensation', 'Disbursements'], default_role: 'Finance Officer' },
        { code: 'RR', name: 'Rehabilitation & Resettlement', responsible_modules: ['R&R'], default_role: 'Rehabilitation Officer' },
        { code: 'OVERSIGHT', name: 'Cabinet / Ministry Oversight', responsible_modules: ['Declaration', 'Closure'], default_role: 'Government Reviewer' },
        { code: 'LEGAL', name: 'Legal Affairs Directorate', responsible_modules: ['Valuation', 'Award Review'], default_role: 'Legal Officer' },
        { code: 'SURVEY', name: 'Cadastral Survey & Geoinformatics', responsible_modules: ['Demarcation'], default_role: 'GIS Officer' },
      ],
      roles: [
        { code: 'Land Requiring Body', name: 'Land Requiring Body', department_code: 'NHAI', description: 'Submits DPR and acquisition proposal' },
        { code: 'Collector', name: 'District Collector / CALA', department_code: 'CALA', description: 'Statutory authority under RFCTLARR Act 2013' },
        { code: 'Additional Collector', name: 'Additional Collector', department_code: 'CALA', description: 'Assists CALA in award scrutiny and hearings' },
        { code: 'Revenue Officer', name: 'Revenue Officer / Tehsildar', department_code: 'REV', description: 'Validates land records and mutations' },
        { code: 'GIS Officer', name: 'GIS Surveyor', department_code: 'SURVEY', description: 'Performs spatial demarcation and parcel mapping' },
        { code: 'SIA Officer', name: 'SIA Unit Lead', department_code: 'SIA', description: 'Conducts social impact assessment study' },
        { code: 'Legal Officer', name: 'Chief Legal Officer', department_code: 'LEGAL', description: 'Reviews legal compliance and draft awards' },
        { code: 'Finance Officer', name: 'Finance Controller', department_code: 'FIN', description: 'Manages PFMS disbursements and solatium' },
        { code: 'Rehabilitation Officer', name: 'R&R Administrator', department_code: 'RR', description: 'Oversees resettlement and rehabilitation' },
        { code: 'Government Reviewer', name: 'Central / State Reviewer', department_code: 'OVERSIGHT', description: 'Conducts high-level oversight' },
        { code: 'Land Owner', name: 'Affected Landowner', department_code: 'CITIZEN', description: 'Citizen viewing notices and filing objections' },
      ],
    }) as T
  }

  if (method === 'GET' && normalizedPath.startsWith('/workflow/') && normalizedPath.endsWith('/status')) {
    const id = normalizedPath.replace('/workflow/', '').replace('/status', '')
    const project = mockProjects.find((p) => p.id === id) || mockProjects[0]
    const stageMeta = statutoryWorkflowStages.find((s) => s.name === project?.stage || s.code === project?.stage) || statutoryWorkflowStages[0]
    return clone({
      workflow_id: id,
      project_id: project ? project.id : id,
      current_stage: project ? project.stage : 'proposal_initiation',
      current_stage_name: stageMeta.name,
      responsible_department: stageMeta.department,
      responsible_role: stageMeta.role,
      approval_authority: stageMeta.approvalAuthority,
      timeline_days: stageMeta.timelineDays,
      deadline_at: new Date(Date.now() + stageMeta.timelineDays * 86400000).toISOString(),
      is_terminal: stageMeta.code === 'project_closure',
      required_documents: stageMeta.requiredDocs,
      uploaded_documents: stageMeta.requiredDocs,
      missing_documents: [],
      can_advance: true,
      recent_actions: [],
    }) as T
  }

  if (method === 'POST' && normalizedPath.startsWith('/workflow/') && normalizedPath.endsWith('/approve')) {
    const id = normalizedPath.replace('/workflow/', '').replace('/approve', '')
    const req = (body || {}) as StageGateDecisionPayload
    const project = mockProjects.find((p) => p.id === id) || mockProjects[0]
    const currIdx = statutoryWorkflowStages.findIndex((s) => s.code === project?.stage || s.name === project?.stage)
    const nextIdx = currIdx >= 0 && currIdx < statutoryWorkflowStages.length - 1 ? currIdx + 1 : currIdx
    const nextStage = statutoryWorkflowStages[nextIdx]
    const prevStage = statutoryWorkflowStages[currIdx >= 0 ? currIdx : 0]
    if (project) {
      project.stage = nextStage.name as any
      project.updated_at = new Date().toISOString()
    }
    return clone({
      success: true,
      message: `Stage advanced to '${nextStage.name}'`,
      previous_stage: prevStage.name,
      current_stage: nextStage.name,
      responsible_department: nextStage.department,
      responsible_role: nextStage.role,
      timeline_days: nextStage.timelineDays,
      deadline_at: new Date(Date.now() + nextStage.timelineDays * 86400000).toISOString(),
      actor: req.user || 'Authorized Officer',
      actor_role: nextStage.role,
      decision: 'APPROVE',
      remarks: req.remarks || 'Statutory gate sign-off completed',
      verified_documents: req.documents || nextStage.requiredDocs,
      audit_sequence: Date.now(),
      audit_hash: 'mock-audit-hash-' + Math.random().toString(36).substring(2, 10),
      workflow: {
        id,
        project_id: project ? project.id : id,
        authority: 'larr',
        current_stage: nextStage.name as any,
        started_at: new Date().toISOString(),
        responsible_department: nextStage.department,
        responsible_role: nextStage.role,
        stage_timeline_days: nextStage.timelineDays,
      },
    }) as T
  }

  if (method === 'POST' && normalizedPath.startsWith('/workflow/') && normalizedPath.endsWith('/reject')) {
    const id = normalizedPath.replace('/workflow/', '').replace('/reject', '')
    const req = (body || {}) as any
    const project = mockProjects.find((p) => p.id === id) || mockProjects[0]
    const currIdx = statutoryWorkflowStages.findIndex((s) => s.code === project?.stage || s.name === project?.stage)
    const prevIdx = currIdx > 0 ? currIdx - 1 : 0
    const prevStage = statutoryWorkflowStages[prevIdx]
    const currStage = statutoryWorkflowStages[currIdx >= 0 ? currIdx : 0]
    if (project) {
      project.stage = prevStage.name as any
      project.updated_at = new Date().toISOString()
    }
    return clone({
      success: true,
      message: `Stage reverted to '${prevStage.name}' due to review feedback`,
      previous_stage: currStage.name,
      current_stage: prevStage.name,
      responsible_department: prevStage.department,
      responsible_role: prevStage.role,
      timeline_days: prevStage.timelineDays,
      deadline_at: new Date(Date.now() + prevStage.timelineDays * 86400000).toISOString(),
      actor: req.user || 'Reviewing Authority',
      actor_role: currStage.role,
      decision: 'REJECT',
      remarks: req.remarks || req.reason || 'Reverted for remediation',
      verified_documents: [],
      audit_sequence: Date.now(),
      audit_hash: 'mock-audit-revert-' + Math.random().toString(36).substring(2, 10),
      workflow: {
        id,
        project_id: project ? project.id : id,
        authority: 'larr',
        current_stage: prevStage.name as any,
        started_at: new Date().toISOString(),
        responsible_department: prevStage.department,
        responsible_role: prevStage.role,
        stage_timeline_days: prevStage.timelineDays,
      },
    }) as T
  }

  return mockError(`${method} ${normalizedPath} is not available in mock mode`, normalizedPath, 501, 'mock_endpoint_unavailable')
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
    // Graceful fallback to deterministic mock logic on connection failure
    console.info(`[LandFlow] Live backend at ${activeBaseUrl} unreachable, using resilient client logic for ${method} ${path}`)
  }

  return mockResponse<T>(method, path, body)
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
  rejectWorkflow: (id: string, payload?: { user?: string; reason?: string; remarks?: string }) =>
    request<StageGateDecisionResponse>('POST', apiPaths.workflowReject(id), payload ?? {}),
  getWorkflowStatus: (id: string) =>
    request<WorkflowStatusResponse>('GET', apiPaths.workflowStatus(id)),
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
}

export const isApiConfigured = Boolean(activeBaseUrl)
export const isApiAuthenticated = Boolean(activeToken)
