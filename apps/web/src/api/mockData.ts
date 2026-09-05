export type Role = 'Admin' | 'Collector' | 'Revenue Officer' | 'Land Owner'
export type Language = 'en' | 'hi'

/** The workflow values emitted by the Rust domain service. */
export type ProjectStage =
  | 'draft'
  | 'sanctioned'
  | 'preliminary_notification'
  | 'public_hearing'
  | 'survey'
  | 'compensation_award'
  | 'rr_scheme'
  | 'funds_disbursed'
  | 'possession'
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

export const projects: Project[] = [
  { id: 'NH-48', name: 'NH-48 Widening — Package II', code: 'PRJ-2024-084', location: 'Bharatpur · Rajasthan', parcels: 1284, acquired: 976, stage: 'Compensation award', stageIndex: 4, status: 'Attention', due: '18 Sep 2026', owner: 'Collector', amount: '₹184.6 Cr' },
  { id: 'DMIC-07', name: 'Delhi–Mumbai Industrial Corridor', code: 'PRJ-2024-061', location: 'Dausa · Rajasthan', parcels: 832, acquired: 832, stage: 'Possession & handover', stageIndex: 6, status: 'On track', due: '30 Sep 2026', owner: 'Admin', amount: '₹96.2 Cr' },
  { id: 'RAP-19', name: 'Regional Airport Expansion', code: 'PRJ-2025-019', location: 'Kushinagar · Uttar Pradesh', parcels: 406, acquired: 87, stage: 'R&R plan review', stageIndex: 5, status: 'At risk', due: '04 Oct 2026', owner: 'Collector', amount: '₹52.8 Cr' },
  { id: 'SOL-03', name: 'Solar Park — Tranche 3', code: 'PRJ-2025-033', location: 'Kurnool · Andhra Pradesh', parcels: 2160, acquired: 1450, stage: 'Social impact assessment', stageIndex: 2, status: 'On track', due: '12 Nov 2026', owner: 'Revenue Officer', amount: '₹241.4 Cr' },
]

export const selectedProject = projects[0]

export const workflow: WorkflowStage[] = [
  { name: 'Project sanction', state: 'complete', date: '12 Feb 2025' },
  { name: 'Preliminary notification', state: 'complete', date: '27 Mar 2025' },
  { name: 'Survey & objections', state: 'complete', date: '19 Jun 2025' },
  { name: 'Compensation award', state: 'active', date: 'Due 18 Sep' },
  { name: 'R&R & disbursement', state: 'queued' },
  { name: 'Possession & handover', state: 'queued' },
]

export const kpis = [
  { label: 'Active projects', value: '42', delta: '+6 this quarter', tone: 'mint', icon: '⌁' },
  { label: 'Land acquired', value: '68.4%', delta: '+4.8% vs last month', tone: 'gold', icon: '◒' },
  { label: 'Compensation pending', value: '₹312 Cr', delta: '18 awards need action', tone: 'coral', icon: '₹' },
  { label: 'Days to next gate', value: '13', delta: 'NH-48 · 18 Sep 2026', tone: 'blue', icon: '↗' },
]

export const notices = [
  { label: 'GATE 04', title: 'Compensation award pack needs approval', detail: '12 of 18 village-level packets are ready for CALA sign-off.', tone: 'coral' },
  { label: 'PFMS', title: '₹46.2 Cr released to district escrow', detail: 'Settlement batch PF-2026-091 cleared 06 Sep 2026.', tone: 'mint' },
  { label: 'R&R', title: 'Household verification window closes soon', detail: 'Kushinagar submissions close in 9 days.', tone: 'gold' },
]

const demoProjectId = '11111111-1111-4111-8111-111111111111'
const demoParcelIds = [
  '21111111-1111-4111-8111-111111111111',
  '21111111-1111-4111-8111-111111111112',
  '21111111-1111-4111-8111-111111111113',
]

export const apiProjects: ApiProject[] = [
  {
    id: demoProjectId,
    name: 'NH-48 Widening — Package II',
    authority: 'national_highways',
    state_code: 'RJ',
    district_code: 'BHR',
    stage: 'compensation_award',
    parcels: [
      { id: demoParcelIds[0], survey_number: 'BH-48-1042', owner_name: 'Suresh Kumar', area_hectares: 1.82, district_code: 'BHR' },
      { id: demoParcelIds[1], survey_number: 'BH-48-1043', owner_name: 'Meena Devi', area_hectares: 2.14, district_code: 'BHR' },
      { id: demoParcelIds[2], survey_number: 'BH-48-1044', owner_name: 'Rafiq Khan', area_hectares: 0.96, district_code: 'BHR' },
    ],
    preliminary_notification_at: '2025-03-27T09:00:00Z',
    updated_at: '2026-09-05T03:12:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Delhi–Mumbai Industrial Corridor',
    authority: 'national_highways',
    state_code: 'RJ',
    district_code: 'DAU',
    stage: 'possession',
    parcels: [
      { id: '22111111-1111-4111-8111-111111111111', survey_number: 'DAU-07-208', owner_name: 'Kamal Singh', area_hectares: 1.3, district_code: 'DAU' },
    ],
    preliminary_notification_at: '2025-01-16T09:00:00Z',
    updated_at: '2026-09-04T11:42:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Regional Airport Expansion',
    authority: 'larr',
    state_code: 'UP',
    district_code: 'KSH',
    stage: 'rr_scheme',
    parcels: [
      { id: '33111111-1111-4111-8111-111111111111', survey_number: 'KSH-19-88', owner_name: 'Asha Yadav', area_hectares: 0.74, district_code: 'KSH' },
    ],
    preliminary_notification_at: '2025-07-02T09:00:00Z',
    updated_at: '2026-09-03T08:10:00Z',
  },
]

