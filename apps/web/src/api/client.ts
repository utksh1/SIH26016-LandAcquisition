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
  type TransitionRequest,
} from './mockData'

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

/** An HTTP, network, or malformed-response failure from the workflow API. */
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
}

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '')

export const apiPaths = {
  health: '/health',
  projects: '/projects',
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  transition: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/transition`,
  dashboard: '/dashboard',
  audit: '/audit',
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
  if (method === 'GET' && normalizedPath === apiPaths.audit) return clone(auditEntries) as T

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

  if (method === 'POST') {
    const projectId = projectIdFromPath(normalizedPath, '/transition')
    if (projectId) {
      const project = requireMockProject(projectId, normalizedPath)
      const request = body as Partial<TransitionRequest> | undefined
      if (!request?.to || !request.actor) {
        throw new ApiError('to and actor are required', { status: 400, code: 'bad_request', method, path })
      }
      project.stage = request.to
      project.updated_at = new Date().toISOString()
      return clone(project) as T
    }

    if (normalizedPath === apiPaths.documentExtraction) {
      const request = body as Partial<DocumentExtractionRequest> | undefined
      if (!request?.file_name?.trim()) {
        throw new ApiError('file_name is required', { status: 400, code: 'bad_request', method, path })
      }
      return clone({
        ...documentExtraction,
        document_id: `doc-${Date.now()}`,
        file_name: request.file_name,
        status: 'completed',
        extracted_at: new Date().toISOString(),
      }) as T
    }

    if (normalizedPath === apiPaths.pfmsPayments) {
      const request = body as Partial<PfmsPaymentRequest> | undefined
      if (!request?.project_id || !request.beneficiary_reference || typeof request.amount_paise !== 'number') {
        throw new ApiError('project_id, beneficiary_reference, and amount_paise are required', { status: 400, code: 'bad_request', method, path })
      }
      const payment: PfmsPayment = {
        reference: `DEMO-${request.project_id}`,
        project_id: request.project_id,
        beneficiary_reference: request.beneficiary_reference,
        amount_paise: request.amount_paise,
        status: 'accepted',
        submitted_at: new Date().toISOString(),
      }
      return clone(payment) as T
    }
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
  const value = payload && typeof payload === 'object' ? payload as ApiErrorBody : undefined
  const nested = value?.error
  const message = nested?.message ?? value?.message ?? (typeof payload === 'string' ? payload : `${method} ${path} failed with status ${status}`)
  return new ApiError(message, {
    status,
    code: nested?.code ?? value?.code ?? 'http_error',
    method,
    path,
    details: nested?.details ?? value?.details ?? payload,
  })
}

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  if (!baseUrl) return mockResponse<T>(method, path, body)

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed'
    throw new ApiError(message, { code: 'network_error', method, path, status: 0 })
  }

  let payload: unknown
  try {
    payload = await parseResponse(response)
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(error.message, { status: response.status, code: error.code, method, path })
    }
    throw new ApiError('Unable to read API response', { status: response.status, code: 'invalid_response', method, path })
  }
  if (!response.ok) throw responseError(method, path, response.status, payload)
  return payload as T
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
}

export const isApiConfigured = Boolean(baseUrl)