export const dashboard: DashboardResponse = {
  total_projects: apiProjects.length,
  by_stage: {
    compensation_award: 1,
    possession: 1,
    rr_scheme: 1,
  },
}

export const auditEntries: AuditEntry[] = [
  {
    sequence: 1,
    timestamp: '2026-09-05T03:04:00Z',
    actor_id: '00000000-0000-0000-0000-000000000001',
    action: 'project_created',
    resource: `project/${demoProjectId}`,
    payload: { stage: 'draft' },
    previous_hash: '',
    hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  {
    sequence: 2,
    timestamp: '2026-09-05T03:12:00Z',
    actor_id: '00000000-0000-0000-0000-000000000002',
    action: 'project_transitioned',
    resource: `project/${demoProjectId}`,
    payload: { from: 'survey', to: 'compensation_award' },
    previous_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
]

export const parcelMap: ParcelMapResponse = {
  project_id: demoProjectId,
  source: 'demo',
  center: { latitude: 27.2152, longitude: 77.4903 },
  bounds: { north: 27.238, south: 27.192, east: 77.532, west: 77.451 },
  parcels: [
    { type: 'Feature', id: demoParcelIds[0], geometry: { type: 'Polygon', coordinates: [[[77.46, 27.21], [77.475, 27.218], [77.469, 27.23], [77.452, 27.222], [77.46, 27.21]]] }, properties: { parcel_id: demoParcelIds[0], survey_number: 'BH-48-1042', status: 'acquired', owner_name: 'Suresh Kumar' } },
    { type: 'Feature', id: demoParcelIds[1], geometry: { type: 'Polygon', coordinates: [[[77.475, 27.218], [77.493, 27.224], [77.488, 27.237], [77.469, 27.23], [77.475, 27.218]]] }, properties: { parcel_id: demoParcelIds[1], survey_number: 'BH-48-1043', status: 'under_review', owner_name: 'Meena Devi' } },
    { type: 'Feature', id: demoParcelIds[2], geometry: { type: 'Polygon', coordinates: [[[77.493, 27.224], [77.512, 27.216], [77.526, 27.228], [77.508, 27.241], [77.493, 27.224]]] }, properties: { parcel_id: demoParcelIds[2], survey_number: 'BH-48-1044', status: 'right_of_way', owner_name: 'Rafiq Khan' } },
  ],
  updated_at: '2026-09-05T03:00:00Z',
}

export const dilrmp: DILRMPResponse = {
  project_id: demoProjectId,
  provider: 'DILRMP',
  status: 'connected',
  records: apiProjects[0].parcels.map((parcel, index) => ({
    id: `dilrmp-${index + 1}`,
    parcel_id: parcel.id,
    survey_number: parcel.survey_number,
    ulpin: `RJ${String(100000000000000 + index).slice(0, 15)}`,
    owner_name: parcel.owner_name,
    district_code: parcel.district_code,
    land_classification: index === 2 ? 'right_of_way' : 'agricultural',
    area_hectares: parcel.area_hectares,
    status: index === 1 ? 'pending' : 'matched',
    source: 'dilrmp' as const,
    last_synced_at: '2026-09-05T02:58:00Z',
  })),
  matched_count: 2,
  pending_count: 1,
  last_synced_at: '2026-09-05T02:58:00Z',
}

export const pfms: PFMSResponse = {
  project_id: demoProjectId,
  provider: 'PFMS',
  status: 'connected',
  payments: [
    { reference: 'PF-2026-091', project_id: demoProjectId, beneficiary_reference: 'BHR-ESCROW-01', amount_paise: 462000000, status: 'settled', submitted_at: '2026-09-04T06:30:00Z' },
    { reference: 'PF-2026-094', project_id: demoProjectId, beneficiary_reference: 'BHR-AWARD-12', amount_paise: 128000000, status: 'submitted', submitted_at: '2026-09-05T02:55:00Z' },
  ],
  total_amount_paise: 590000000,
  last_synced_at: '2026-09-05T03:01:00Z',
}

export const documentExtraction: DocumentExtractionResponse = {
  document_id: 'doc-2026-0001',
  file_name: 'nh48-compensation-award-pack.pdf',
  status: 'completed',
  fields: [
    { name: 'project_reference', value: 'PRJ-2024-084', confidence: 0.99, source_page: 1 },
    { name: 'award_amount_paise', value: 1280000000, confidence: 0.96, source_page: 4 },
    { name: 'village_count', value: 18, confidence: 0.94, source_page: 2 },
  ],
  warnings: ['One beneficiary account reference requires manual verification.'],
  extracted_at: '2026-09-05T02:45:00Z',
}

export const delayRisk: DelayRiskResponse = {
  project_id: demoProjectId,
  level: 'high',
  score: 0.72,
  probability: 0.72,
  expected_delay_days: 21,
  factors: [
    { code: 'award_packets', label: 'Award packets awaiting sign-off', impact: 'negative', score: 0.81, description: '6 village-level packets remain with the CALA.' },
    { code: 'dilrmp_sync', label: 'DILRMP ownership match', impact: 'positive', score: 0.88, description: 'Most parcel records reconcile with the land register.' },
    { code: 'pfms_batch', label: 'PFMS settlement batch', impact: 'positive', score: 0.76, description: 'Escrow funding is available for the next award batch.' },
  ],
  generated_at: '2026-09-05T03:02:00Z',
  model_version: 'rules-mvp-1',
}
