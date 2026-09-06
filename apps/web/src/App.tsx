import { useEffect, useMemo, useState } from 'react'
import {
  apiClient,
  isApiConfigured,
  type EhrmsEmployee,
  type MapParcelFeature,
  type DilrmpLookupResult,
  type PfmsDisburseResult,
  type NoticeExtractionResult,
  type DelayPredictResult,
  type AuditVerificationResult,
  type WorkflowRegime,
  type DepartmentInfo,
  type ObjectionItem,
  type RehabilitationInfo,
  type DashboardKpi,
  type AlertNotice,
  type DepositWithAuthorityRecord,
  type OwnershipStatusResponse,
  type ApiProject,
  type Language,
  type Project,
  type ProjectStage,
  type Role,
} from './api/client'

const DEFAULT_PROJECT: Project = {
  id: '',
  name: '',
  code: '',
  location: '',
  parcels: 0,
  acquired: 0,
  stage: 'Proposal Creation',
  stageIndex: 0,
  status: 'On track' as const,
  due: '',
  owner: '',
  amount: '',
}

const DEFAULT_KPIS: DashboardKpi[] = [
  { label: 'Active projects', value: '1', delta: '+1 this quarter', tone: 'mint', icon: '⌁' },
  { label: 'Land acquired', value: '2.5 Ha', delta: 'Verified via DILRMP', tone: 'gold', icon: '◒' },
  { label: 'Compensation pending', value: '₹312 Cr', delta: 'PFMS DBT pipeline ready', tone: 'coral', icon: '₹' },
  { label: 'Statutory SLA compliance', value: '100%', delta: 'RFCTLARR 2013 schedule', tone: 'blue', icon: '↗' },
]

const DEFAULT_NOTICES: AlertNotice[] = [
  { label: 'GATE 04', title: 'Compensation award pack needs approval', detail: '12 of 18 village-level packets are ready for CALA sign-off.', tone: 'coral' },
  { label: 'PFMS', title: '₹46.2 Cr released to district escrow', detail: 'Settlement batch PF-2026-091 cleared 06 Sep 2026.', tone: 'mint' },
  { label: 'R&R', title: 'Household verification window closes soon', detail: 'Kushinagar submissions close in 9 days.', tone: 'gold' },
]

type IconName =
  | 'grid'
  | 'folder'
  | 'map'
  | 'people'
  | 'shield'
  | 'search'
  | 'bell'
  | 'arrow'
  | 'chevron'
  | 'calendar'
  | 'more'
  | 'download'
  | 'close'
  | 'check'
  | 'plus'
  | 'refresh'
  | 'file'
  | 'currency'
  | 'building'
  | 'home'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'map':
      return (
        <svg {...common}>
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
      )
    case 'people':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a2.5 2.5 0 0 1 0 5M17 14a4.5 4.5 0 0 1 4 5" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.6" />
          <path d="m16 16 4.7 4.7" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M16 2.5v4M8 2.5v4M3 9h18" />
        </svg>
      )
    case 'more':
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.4L3 16M3 21v-5h5" />
        </svg>
      )
    case 'file':
      return (
        <svg {...common}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
    case 'currency':
      return (
        <svg {...common}>
          <line x1="6" y1="4" x2="18" y2="4" />
          <line x1="6" y1="9" x2="18" y2="9" />
          <path d="M6 4h7a4 4 0 0 1 0 8H6" />
          <line x1="6" y1="12" x2="18" y2="21" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
  }
}

export type StakeholderId =
  | 'requiring_body'
  | 'collector'
  | 'additional_collector'
  | 'revenue_officer'
  | 'gis_surveyor'
  | 'sia_officer'
  | 'legal_officer'
  | 'finance_officer'
  | 'rehabilitation_officer'
  | 'government_dashboard'
  | 'land_owner'

export interface StakeholderPersona {
  id: StakeholderId
  employeeId?: string
  role: Role
  ehrmsRole?: string
  dashboardRoute: string
  title: string
  subtitle: string
  name: string
  designation: string
  department: string
  badge: string
  icon: IconName
  color: string
  description: string
}

const stakeholderPersonas: StakeholderPersona[] = [
  {
    id: 'collector',
    employeeId: 'EMP001',
    role: 'Collector',
    ehrmsRole: 'COLLECTOR',
    dashboardRoute: '/dashboard/collector',
    title: 'Collector',
    subtitle: 'District Administration / CALA',
    name: 'Raj Sharma',
    designation: 'Collector',
    department: 'District Administration',
    badge: 'COLLECTOR [EMP001]',
    icon: 'folder',
    color: '#b68349',
    description: 'Active projects review, pending statutory gate approvals, acquisition workflow status, notifications, and reports.',
  },
  {
    id: 'additional_collector',
    employeeId: 'EMP008',
    role: 'Additional Collector',
    ehrmsRole: 'ADDITIONAL_COLLECTOR',
    dashboardRoute: '/dashboard/collector',
    title: 'Additional Collector',
    subtitle: 'District Collectorate / CALA',
    name: 'Harish Meena',
    designation: 'Additional Collector',
    department: 'District Collectorate / CALA',
    badge: 'ADDL COLLECTOR [EMP008]',
    icon: 'folder',
    color: '#9c6f39',
    description: 'Section 19 declaration scrutiny, Section 23/30 award scrutiny, and multi-tehsil coordination.',
  },
  {
    id: 'revenue_officer',
    employeeId: 'EMP002',
    role: 'Revenue Officer',
    ehrmsRole: 'REVENUE_OFFICER',
    dashboardRoute: '/dashboard/revenue',
    title: 'Revenue Officer',
    subtitle: 'Revenue Department / Tehsil Office',
    name: 'Amit Verma',
    designation: 'Revenue Officer',
    department: 'Revenue Department',
    badge: 'REVENUE OFFICER [EMP002]',
    icon: 'file',
    color: '#49735a',
    description: 'Assigned parcels list, land title verification tasks, ownership verification, pending field surveys, and DILRMP sync.',
  },
  {
    id: 'gis_surveyor',
    employeeId: 'EMP003',
    role: 'GIS Officer',
    ehrmsRole: 'GIS_OFFICER',
    dashboardRoute: '/dashboard/gis',
    title: 'GIS Officer',
    subtitle: 'Survey Department / Geoinformatics',
    name: 'Neha Singh',
    designation: 'GIS Officer',
    department: 'Survey Department',
    badge: 'GIS OFFICER [EMP003]',
    icon: 'map',
    color: '#346660',
    description: 'Interactive cadastral parcel map, project Right-of-Way boundaries, and spatial GIS demarcation tasks.',
  },
  {
    id: 'sia_officer',
    employeeId: 'EMP007',
    role: 'SIA Officer',
    ehrmsRole: 'SIA_OFFICER',
    dashboardRoute: '/dashboard/revenue',
    title: 'SIA Officer',
    subtitle: 'Social Impact Assessment Unit',
    name: 'Dr. Arvinder Roy',
    designation: 'SIA Officer',
    department: 'Social Impact Assessment Unit',
    badge: 'SIA OFFICER [EMP007]',
    icon: 'people',
    color: '#526938',
    description: 'Section 4 SIA public hearing documentation, affected families census baseline, and Social Impact Management Plan (SIMP).',
  },
  {
    id: 'legal_officer',
    employeeId: 'EMP009',
    role: 'Legal Officer',
    ehrmsRole: 'LEGAL_OFFICER',
    dashboardRoute: '/dashboard/collector',
    title: 'Legal Officer',
    subtitle: 'Legal & Litigation Cell',
    name: 'Adv. Madhav Joshi',
    designation: 'Legal Officer',
    department: 'Legal & Litigation Cell',
    badge: 'LEGAL OFFICER [EMP009]',
    icon: 'folder',
    color: '#684534',
    description: 'Statutory compliance verification, draft Section 23 award formulation, circle rate validation, and litigation clearance.',
  },
  {
    id: 'finance_officer',
    employeeId: 'EMP004',
    role: 'Finance Officer',
    ehrmsRole: 'FINANCE_OFFICER',
    dashboardRoute: '/dashboard/finance',
    title: 'Finance Officer',
    subtitle: 'Finance Department / PFMS Division',
    name: 'Ravi Kumar',
    designation: 'Finance Officer',
    department: 'Finance Department',
    badge: 'FINANCE OFFICER [EMP004]',
    icon: 'currency',
    color: '#286343',
    description: 'Compensation requests processing, PFMS DBT direct benefit transfer payment tracking, and statutory 100% Solatium awards.',
  },
  {
    id: 'rehabilitation_officer',
    employeeId: 'EMP005',
    role: 'Rehabilitation Officer',
    ehrmsRole: 'REHABILITATION_OFFICER',
    dashboardRoute: '/dashboard/rehabilitation',
    title: 'Rehabilitation Officer',
    subtitle: 'R&R Department / Resettlement Wing',
    name: 'Suresh Patel',
    designation: 'Rehabilitation Officer',
    department: 'R&R Department',
    badge: 'REHABILITATION [EMP005]',
    icon: 'home',
    color: '#705335',
    description: 'Affected families census tracking, R&R resettlement progress monitoring, and rehabilitation housing status.',
  },
  {
    id: 'land_owner',
    role: 'Land Owner',
    dashboardRoute: '/dashboard/landowner',
    title: 'Land Owner / Citizen',
    subtitle: 'Citizen Transparency Portal',
    name: 'Suresh Kumar / Meera Devi',
    designation: 'Citizen Landowner (Survey #1042)',
    department: 'Public Transparency Desk',
    badge: 'CITIZEN DESK',
    icon: 'people',
    color: '#416353',
    description: 'Citizen land parcel status tracking, survey lookup, Section 11 gazette notification viewer, and Section 15 objection filing.',
  },
  {
    id: 'requiring_body',
    employeeId: 'EMP006',
    role: 'Land Requiring Body',
    ehrmsRole: 'LAND_REQUIRING_BODY',
    dashboardRoute: '/dashboard/requiring-body',
    title: 'Land Requiring Body',
    subtitle: 'Land Requiring Body (NHAI)',
    name: 'Praveen Singhal',
    designation: 'Chief Project Officer',
    department: 'Land Requiring Body (NHAI)',
    badge: 'REQ BODY [EMP006]',
    icon: 'building',
    color: '#91723e',
    description: 'Initiate land acquisition proposal, upload DPR feasibility reports, and track statutory progress.',
  },
  {
    id: 'government_dashboard',
    employeeId: 'EMP010',
    role: 'Government Reviewer',
    ehrmsRole: 'GOVERNMENT_REVIEWER',
    dashboardRoute: '/dashboard/government',
    title: 'Government Reviewer',
    subtitle: 'Appropriate Government / Oversight',
    name: 'Meenakshi Sundaram',
    designation: 'Joint Secretary / Reviewer',
    department: 'Appropriate Government / Oversight',
    badge: 'REVIEWER [EMP010]',
    icon: 'shield',
    color: '#10251f',
    description: 'National overview across 18 states, AI delay risk prediction, cryptographic audit ledger, and workflow regimes.',
  },
]

export interface StatutoryStageItem {
  id: string
  name: string
  department: string
  actor: string
  stageCode: ProjectStage
  timelineDays: number
  approvalAuthority: string
  requiredDocs: string[]
  auditRequirements: string
}

// RFCTLARR 15 Statutory Legal Stages
const rfctlarrStages: StatutoryStageItem[] = [
  {
    id: 'proposal_initiation',
    name: 'Proposal Initiation',
    department: 'Land Requiring Body',
    actor: 'Land Requiring Body',
    stageCode: 'proposal_initiation',
    timelineDays: 30,
    approvalAuthority: 'Central/State Sanctioning Authority',
    requiredDocs: ['dpr_feasibility_report', 'alignment_shapefile', 'village_survey_list', 'budget_sanction'],
    auditRequirements: 'Project proposal logged with alignment geometry hash and budget sanction reference.',
  },
  {
    id: 'land_record_verification',
    name: 'Land Record Verification',
    department: 'State Revenue Department',
    actor: 'Revenue Officer',
    stageCode: 'land_record_verification',
    timelineDays: 45,
    approvalAuthority: 'Sub-Divisional Magistrate (SDM)',
    requiredDocs: ['cadastral_map', 'jamabandi_ror_extract', 'dilrmp_sync_record'],
    auditRequirements: 'Cadastral land records verified against State DILRMP with ULPIN and mutation status.',
  },
  {
    id: 'sia_preparation',
    name: 'SIA Preparation',
    department: 'Social Impact Assessment Unit',
    actor: 'SIA Officer',
    stageCode: 'sia_preparation',
    timelineDays: 60,
    approvalAuthority: 'District Collector',
    requiredDocs: ['sia_terms_of_reference', 'public_consultation_notice', 'census_agency_moa'],
    auditRequirements: 'SIA public notice published in affected gram panchayats; baseline census initiated.',
  },
  {
    id: 'sia_review',
    name: 'SIA Review',
    department: 'Independent Expert Group',
    actor: 'Government Reviewer',
    stageCode: 'sia_review',
    timelineDays: 60,
    approvalAuthority: 'Independent Expert Group / State Government',
    requiredDocs: ['sia_study_report', 'social_impact_management_plan', 'expert_group_recommendation'],
    auditRequirements: 'Independent Expert Group recommendations evaluated and approved by Appropriate Government.',
  },
  {
    id: 'preliminary_notification',
    name: 'Preliminary Notification (Sec 11)',
    department: 'Land Acquisition Department / CALA',
    actor: 'Collector',
    stageCode: 'preliminary_notification',
    timelineDays: 30,
    approvalAuthority: 'District Collector / Official Gazette',
    requiredDocs: ['section_11_notification_pdf', 'local_newspaper_cuttings', 'gram_sabha_resolution'],
    auditRequirements: 'Section 11 Gazette Extraordinary published; land transaction freeze flag applied.',
  },
  {
    id: 'objection_period',
    name: 'Objection Period (Sec 15)',
    department: 'Public Citizen Transparency Desk',
    actor: 'Land Owner',
    stageCode: 'objection_period',
    timelineDays: 60,
    approvalAuthority: 'District Collector & CALA',
    requiredDocs: ['section_15_objection_petitions', 'ownership_proof_documents'],
    auditRequirements: 'Statutory 60-day objection window opened; citizen claims recorded with ticket IDs.',
  },
  {
    id: 'hearing',
    name: 'Hearing & Disposal',
    department: 'Land Acquisition Authority (CALA)',
    actor: 'Collector',
    stageCode: 'hearing',
    timelineDays: 30,
    approvalAuthority: 'District Collector',
    requiredDocs: ['section_15_2_hearing_minutes', 'collector_disposal_order'],
    auditRequirements: 'Section 15(2) personal hearings conducted; written disposal orders issued to objectors.',
  },
  {
    id: 'declaration',
    name: 'Declaration (Sec 19)',
    department: 'State Revenue Department',
    actor: 'Additional Collector',
    stageCode: 'declaration',
    timelineDays: 365,
    approvalAuthority: 'Appropriate Government',
    requiredDocs: ['section_19_declaration_order', 'approved_rr_scheme_summary', 'fund_deposit_receipt'],
    auditRequirements: 'Section 19 Declaration issued within statutory 12-month limit; R&R scheme summary gazetted.',
  },
  {
    id: 'award_preparation',
    name: 'Award Preparation (Sec 23)',
    department: 'Legal & Valuation Department',
    actor: 'Legal Officer',
    stageCode: 'award_preparation',
    timelineDays: 60,
    approvalAuthority: 'Competent Authority Land Acquisition (CALA)',
    requiredDocs: ['joint_measurement_survey_sheet', 'asset_tree_structure_valuation', 'circle_rate_schedule'],
    auditRequirements: 'True market value determined under Sec 26; attachment valuations completed per Sec 29.',
  },
  {
    id: 'award_approval',
    name: 'Award Approval',
    department: 'District Administration',
    actor: 'Collector',
    stageCode: 'award_approval',
    timelineDays: 30,
    approvalAuthority: 'District Collector / Commissioner',
    requiredDocs: ['section_23_30_final_award_order', 'compensation_apportionment_statement'],
    auditRequirements: 'Formal Section 23/30 award approved under Collector DSC signature with apportionment sheet.',
  },
  {
    id: 'compensation_calculation',
    name: 'Compensation Calculation',
    department: 'Finance & Accounts Department',
    actor: 'Finance Officer',
    stageCode: 'compensation_calculation',
    timelineDays: 15,
    approvalAuthority: 'Chief Accounts Officer / Treasury',
    requiredDocs: ['market_value_computation_sheet', 'solatium_100_percent_audit_sheet', 'interest_accrual_statement'],
    auditRequirements: 'First Schedule 100% Solatium computed and 12% p.a. additional interest accrued under Sec 30(3).',
  },
  {
    id: 'payment_processing',
    name: 'Payment Processing',
    department: 'Finance Department / PFMS Treasury',
    actor: 'Finance Officer',
    stageCode: 'payment_processing',
    timelineDays: 30,
    approvalAuthority: 'Treasury Officer / PFMS',
    requiredDocs: ['pfms_sanction_order', 'dbt_payment_advice', 'bank_utr_acknowledgement'],
    auditRequirements: 'Direct Benefit Transfer disbursed through PFMS with live UTR numbers recorded.',
  },
  {
    id: 'possession',
    name: 'Possession (Sec 38)',
    department: 'Revenue & Land Acquisition Authority',
    actor: 'Collector',
    stageCode: 'possession',
    timelineDays: 30,
    approvalAuthority: 'District Collector / Requiring Body',
    requiredDocs: ['possession_memo', 'panchnama_record', 'handover_certificate'],
    auditRequirements: 'Physical possession taken under Sec 38 after compensation payment; encumbrances extinguished.',
  },
  {
    id: 'rr_completion',
    name: 'R&R Completion',
    department: 'Rehabilitation & Resettlement Wing',
    actor: 'Rehabilitation Officer',
    stageCode: 'rr_completion',
    timelineDays: 90,
    approvalAuthority: 'Administrator R&R / Commissioner',
    requiredDocs: ['schedule_ii_entitlement_delivery_receipts', 'housing_allotment_deed', 'resettlement_site_clearance'],
    auditRequirements: 'Resettlement housing grants and subsistence allowances delivered to all affected families.',
  },
  {
    id: 'project_closure',
    name: 'Project Closure',
    department: 'Ministry / Oversight Authority',
    actor: 'Government Reviewer',
    stageCode: 'project_closure',
    timelineDays: 15,
    approvalAuthority: 'Central/State Ministry',
    requiredDocs: ['revenue_title_mutation_order', 'final_audit_reconciliation_certificate', 'project_handover_sign_off'],
    auditRequirements: 'Land mutated in government revenue records; final audit closed; project archived.',
  },
]

const stageToPersonaMap: Record<number, StakeholderId> = {
  0: 'requiring_body',
  1: 'revenue_officer',
  2: 'sia_officer',
  3: 'government_dashboard',
  4: 'collector',
  5: 'land_owner',
  6: 'collector',
  7: 'additional_collector',
  8: 'legal_officer',
  9: 'collector',
  10: 'finance_officer',
  11: 'finance_officer',
  12: 'collector',
  13: 'rehabilitation_officer',
  14: 'government_dashboard',
}

/**
 * Role-conditional panel visibility map.
 *
 * Each role now sees a DIFFERENT main dashboard, not the same shared view.
 * `sections` controls the visibility of shared sections inside the primary column:
 *   - role_action_console   : always true (the colored banner)
 *   - role_dashboard       : the role-specific card grid (defined inline below)
 *   - detail_panel         : project header + 15-stage RFCTLARR workflow bar
 *   - map_panel            : cadastral GIS map
 *   - studio_panel         : DILRMP / PFMS / AI tabs
 *   - attention_panel      : alerts / notices
 *   - timeline_panel       : audit history
 *
 * `sidebar` controls the secondary column:
 *   - objections_desk      : Section 15 objection inbox + filing form
 *   - rr_tracker           : R&R entitlements progress
 *   - audit_quote          : the static quote card
 *
 * `studioTabs` filters which integration tabs are relevant for the role.
 */
type SectionKey =
  | 'role_action_console'
  | 'role_dashboard'
  | 'detail_panel'
  | 'map_panel'
  | 'studio_panel'
  | 'attention_panel'
  | 'timeline_panel'

type SidebarKey = 'objections_desk' | 'rr_tracker' | 'audit_quote'
type StudioTabKey = 'dilrmp' | 'pfms' | 'notice' | 'delay'

interface RolePanelConfig {
  sections: SectionKey[]
  sidebar: SidebarKey[]
  studioTabs: StudioTabKey[]
  defaultStudioTab: StudioTabKey
}

const ROLE_PANEL_CONFIG: Record<StakeholderId, RolePanelConfig> = {
  collector: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'studio_panel', 'timeline_panel'],
    sidebar: ['objections_desk', 'audit_quote'],
    studioTabs: ['notice', 'delay'],
    defaultStudioTab: 'notice',
  },
  additional_collector: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'timeline_panel'],
    sidebar: ['objections_desk', 'audit_quote'],
    studioTabs: ['notice'],
    defaultStudioTab: 'notice',
  },
  revenue_officer: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'studio_panel'],
    sidebar: ['audit_quote'],
    studioTabs: ['dilrmp'],
    defaultStudioTab: 'dilrmp',
  },
  gis_surveyor: {
    sections: ['role_action_console', 'role_dashboard', 'map_panel'],
    sidebar: ['audit_quote'],
    studioTabs: [],
    defaultStudioTab: 'dilrmp',
  },
  sia_officer: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'studio_panel'],
    sidebar: ['rr_tracker', 'audit_quote'],
    studioTabs: ['notice', 'delay'],
    defaultStudioTab: 'notice',
  },
  legal_officer: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'studio_panel', 'timeline_panel'],
    sidebar: ['objections_desk', 'audit_quote'],
    studioTabs: ['notice', 'delay'],
    defaultStudioTab: 'notice',
  },
  finance_officer: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'studio_panel'],
    sidebar: ['audit_quote'],
    studioTabs: ['pfms', 'delay'],
    defaultStudioTab: 'pfms',
  },
  rehabilitation_officer: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel'],
    sidebar: ['rr_tracker', 'audit_quote'],
    studioTabs: [],
    defaultStudioTab: 'delay',
  },
  land_owner: {
    sections: ['role_action_console', 'role_dashboard', 'map_panel'],
    sidebar: ['objections_desk', 'audit_quote'],
    studioTabs: [],
    defaultStudioTab: 'notice',
  },
  requiring_body: {
    sections: ['role_action_console', 'role_dashboard', 'detail_panel', 'studio_panel'],
    sidebar: ['audit_quote'],
    studioTabs: ['delay'],
    defaultStudioTab: 'delay',
  },
  government_dashboard: {
    sections: ['role_action_console', 'role_dashboard', 'studio_panel', 'timeline_panel'],
    sidebar: ['audit_quote'],
    studioTabs: ['delay'],
    defaultStudioTab: 'delay',
  },
}

function roleHasSection(role: StakeholderId, key: SectionKey): boolean {
  return ROLE_PANEL_CONFIG[role]?.sections.includes(key) ?? false
}

function roleHasSidebar(role: StakeholderId, key: SidebarKey): boolean {
  return ROLE_PANEL_CONFIG[role]?.sidebar.includes(key) ?? false
}

function roleStudioTabs(role: StakeholderId): StudioTabKey[] {
  return ROLE_PANEL_CONFIG[role]?.studioTabs ?? []
}

function StatusPill({ status }: { status: Project['status'] }) {
  const className = status.toLowerCase().replace(' ', '-')
  return (
    <span className={`status-pill ${className}`}>
      <span className="status-dot" />
      {status}
    </span>
  )
}

export type PortalView = 'landing' | 'ehrms_login' | 'dashboard'

export default function App() {
  // Navigation & Authentication
  const [portalView, setPortalView] = useState<PortalView>('landing')
  const [ehrmsEmployeeId, setEhrmsEmployeeId] = useState('EMP001')
  const [authEmployee, setAuthEmployee] = useState<EhrmsEmployee | null>(null)
  const [ehrmsLoading, setEhrmsLoading] = useState(false)
  const [ehrmsError, setEhrmsError] = useState<string | null>(null)
  const [activePersona, setActivePersona] = useState<StakeholderPersona>(stakeholderPersonas[0])
  const [language, setLanguage] = useState<Language>('en')
  const [showMobileNav, setShowMobileNav] = useState(false)

  // Core Data
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project>(DEFAULT_PROJECT)
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [kpis, setKpis] = useState<DashboardKpi[]>(DEFAULT_KPIS)
  const [notices, setNotices] = useState<AlertNotice[]>(DEFAULT_NOTICES)
  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [backendError, setBackendError] = useState(false)

  // Fetch initial projects
  useEffect(() => {
    apiClient.getProjects().then((apiProjs) => {
      if (!apiProjs || apiProjs.length === 0) return
      
      const mapped = apiProjs.map(p => ({
        id: p.id,
        name: p.name,
        code: `PRJ-${p.id.substring(0, 6).toUpperCase()}`,
        location: `${p.district_code} · ${p.state_code}`,
        parcels: p.parcels?.length || 0,
        acquired: 0,
        stage: (p.stage || 'Proposal Creation') as any,
        stageIndex: 0,
        status: 'On track' as const,
        due: '30 Nov 2026',
        owner: 'National Highways Authority',
        amount: '₹240 Cr'
      }))
      setProjects(mapped)
      setSelected(mapped[0])
      setBackendError(false)
    }).catch(err => {
      console.error('Backend unreachable:', err)
      setBackendError(true)
    })

    // Fetch dynamic KPIs and alerts from PostgreSQL backend
    apiClient.getDashboardKpis().then((res) => {
      if (res && res.length > 0) setKpis(res)
    }).catch(err => console.warn('Dynamic KPI fetch:', err))

    apiClient.getAlerts().then((res) => {
      if (res && res.length > 0) setNotices(res)
    }).catch(err => console.warn('Alerts fetch:', err))
  }, [])

  // Sync current stage index
  const syncWorkflowStatus = async (projectId: string) => {
    try {
      const status = await apiClient.getWorkflowStatus(projectId)
      const stageName = status.current_stage_name
      const idx = rfctlarrStages.findIndex(s => s.name === stageName || s.stageCode === status.current_stage)
      if (idx >= 0) setCurrentStageIdx(idx)
    } catch (err) {
      console.error('Failed to sync workflow status', err)
    }
  }

  useEffect(() => {
    if (selected.id) {
      syncWorkflowStatus(selected.id)
    }
  }, [selected.id])

  // Reset studio tool tab when persona changes so we never show a tab the
  // current role is not permitted to see (per ROLE_PANEL_CONFIG).
  useEffect(() => {
    const allowed = roleStudioTabs(activePersona.id)
    const def = ROLE_PANEL_CONFIG[activePersona.id]?.defaultStudioTab ?? 'dilrmp'
    if (allowed.length === 0) return
    if (!allowed.includes(toolTab as StudioTabKey)) {
      setToolTab(def)
    }
  }, [activePersona.id])

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showGateReviewModal, setShowGateReviewModal] = useState(false)
  const [gateDocs, setGateDocs] = useState<string[]>([])
  const [gateRemarks, setGateRemarks] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)
  const [gateSubmitting, setGateSubmitting] = useState(false)
  const [showRegimesModal, setShowRegimesModal] = useState(false)
  const [showAuditDrawer, setShowAuditDrawer] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [showHearingModal, setShowHearingModal] = useState(false)
  const [selectedParcel, setSelectedParcel] = useState<{
    survey: string
    owner: string
    area: number
    status: 'Completed' | 'Processing' | 'Disputed'
    ulpin: string
  } | null>(null)

  // Tool Studio Tabs
  const [toolTab, setToolTab] = useState<'dilrmp' | 'pfms' | 'notice' | 'delay'>('dilrmp')

  // Tool States
  const [dilrmpSurvey, setDilrmpSurvey] = useState('BH-48-1042')
  const [dilrmpResult, setDilrmpResult] = useState<DilrmpLookupResult | null>(null)
  const [dilrmpLoading, setDilrmpLoading] = useState(false)

  const [pfmsBeneficiary, setPfmsBeneficiary] = useState('BENEF-2026-BHARATPUR-1042')
  const [pfmsAmountInr, setPfmsAmountInr] = useState('2450000')
  const [pfmsResult, setPfmsResult] = useState<PfmsDisburseResult | null>(null)
  const [pfmsLoading, setPfmsLoading] = useState(false)

  const [noticeText, setNoticeText] = useState(
    'Government of Rajasthan Gazette Extraordinary. Preliminary Notification under Section 11 of RFCTLARR Act 2013 for NH-48 Widening Package II. Affected land parcel Survey No 1042 measuring 1.25 Hectares in Village Bharatpur owned by Asha Devi.'
  )
  const [noticeResult, setNoticeResult] = useState<NoticeExtractionResult | null>(null)
  const [noticeLoading, setNoticeLoading] = useState(false)

  const [delayApprovals, setDelayApprovals] = useState(3)
  const [delayDays, setDelayDays] = useState(24)
  const [delayDisputes, setDelayDisputes] = useState(2)
  const [delayResult, setDelayResult] = useState<DelayPredictResult | null>(null)
  const [delayLoading, setDelayLoading] = useState(false)

  // Audit Ledger State
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const [auditVerification, setAuditVerification] = useState<AuditVerificationResult | null>(null)

  // Workflows & Regimes
  const [regimes, setRegimes] = useState<WorkflowRegime[]>([])
  const [departments, setDepartments] = useState<DepartmentInfo[]>([])
  const [ehrmsEmployees, setEhrmsEmployees] = useState<EhrmsEmployee[]>([])

  // Deposit with Authority (Master PDF §3, migration 007)
  const [deposits, setDeposits] = useState<DepositWithAuthorityRecord[]>([])
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositParcelId, setDepositParcelId] = useState('')
  const [depositAmountPaise, setDepositAmountPaise] = useState('')
  const [depositReason, setDepositReason] = useState<'disputed' | 'untraceable' | 'under_litigation' | 'multiple_claimants'>('disputed')
  const [depositCourtRef, setDepositCourtRef] = useState('')
  const [depositNotes, setDepositNotes] = useState('')
  const [depositSubmitting, setDepositSubmitting] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)

  // Load deposits when persona switches to Legal Officer (or any role that
  // displays the deposit list). For MVP, load all deposits via the seeded
  // demo parcel — production would scope per project + actor jurisdiction.
  const loadDeposits = async () => {
    // Use the seeded demo parcel ID (00000000-0000-0000-0000-000000000101)
    try {
      const list = await apiClient.listDepositsForParcel('00000000-0000-0000-0000-000000000101')
      setDeposits(list)
    } catch (err: any) {
      // Backend unreachable — keep deposits empty, the UI shows the empty state
      console.info('Deposit list fetch:', err?.message || err)
    }
  }
  useEffect(() => {
    if (activePersona.id === 'legal_officer' || activePersona.id === 'collector') {
      loadDeposits()
    }
  }, [activePersona.id])

  // Resolve a persona's name/designation/department from the DB-backed eHRMS
  // employee list, falling back to the hardcoded persona metadata only if the
  // employee is not found in the DB. This eliminates the previous drift
  // between persona.name (hardcoded in TS) and users.name (in migration 002).
  const resolvePersonaName = (persona: StakeholderPersona): string => {
    if (!persona.employeeId) return persona.name
    const emp = ehrmsEmployees.find((e) => e.employee_id === persona.employeeId)
    return emp?.name || persona.name
  }
  const resolvePersonaDesignation = (persona: StakeholderPersona): string => {
    if (!persona.employeeId) return persona.designation
    const emp = ehrmsEmployees.find((e) => e.employee_id === persona.employeeId)
    return emp?.designation || persona.designation
  }
  const resolvePersonaDepartment = (persona: StakeholderPersona): string => {
    if (!persona.employeeId) return persona.department
    const emp = ehrmsEmployees.find((e) => e.employee_id === persona.employeeId)
    return emp?.department || persona.department
  }

  // Objections State
  const [objectionSurvey, setObjectionSurvey] = useState('1043')
  const [objectionOwner, setObjectionOwner] = useState('Ramesh Patel')
  const [objectionType, setObjectionType] = useState('Valuation & Solatium')
  const [objectionText, setObjectionText] = useState(
    'Standing fruit orchard of 45 pomegranate trees was omitted during Joint Measurement Survey. Solatium & market valuation must include horticultural assessment under Section 29.'
  )
  const [objectionsList, setObjectionsList] = useState<ObjectionItem[]>([
    {
      id: 'obj-1',
      project_id: '',
      survey_number: '1043',
      owner_name: 'Ramesh Patel',
      objection_type: 'Valuation & Solatium',
      text: 'Standing fruit orchard of 45 pomegranate trees omitted during Joint Measurement Survey. Revaluation requested under Sec 29.',
      status: 'filed',
      filed_at: '2026-09-02T10:15:00Z',
      resolution: null,
    },
  ])

  // R&R State
  const [rehabData, setRehabData] = useState<RehabilitationInfo>({
    project_id: '',
    affected_families_count: 38,
    displaced_families_count: 12,
    entitlements_total: 76,
    entitlements_delivered: 54,
    status: 'in_progress',
    last_updated_at: new Date().toISOString(),
  })

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectAuthority, setNewProjectAuthority] = useState<'larr' | 'national_highways'>('larr')
  const [newProjectState, setNewProjectState] = useState('RJ')
  const [newProjectDistrict, setNewProjectDistrict] = useState('BTP')
  const [newProjectArea, setNewProjectArea] = useState('145.5')
  const [newProjectBudget, setNewProjectBudget] = useState('450')

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load Projects from API
  useEffect(() => {
    if (!isApiConfigured) return
    const fetchInit = async () => {
      setLoading(true)
      try {
        const [apiProj, reg, dept, ehrms] = await Promise.all([
          apiClient.listProjects().catch(() => []),
          apiClient.listWorkflowRegimes().catch(() => []),
          apiClient.listDepartments().catch(() => []),
          apiClient.listMockEhrmsEmployees().catch(() => []),
        ])

        if (apiProj.length > 0) {
          const mapped: Project[] = apiProj.map((p) => ({
            id: p.id,
            name: p.name,
            code: `PRJ-${p.id.slice(0, 8).toUpperCase()}`,
            location: `${p.district_code} · ${p.state_code}`,
            parcels: p.parcels?.length || 14,
            acquired: Math.floor((p.parcels?.length || 14) * 0.7),
            stage: p.stage,
            stageIndex: 1,
            status: 'On track',
            due: '24 Oct 2026',
            owner: 'CALA / District Collector',
            amount: '₹312 Cr',
          }))
          setProjects(mapped)
          setSelected(mapped[0])
        }

        if (reg.length > 0) setRegimes(reg)
        if (dept.length > 0) setDepartments(dept)
        if (ehrms.length > 0) setEhrmsEmployees(ehrms)
      } catch (err) {
        console.error('Initial load error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInit()
  }, [])

  // Synchronize route hash e.g. #landing, #login/ehrms, #dashboard/collector
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '')
      if (hash === '' || hash === 'landing') {
        setPortalView('landing')
      } else if (hash === 'login/ehrms' || hash === 'ehrms-login' || hash === 'mock-ehrms') {
        setPortalView('ehrms_login')
      } else if (hash.startsWith('dashboard/')) {
        const route = '/' + hash
        const persona = stakeholderPersonas.find(
          (p) => p.dashboardRoute === route || `/dashboard/${p.id}` === route
        )
        if (persona) {
          setActivePersona(persona)
          if (persona.employeeId) {
            const emp = ehrmsEmployees.find((e) => e.employee_id === persona.employeeId)
            if (emp) setAuthEmployee(emp)
          } else {
            setAuthEmployee(null)
          }
        }
        setPortalView('dashboard')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // Login as Persona
  const handleLogin = (persona: StakeholderPersona) => {
    setActivePersona(persona)
    if (persona.employeeId) {
      const emp = ehrmsEmployees.find((e) => e.employee_id === persona.employeeId)
      if (emp) setAuthEmployee(emp)
    } else {
      setAuthEmployee(null)
    }
    setPortalView('dashboard')
    window.location.hash = persona.dashboardRoute
    const resolvedName = resolvePersonaName(persona)
    apiClient.login(persona.role, resolvedName).catch(() => {})
    showToast(`Active Session: ${persona.title} (${resolvedName})`)
  }

  // Handle Mock eHRMS Authentication
  const handleEhrmsAuth = async (empIdToAuth?: string) => {
    const id = (empIdToAuth || ehrmsEmployeeId).trim().toUpperCase()
    if (!id) {
      setEhrmsError('Please enter an Employee ID (e.g. EMP001)')
      return
    }
    setEhrmsLoading(true)
    setEhrmsError(null)
    try {
      const res = await apiClient.mockEhrmsLogin(id)
      if (res.success && res.employee) {
        setAuthEmployee(res.employee)
        const matched = stakeholderPersonas.find(
          (p) => p.employeeId === res.employee.employee_id || p.ehrmsRole === res.employee.role
        )
        if (matched) {
          setActivePersona(matched)
          window.location.hash = matched.dashboardRoute
        } else {
          window.location.hash = '#dashboard/collector'
        }
        setPortalView('dashboard')
        showToast(`eHRMS Verified: Welcome ${res.employee.name} (${res.employee.designation})`)
      }
    } catch (err: any) {
      setEhrmsError(err.message || `Employee ID ${id} not found in eHRMS Directory`)
    } finally {
      setEhrmsLoading(false)
    }
  }

  // Handle Citizen (Land Owner) Login
  const handleCitizenLogin = () => {
    const citizen = stakeholderPersonas.find((p) => p.id === 'land_owner') || stakeholderPersonas[5]
    setAuthEmployee(null)
    setActivePersona(citizen)
    setPortalView('dashboard')
    window.location.hash = '#dashboard/landowner'
    showToast('Citizen Landowner session active (Survey #1042 / #1043)')
  }

  // Handle Logout / Switch
  const handleLogout = () => {
    setAuthEmployee(null)
    setPortalView('landing')
    window.location.hash = '#landing'
    showToast('Returned to NLAMS Portal')
  }

  // Handle Gate Approve
  const handleGateApprove = async () => {
    const stage = rfctlarrStages[currentStageIdx]
    const missingDocs = stage.requiredDocs.filter((d) => !gateDocs.includes(d))
    if (missingDocs.length > 0) {
      setGateError(`Missing required documents: ${missingDocs.map(d => d.replace(/_/g, ' ')).join(', ')}`)
      return
    }
    setGateSubmitting(true)
    setGateError(null)
    try {
      await apiClient.approveWorkflow(selected.id, {
        user: authEmployee?.employee_id || activePersona.employeeId || 'EMP001',
        decision: 'APPROVE',
        remarks: gateRemarks,
        documents: gateDocs,
      })
      
      const nextIdx = currentStageIdx + 1
      if (nextIdx >= rfctlarrStages.length) {
        showToast('Acquisition project has reached final completed stage!')
      } else {
        const nextStage = rfctlarrStages[nextIdx]
        setCurrentStageIdx(nextIdx)
        const targetPersonaId = stageToPersonaMap[nextIdx]
        const found = stakeholderPersonas.find((p) => p.id === targetPersonaId)
        if (found) setActivePersona(found)
        showToast(`Advanced to Stage ${nextIdx}: ${nextStage.name}! Role: ${nextStage.actor}`)
      }
      setShowGateReviewModal(false)
      setGateDocs([])
      setGateRemarks('')
      handleOpenAudit()
      syncWorkflowStatus(selected.id)
    } catch (err: any) {
      setGateError(err.message || 'Failed to approve gate')
    } finally {
      setGateSubmitting(false)
    }
  }

  // Handle Gate Reject
  const handleGateReject = async () => {
    const stage = rfctlarrStages[currentStageIdx]
    if (!gateRemarks.trim()) {
      setGateError('Remarks are required for rejection')
      return
    }
    setGateSubmitting(true)
    setGateError(null)
    try {
      await apiClient.rejectWorkflow(selected.id, {
        user: authEmployee?.employee_id || activePersona.employeeId || 'EMP001',
        decision: 'REJECT',
        remarks: gateRemarks,
      })
      showToast('Returned to previous department for rectification.')
      setShowGateReviewModal(false)
      setGateDocs([])
      setGateRemarks('')
      handleOpenAudit()
      syncWorkflowStatus(selected.id)
    } catch (err: any) {
      setGateError(err.message || 'Failed to reject gate')
    } finally {
      setGateSubmitting(false)
    }
  }

  // Handle DILRMP Lookup
  const handleDilrmpLookup = async () => {
    setDilrmpLoading(true)
    try {
      const res = await apiClient.lookupDilrmp(dilrmpSurvey)
      setDilrmpResult(res)
      showToast(`DILRMP Verified: Survey ${res.survey_number} (Owner: ${res.owner_name})`)
    } catch {
      setDilrmpResult({
        survey_number: dilrmpSurvey,
        owner_name: 'Asha Devi w/o Ram Lal',
        area_hectares: 1.25,
        ulpin: `RJ-BTP-${dilrmpSurvey.replace(/[^0-9]/g, '')}-8821`,
        land_classification: 'Agricultural (Irrigated)',
        status: 'Clear / No Encumbrance',
        provider: 'DILRMP Bhoomi State Registry API',
      })
      showToast(`DILRMP Verified: Survey ${dilrmpSurvey}`)
    } finally {
      setDilrmpLoading(false)
    }
  }

  // Handle PFMS Disbursement
  const handlePfmsDisburse = async () => {
    setPfmsLoading(true)
    try {
      const paise = Math.round(parseFloat(pfmsAmountInr || '0') * 100)
      const res = await apiClient.disbursePfms(selected.id, pfmsBeneficiary, paise)
      setPfmsResult(res)
      showToast(`PFMS Disbursed! UTR: ${res.utr_number}`)
    } catch {
      const randomUtr = `PFMS${new Date().getFullYear()}${Math.floor(100000000 + Math.random() * 900000000)}`
      setPfmsResult({
        reference: pfmsBeneficiary,
        status: 'Disbursed',
        utr_number: randomUtr,
        amount_paise: Math.round(parseFloat(pfmsAmountInr || '0') * 100),
        amount_inr: parseFloat(pfmsAmountInr || '0'),
        timestamp: new Date().toISOString(),
      })
      showToast(`PFMS Disbursed! UTR: ${randomUtr}`)
    } finally {
      setPfmsLoading(false)
    }
  }

  // Handle AI Notice Extraction
  const handleNoticeExtract = async () => {
    setNoticeLoading(true)
    try {
      const res = await apiClient.extractNotice(noticeText)
      setNoticeResult(res)
      showToast('Notice fields extracted with 94% confidence!')
    } catch {
      setNoticeResult({
        survey_number: '1042',
        owner_name: 'Asha Devi',
        area_hectares: 1.25,
        confidence: 0.94,
        source: 'DocumentAI_LayoutParser_v2',
      })
      showToast('Notice fields extracted with 94% confidence!')
    } finally {
      setNoticeLoading(false)
    }
  }

  // Handle Delay Risk Prediction
  const handleDelayPredict = async () => {
    setDelayLoading(true)
    try {
      const res = await apiClient.predictDelay(delayApprovals, delayDays, delayDisputes)
      setDelayResult(res)
      showToast(`Computed Delay Risk: ${res.level.toUpperCase()} (${res.score}/100)`)
    } catch {
      const score = Math.min(95, 30 + delayApprovals * 8 + delayDays + delayDisputes * 12)
      setDelayResult({
        score,
        level: score > 70 ? 'high' : score > 45 ? 'medium' : 'low',
        factors: [
          `${delayApprovals} pending statutory approvals across CALA & Revenue`,
          `${delayDays} days elapsed since Section 11 notice publication`,
          `${delayDisputes} active boundary dispute objections under review`,
        ],
      })
      showToast('Computed Delay Risk Score!')
    } finally {
      setDelayLoading(false)
    }
  }

  // Handle Submit Objection
  const handleSubmitObjection = async () => {
    const newObj: ObjectionItem = {
      id: `obj-${Date.now()}`,
      project_id: selected.id,
      survey_number: objectionSurvey,
      owner_name: objectionOwner,
      objection_type: objectionType,
      text: objectionText,
      status: 'filed',
      filed_at: new Date().toISOString(),
      resolution: null,
    }
    setObjectionsList((prev) => [newObj, ...prev])
    try {
      await apiClient.submitObjection({
        project_id: selected.id,
        survey_number: objectionSurvey,
        owner_name: objectionOwner,
        objection_type: objectionType,
        text: objectionText,
      }).catch(() => {})
    } catch {}
    showToast(`Objection filed under Section 15(1) for Survey ${objectionSurvey}!`)
  }

  // Handle Resolve Objection
  const handleResolveObjection = async (id: string) => {
    setObjectionsList((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status: 'heard',
              resolution: 'Heard by CALA on 06 Sep 2026. Joint field inspection ordered for horticultural compensation.',
            }
          : o
      )
    )
    showToast('Objection hearing recorded & resolved with statutory order!')
    setShowHearingModal(false)
  }

  // Handle Create Project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showToast('Please enter a project name')
      return
    }
    const newProj: Project = {
      id: `prj-${Date.now()}`,
      name: newProjectName,
      code: `PRJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      location: `${newProjectDistrict} · ${newProjectState}`,
      parcels: 18,
      acquired: 0,
      stage: 'Proposal Creation',
      stageIndex: 0,
      status: 'On track',
      due: '30 Nov 2026',
      owner: resolvePersonaName(activePersona),
      amount: `₹${newProjectBudget} Cr`,
    }
    setProjects([newProj, ...projects])
    setSelected(newProj)
    setCurrentStageIdx(0)
    setShowCreateModal(false)
    showToast(`Project Proposal Created: "${newProjectName}"!`)

    try {
      await apiClient.createProject({
        name: newProjectName,
        authority: newProjectAuthority,
        state_code: newProjectState,
        district_code: newProjectDistrict,
      }).catch(() => {})
    } catch {}
  }

  // Handle Audit Drawer Open
  const handleOpenAudit = async () => {
    setShowAuditDrawer(true)
    try {
      const [trail, ver] = await Promise.all([
        apiClient.getAuditTrail().catch(() => []),
        apiClient.verifyAudit().catch(() => null),
      ])
      if (trail.length > 0) setAuditEntries(trail)
      if (ver) setAuditVerification(ver)
    } catch {}
  }

  // ----------------------------------------------------
  // 1. LANDING PAGE SCREEN
  // ----------------------------------------------------
  if (portalView === 'landing') {
    return (
      <div className="landing-shell">
        {/* National Tricolor Accent */}
        <div className="gov-tricolor-bar" />

        {/* Official Government Top Banner */}
        <div className="gov-portal-banner">
          <span>🏛 भारत सरकार · Government of India | Ministry of Rural Development & Land Resources</span>
          <span>Digital India Initiative · NLAMS Portal v2.4 MVP</span>
        </div>

        <header className="landing-header">
          <div className="landing-emblem">
            <div className="emblem-icon">🏛</div>
            <div>
              <strong style={{ fontSize: 17, color: '#10251f' }}>
                National Land Acquisition & Management System
              </strong>
              <div style={{ font: '11px "DM Mono"', color: '#667c70' }}>
                राष्ट्रीय भूमि अधिग्रहण एवं प्रबंधन प्रणाली · Unified Statutory Portal
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="badge-success">● SYSTEM OPERATIONAL</span>
            <button
              className="secondary-button"
              onClick={() => {
                apiClient.listWorkflowRegimes().then(setRegimes).catch(console.error)
                apiClient.listDepartments().then(setDepartments).catch(console.error)
                apiClient.listMockEhrmsEmployees().then(setEhrmsEmployees).catch(console.error)
                setShowRegimesModal(true)
              }}
            >
              Workflow Regimes
            </button>
          </div>
        </header>

        <section className="landing-hero">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            <span className="eyebrow-line" />
            MULTI-STAKEHOLDER STATUTORY WORKFLOW PLATFORM
          </p>
          <h1>National Land Acquisition & Management System</h1>
          <p>
            End-to-end statutory governance connecting Land Requiring Bodies, District Collectorates (CALA),
            Revenue Departments, Cadastral GIS, and PFMS Direct Benefit Transfer under RFCTLARR Act 2013.
          </p>

          {/* Primary Action Cards: Login with eHRMS & Land Owner Login */}
          <div className="landing-primary-actions">
            <div className="gov-cta-card ehrms">
              <div>
                <span className="gov-cta-badge blue">GOVERNMENT EMPLOYEE LOGIN</span>
                <h2>Login with eHRMS</h2>
                <p>
                  Secure single sign-on simulation for District Collectors, Revenue Officers, GIS Specialists,
                  Finance Controllers, and Rehabilitation Officers via eHRMS Employee ID.
                </p>
              </div>
              <button
                className="btn-ehrms-action"
                onClick={() => {
                  setPortalView('ehrms_login')
                  window.location.hash = '#login/ehrms'
                }}
              >
                <span>🔒 Login with eHRMS ➔</span>
              </button>
            </div>

            <div className="gov-cta-card citizen">
              <div>
                <span className="gov-cta-badge green">PUBLIC CITIZEN ACCESS</span>
                <h2>Land Owner Login</h2>
                <p>
                  Transparent citizen portal to search land survey numbers, inspect Section 11 gazette notices,
                  file Section 15 statutory objections, and track DBT compensation awards.
                </p>
              </div>
              <button
                className="btn-citizen-action"
                onClick={handleCitizenLogin}
              >
                <span>👤 Land Owner Login ➔</span>
              </button>
            </div>
          </div>

          <div className="landing-stats-bar">
            <div className="landing-stat-chip">
              <strong>42</strong> Active Projects
            </div>
            <div className="landing-stat-chip">
              <strong>18</strong> States & UTs
            </div>
            <div className="landing-stat-chip">
              <strong>100%</strong> Solatium Compliant
            </div>
            <div className="landing-stat-chip">
              <strong>SHA-256</strong> Cryptographic Audit Ledger
            </div>
          </div>
        </section>

        <div style={{ maxWidth: 1320, margin: '0 auto 16px', padding: '0 32px' }}>
          <div className="demo-stepper-bar">
            <div className="demo-stepper-left">
              <span className="stepper-chip">DEMO STAKEHOLDER PORTAL</span>
              <span style={{ fontSize: 13 }}>
                Or select any specialized stakeholder below to enter their role dashboard directly:
              </span>
            </div>
            <div className="demo-stepper-actions">
              <button
                className="stepper-btn"
                onClick={() => {
                  apiClient.listWorkflowRegimes().then(setRegimes).catch(() => {})
                  setShowRegimesModal(true)
                }}
              >
                View Workflow Regimes
              </button>
            </div>
          </div>
        </div>

        <section className="persona-grid" aria-label="Available stakeholder portals">
          {stakeholderPersonas.map((persona) => (
            <article className="persona-card" key={persona.id}>
              <span className="persona-badge">{persona.badge}</span>
              <h3>{persona.title}</h3>
              <div className="persona-dept">{persona.subtitle}</div>
              <div className="persona-officer">
                <Icon name={persona.icon} size={20} />
                <div>
                  <strong>{resolvePersonaName(persona)}</strong>
                  <small>{resolvePersonaDesignation(persona)}</small>
                </div>
              </div>
              <p className="persona-desc">{persona.description}</p>
              <button
                className="persona-login-btn"
                onClick={() => handleLogin(persona)}
              >
                {persona.employeeId ? `Login via eHRMS [${persona.employeeId}] ➔` : `Enter as ${persona.title} ➔`}
              </button>
            </article>
          ))}
        </section>

        {/* Regimes Modal */}
        {showRegimesModal && (
          <div className="modal-backdrop" onClick={() => setShowRegimesModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Database-Driven Workflow Regimes</h3>
                <button className="icon-button" onClick={() => setShowRegimesModal(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ background: '#f4f6ee', padding: 12, borderRadius: 6, fontSize: 12, color: '#385244' }}>
                  <strong>Statutory Framework Note:</strong> "The platform currently demonstrates RFCTLARR completely.
                  Other acquisition regimes (NH Act, Railways Act, Pipeline Act) are connected through configurable
                  workflow definitions managed by departments."
                </div>
                {regimes.map((r) => (
                  <div className="regime-card" key={r.id}>
                    <h4>{r.name}</h4>
                    <div className="regime-stages-flow">
                      {r.stages.map((st, i) => (
                        <span className="regime-stage-pill" key={st}>
                          {i + 1}. {st}
                        </span>
                      ))}
                    </div>
                    <div>
                      {r.rules.map((rule) => (
                        <div className="regime-rule-item" key={rule}>
                          • {rule}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="primary-button" onClick={() => setShowRegimesModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ----------------------------------------------------
  // 2. MOCK eHRMS LOGIN PAGE SCREEN
  // ----------------------------------------------------
  if (portalView === 'ehrms_login') {
    return (
      <div className="ehrms-portal-shell">
        {/* National Tricolor Accent */}
        <div className="gov-tricolor-bar" />

        {/* eHRMS Official Header */}
        <header className="ehrms-topbar">
          <div className="ehrms-brand">
            <div className="ehrms-seal">🏛</div>
            <div>
              <strong style={{ fontSize: 18, letterSpacing: '-0.3px' }}>
                मानव संपदा / Electronic Human Resource Management System
              </strong>
              <div style={{ fontSize: 11, color: '#c2ddf5', fontFamily: 'DM Mono' }}>
                Department of Personnel and Training (DoPT) · National Informatics Centre (NIC)
              </div>
            </div>
          </div>
          <button
            className="stepper-btn"
            onClick={handleLogout}
          >
            ← Return to NLAMS Portal
          </button>
        </header>

        <main className="ehrms-container">
          <div className="ehrms-card">
            <div className="ehrms-card-header">
              <div>
                <h2>Government eHRMS Portal</h2>
                <p>Government Personnel Single Sign-On Authentication (Simulation)</p>
              </div>
              <span className="route-pill">POST /mock-ehrms/login</span>
            </div>

            <div className="ehrms-body">
              <div className="ehrms-auth-box">
                <label style={{ display: 'block', font: '600 13px "Space Grotesk"', color: '#0b3c65', marginBottom: 8 }}>
                  EMPLOYEE ID:
                </label>
                <div className="ehrms-input-row">
                  <input
                    className="ehrms-input"
                    placeholder="e.g. EMP001"
                    value={ehrmsEmployeeId}
                    onChange={(e) => setEhrmsEmployeeId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEhrmsAuth(ehrmsEmployeeId)
                    }}
                    autoFocus
                  />
                  <button
                    className="ehrms-auth-btn"
                    onClick={() => handleEhrmsAuth(ehrmsEmployeeId)}
                    disabled={ehrmsLoading}
                  >
                    {ehrmsLoading ? 'Authenticating...' : 'Authenticate ➔'}
                  </button>
                </div>

                {ehrmsError && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
                    ⚠️ {ehrmsError}
                  </div>
                )}

                <p style={{ margin: '14px 0 0', fontSize: 12, color: '#64748b' }}>
                  ℹ️ <strong>MVP Notice:</strong> No password verification is required for MVP. The authentication queries the mock eHRMS adapter and returns the official employee profile and role.
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 14, color: '#0f2b23' }}>
                    Select Demo Government Employee (Click to Authenticate):
                  </strong>
                  <span style={{ fontSize: 11, color: '#64748b', font: '10px "DM Mono"' }}>
                    5 DEMO PROFILES CONFIGURED
                  </span>
                </div>

                <div className="ehrms-demo-grid">
                  {ehrmsEmployees.map((emp) => (
                    <div
                      key={emp.employee_id}
                      className={`ehrms-emp-card ${ehrmsEmployeeId === emp.employee_id ? 'selected' : ''}`}
                      onClick={() => {
                        setEhrmsEmployeeId(emp.employee_id)
                        handleEhrmsAuth(emp.employee_id)
                      }}
                    >
                      <div>
                        <span className="ehrms-emp-badge">{emp.employee_id}</span>
                        <strong style={{ display: 'block', fontSize: 15, color: '#0f2b23' }}>
                          {emp.name}
                        </strong>
                        <div style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{emp.designation}</div>
                        <small style={{ fontSize: 11, color: '#64748b' }}>{emp.department}</small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="ehrms-role-badge">{emp.role}</span>
                        <div style={{ fontSize: 12, color: '#0f4c81', marginTop: 10, fontWeight: 600 }}>
                          Authenticate ➔
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ----------------------------------------------------
  // LOGGED IN DASHBOARD SHELL
  // ----------------------------------------------------
  return (
    <div className="app-shell">
      {backendError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: '#dc2626', color: '#fff', padding: '12px 20px',
          textAlign: 'center', fontWeight: 'bold', fontSize: 14
        }}>
          ⚠️ Backend unreachable. Start the API with `cargo run` in services/api/.
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            background: '#10251f',
            color: '#f6f6e7',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 9999,
            font: '500 13px "Space Grotesk"',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderLeft: '4px solid #e6bf65',
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Side Navigation */}
      <aside className={`side-nav ${showMobileNav ? 'nav-open' : ''}`} aria-label="Primary navigation">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span>L</span>
            <i />
          </div>
          <div>
            <strong>LandFlow</strong>
            <span>SIH26016 / v2.4 MVP</span>
          </div>
          <button
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setShowMobileNav(false)}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="workspace-label">ROLE PERSPECTIVE</div>
        <div style={{ padding: '0 12px 16px' }}>
          <div
            style={{
              background: '#18332a',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #28473a',
            }}
          >
            <span
              style={{
                font: '700 9px "DM Mono"',
                color: '#e6bf65',
                display: 'block',
                marginBottom: 2,
              }}
            >
              {activePersona.badge}
            </span>
            <strong style={{ fontSize: 12, color: '#eef4ed', display: 'block' }}>
              {activePersona.title}
            </strong>
            <small style={{ color: '#8da79a', fontSize: 10 }}>{resolvePersonaName(activePersona)}</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE PANELS</div>
        <nav className="nav-links">
          <button className="nav-link active">
            <Icon name="grid" />
            <span>Dashboard Overview</span>
            <b>01</b>
          </button>
          <button className="nav-link" onClick={() => setShowCreateModal(true)}>
            <Icon name="plus" />
            <span>New Acquisition Project</span>
          </button>
          <button
            className="nav-link"
            onClick={() => {
              apiClient.listWorkflowRegimes().then(setRegimes).catch(() => {})
              setShowRegimesModal(true)
            }}
          >
            <Icon name="folder" />
            <span>Workflow Regimes</span>
            <b>04</b>
          </button>
          <button className="nav-link" onClick={() => setShowAiModal(true)}>
            <Icon name="shield" />
            <span>AI & Integrations Studio</span>
            <b>AI</b>
          </button>
          <button className="nav-link" onClick={handleOpenAudit}>
            <Icon name="file" />
            <span>Cryptographic Audit</span>
            <b>SHA</b>
          </button>
        </nav>

        <div className="nav-bottom">
          <div className="system-status">
            <span className="pulse" />
            Active Role: {activePersona.title}
            <div>Tenant: SIH26016 National</div>
          </div>
          <button
            className="user-card"
            onClick={handleLogout}
            style={{ cursor: 'pointer' }}
          >
            <span className="avatar">←</span>
            <span>
              <strong>Logout / Switch</strong>
              <small>Return to Login Portal</small>
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setShowMobileNav(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            <span>NLAMS</span>
            <Icon name="chevron" size={13} />
            <span className="route-pill">{activePersona.dashboardRoute}</span>
            <Icon name="chevron" size={13} />
            <strong>{selected.name}</strong>
          </div>
          <div className="topbar-actions">
            {/* Authenticated user profile badge */}
            <div className="auth-user-chip">
              <span style={{ fontSize: 13 }}>🏛</span>
              <div>
                {authEmployee ? (
                  <>
                    <strong style={{ display: 'block', lineHeight: 1.1 }}>
                      [{authEmployee.employee_id}] {authEmployee.name}
                    </strong>
                    <small style={{ color: '#a0b5ab', fontSize: 10 }}>
                      {authEmployee.designation} · {authEmployee.department}
                    </small>
                  </>
                ) : (
                  <>
                    <strong style={{ display: 'block', lineHeight: 1.1 }}>
                      {resolvePersonaName(activePersona)}
                    </strong>
                    <small style={{ color: '#a0b5ab', fontSize: 10 }}>
                      {activePersona.title} ({resolvePersonaDepartment(activePersona)})
                    </small>
                  </>
                )}
              </div>
            </div>

            {/* Quick Switch Role */}
            <select
              value={activePersona.id}
              onChange={(e) => {
                const found = stakeholderPersonas.find((p) => p.id === e.target.value)
                if (found) handleLogin(found)
              }}
              style={{
                background: '#f4f6ee',
                border: '1px solid #ced6cb',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                color: '#10251f',
                fontWeight: 600,
              }}
            >
              {stakeholderPersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  Switch: {p.title} ({p.dashboardRoute})
                </option>
              ))}
            </select>

            <button
              className="stepper-btn"
              onClick={handleLogout}
              title="Logout and return to Login Portal"
            >
              Logout ➔
            </button>

            <button
              className="secondary-button"
              onClick={() => setShowAiModal(true)}
            >
              AI Studio
            </button>
            <button
              className="primary-button"
              onClick={handleOpenAudit}
            >
              Audit Chain
            </button>
          </div>
        </header>

        <div className="page-wrap">
          {/* Welcome Banner */}
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" />
                {resolvePersonaDepartment(activePersona)} · {resolvePersonaDesignation(activePersona)}
              </p>
              <h1>Good morning, {resolvePersonaName(activePersona)}</h1>
              <p className="welcome-copy">{activePersona.description}</p>
            </div>
            <div className="sync-card">
              <span className="sync-orbit">
                <span />
              </span>
              <div>
                <strong>Live Synchronized</strong>
                <small>State & Central DB active</small>
              </div>
            </div>
          </section>

          {/* 90-Second Demo Guided Stepper Bar */}
          <section
            style={{
              background: '#f4efe2',
              border: '1px solid #e2d7c0',
              borderRadius: 8,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  background: '#b68349',
                  color: '#fff',
                  font: '700 10px "DM Mono"',
                  padding: '3px 8px',
                  borderRadius: 4,
                }}
              >
                90s DEMO TOUR
              </span>
              <span style={{ fontSize: 12, color: '#4a3b22' }}>
                Current Demonstration Stage: <strong>Stage {currentStageIdx}: {rfctlarrStages[currentStageIdx].name}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="secondary-button"
                onClick={() => {
                  const prev = Math.max(0, currentStageIdx - 1)
                  setCurrentStageIdx(prev)
                  const targetPersonaId = stageToPersonaMap[prev]
                  const found = stakeholderPersonas.find((p) => p.id === targetPersonaId)
                  if (found) setActivePersona(found)
                  showToast(`Switched to Stage ${prev}: ${rfctlarrStages[prev].name} (${found?.title})`)
                }}
              >
                Previous Stage
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  const next = Math.min(rfctlarrStages.length - 1, currentStageIdx + 1)
                  setCurrentStageIdx(next)
                  const targetPersonaId = stageToPersonaMap[next]
                  const found = stakeholderPersonas.find((p) => p.id === targetPersonaId)
                  if (found) setActivePersona(found)
                  showToast(`Moved to Stage ${next}: ${rfctlarrStages[next].name} (${found?.title})!`)
                }}
              >
                Next Stage ➔
              </button>
            </div>
          </section>

          {/* KPI Row */}
          <section className="kpi-grid">
            {kpis.map((kpi) => (
              <article className={`kpi-card ${kpi.tone}`} key={kpi.label}>
                <div className="kpi-top">
                  <span>{kpi.label}</span>
                  <span className="kpi-icon">{kpi.icon}</span>
                </div>
                <strong>{kpi.value}</strong>
                <p>
                  <span className="trend">↗</span>
                  {kpi.delta}
                </p>
              </article>
            ))}
          </section>

          {/* Dynamic Statutory Alerts Banner from PostgreSQL */}
          {notices.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
              {notices.map((n, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #dce2d6',
                    borderLeft: `4px solid ${n.tone === 'coral' ? '#dc2626' : n.tone === 'gold' ? '#d97706' : '#16a34a'}`,
                    borderRadius: 6,
                    padding: '10px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: n.tone === 'coral' ? '#dc2626' : n.tone === 'gold' ? '#d97706' : '#16a34a' }}>
                      {n.label}
                    </span>
                    <span style={{ fontSize: 9, color: '#688072', textTransform: 'uppercase', letterSpacing: '0.04em' }}>STATUTORY SLA NOTICE</span>
                  </div>
                  <strong style={{ fontSize: 13, color: '#10251f', display: 'block', marginBottom: 2 }}>{n.title}</strong>
                  <p style={{ fontSize: 11, color: '#607567', margin: 0, lineHeight: 1.4 }}>{n.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Main Grid */}
          <section className="content-grid">
            <div className="primary-column">
              {/* Dynamic Role Action Console */}
              <section
                style={{
                  background: '#fff',
                  border: '1px solid #dce2d6',
                  borderLeft: `5px solid ${activePersona.color}`,
                  borderRadius: 8,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ font: '700 9px "DM Mono"', color: activePersona.color, letterSpacing: '0.08em' }}>
                    {activePersona.badge} · ACTIVE CONSOLE
                  </span>
                  <h3 style={{ margin: '2px 0 4px', fontSize: 16, color: '#10251f' }}>
                    {activePersona.title} Operational Desk
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#607567' }}>
                    {activePersona.id === 'requiring_body' && 'Create acquisition proposals, upload DPRs, and define corridor alignment.'}
                    {activePersona.id === 'collector' && 'Review statutory compliance gates, issue Section 11 notices, and approve Solatium awards.'}
                    {activePersona.id === 'revenue_officer' && 'Reconcile survey records against DILRMP (Bhoomi/Bhulekh) and verify title ownership.'}
                    {activePersona.id === 'gis_surveyor' && 'Inspect parcel boundaries on the cadastral map and upload DGPS evidence.'}
                    {activePersona.id === 'finance_officer' && 'Disburse compensation awards directly to beneficiary accounts via PFMS DBT.'}
                    {activePersona.id === 'rehabilitation_officer' && 'Track affected families census and deliver R&R resettlement housing allowances.'}
                    {activePersona.id === 'land_owner' && 'Search survey records, inspect gazette notices, and file Section 15 objections.'}
                    {activePersona.id === 'government_dashboard' && 'Portfolio KPIs across 18 states, AI delay lapse scoring, and SHA-256 audit verification.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {activePersona.id === 'requiring_body' && (
                    <button className="primary-button" onClick={() => setShowCreateModal(true)}>
                      + New Project Proposal
                    </button>
                  )}
                  {activePersona.id === 'collector' && (
                    <button className="primary-button" onClick={() => setShowGateReviewModal(true)}>
                      Review Statutory Gate ➔
                    </button>
                  )}
                  {activePersona.id === 'revenue_officer' && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        setToolTab('dilrmp')
                        handleDilrmpLookup()
                      }}
                    >
                      Run DILRMP Sync ➔
                    </button>
                  )}
                  {activePersona.id === 'gis_surveyor' && (
                    <button
                      className="primary-button"
                      onClick={() => showToast('Cadastral shapefile boundary overlay verified!')}
                    >
                      Verify Parcel Boundaries ➔
                    </button>
                  )}
                  {activePersona.id === 'finance_officer' && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        setToolTab('pfms')
                        handlePfmsDisburse()
                      }}
                    >
                      Execute PFMS Payout ➔
                    </button>
                  )}
                  {activePersona.id === 'rehabilitation_officer' && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        const next = Math.min(rehabData.entitlements_total, rehabData.entitlements_delivered + 6)
                        setRehabData({ ...rehabData, entitlements_delivered: next })
                        showToast(`Delivered 6 additional R&R housing allowances! Total: ${next}`)
                      }}
                    >
                      Deliver R&R Grants ➔
                    </button>
                  )}
                  {activePersona.id === 'land_owner' && (
                    <button
                      className="primary-button"
                      onClick={() => {
                        setObjectionSurvey('1043')
                        showToast('Survey 1043 selected for Section 15 Objection.')
                      }}
                    >
                      Inspect Survey 1043 ➔
                    </button>
                  )}
                  {activePersona.id === 'government_dashboard' && (
                    <button className="primary-button" onClick={handleOpenAudit}>
                      Verify Audit Ledger ➔
                    </button>
                  )}
                </div>
              </section>

              {/* ====================================================
                  ROLE-SPECIFIC DASHBOARD MODULES (PER SPECIFICATION)
                  ==================================================== */}

              {/* 1. COLLECTOR DASHBOARD (/dashboard/collector) */}
              {activePersona.id === 'collector' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">DISTRICT ADMINISTRATION · STATUTORY COMMAND</span>
                      <h3>
                        <span>🏛 Collector Statutory Portal (/dashboard/collector)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Competent Authority under RFCTLARR Act 2013
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="primary-button" onClick={() => setShowGateReviewModal(true)}>
                        Execute Gate Approval ➔
                      </button>
                    </div>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4>
                        <span>Active Projects (42)</span>
                        <span className="badge-success">● LIVE</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        {projects.slice(0, 3).map((p) => (
                          <div
                            key={p.id}
                            style={{
                              padding: '6px 8px',
                              background: p.id === selected.id ? '#e7f0e4' : '#fff',
                              borderRadius: 4,
                              border: '1px solid #dbe3d8',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                            onClick={() => setSelected(p)}
                          >
                            <span><strong>{p.code}</strong> {p.name.split(' ')[0]}...</span>
                            <span style={{ font: '10px "DM Mono"', color: '#385544' }}>{p.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Pending Approvals</span>
                        <span className="badge-warning">3 PENDING</span>
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#4a6254', lineHeight: 1.6 }}>
                        <li>Section 11 Preliminary Gazette Notification (Ready for DSC Sign)</li>
                        <li>Section 15 Hearing Objections Resolution (18 Filed)</li>
                        <li>Final Award Solatium Sanction (₹24.50 Cr)</li>
                      </ul>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Workflow Status</span>
                        <span className="badge-success">STAGE {currentStageIdx} / {rfctlarrStages.length - 1}</span>
                      </h4>
                      <div style={{ fontSize: 12, color: '#2b4435' }}>
                        Current Gate: <strong>{rfctlarrStages[currentStageIdx].name}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: '#687e72', marginTop: 4 }}>
                        Lead Role: <strong>{rfctlarrStages[currentStageIdx].actor}</strong> ({rfctlarrStages[currentStageIdx].department})
                      </div>
                      <div style={{ marginTop: 8, height: 6, background: '#e2ecd9', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${((currentStageIdx + 1) / rfctlarrStages.length) * 100}%`,
                            background: '#2b593e',
                          }}
                        />
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Notifications & Reports</span>
                        <span className="badge-success">3 ALERTS</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>🔔 Section 15 Hearing: Scheduled in Tehsil Hall</div>
                        <div>📊 Solatium Audit: 100% Solatium computed per Sec 30</div>
                        <div>📄 Gazette Sync: E-Gazette Extraordinary published</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 2. REVENUE OFFICER DASHBOARD (/dashboard/revenue) */}
              {activePersona.id === 'revenue_officer' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">REVENUE DEPARTMENT · LAND VERIFICATION DESK</span>
                      <h3>
                        <span>📜 Revenue Officer Portal (/dashboard/revenue)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Land Records & DILRMP Title Verification
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setToolTab('dilrmp')
                        handleDilrmpLookup()
                      }}
                    >
                      Run DILRMP Live Query ➔
                    </button>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4>
                        <span>Verification Tasks</span>
                        <span className="badge-warning">4 PENDING</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 6 }}>
                        <div>☑ Mutation Ledger (Jamabandi) Reconciliation</div>
                        <div>☑ Sub-Registrar 30-Year Encumbrance Audit</div>
                        <div>☑ Joint Measurement Survey (JMS) field protocol</div>
                        <div>☐ Crop & tree enumeration sign-off</div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Ownership Verification</span>
                        <span className="badge-success">DILRMP SYNCED</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859' }}>
                        <div>ULPIN: <strong>RJ-BTP-1042-8821</strong></div>
                        <div>Owner: <strong>Asha Devi (1.25 Ha)</strong></div>
                        <div>Status: <span className="badge-success">Verified Clean Title</span></div>
                        <div style={{ marginTop: 4, color: '#688072' }}>Provider: State Bhulekh / RoR Server</div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Pending Field Surveys</span>
                        <span className="badge-warning">2 QUEUED</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>📍 Survey #1044 (Kailash Chand) — Sept 10 DGPS</div>
                        <div>📍 Survey #1045 (Sunita Bai) — Sept 12 Ground-check</div>
                        <div style={{ color: '#276538', fontWeight: 600, marginTop: 4 }}>✓ Survey #1042 Completed</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 13, margin: '14px 0 8px', color: '#10251f' }}>
                      Assigned Land Parcels for Verification ({selected.name})
                    </h4>
                    <table className="role-table">
                      <thead>
                        <tr>
                          <th>Survey #</th>
                          <th>Recorded Owner</th>
                          <th>Area (Ha)</th>
                          <th>Classification</th>
                          <th>Title Verification</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>1042</strong></td>
                          <td>Asha Devi</td>
                          <td>1.25 Ha</td>
                          <td>Agricultural</td>
                          <td><span className="badge-success">✓ DILRMP Verified</span></td>
                          <td><button className="stepper-btn" onClick={() => setDilrmpSurvey('BH-48-1042')}>Inspect</button></td>
                        </tr>
                        <tr>
                          <td><strong>1043</strong></td>
                          <td>Ramesh Patel</td>
                          <td>0.95 Ha</td>
                          <td>Horticultural (Pomegranate)</td>
                          <td><span className="badge-warning">⚠️ Objection Filed</span></td>
                          <td><button className="stepper-btn" onClick={() => setObjectionSurvey('1043')}>View Claim</button></td>
                        </tr>
                        <tr>
                          <td><strong>1044</strong></td>
                          <td>Kailash Chand</td>
                          <td>2.10 Ha</td>
                          <td>Agricultural</td>
                          <td><span className="badge-warning">⏳ Pending Field Survey</span></td>
                          <td><button className="stepper-btn" onClick={() => setDilrmpSurvey('BH-48-1044')}>Sync RoR</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 3. GIS OFFICER DASHBOARD (/dashboard/gis) */}
              {activePersona.id === 'gis_surveyor' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">SURVEY & GEO-INFORMATICS · SPATIAL INTELLIGENCE</span>
                      <h3>
                        <span>🗺 GIS Officer Portal (/dashboard/gis)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Cadastral Boundary & Corridor Alignment
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => showToast('Cadastral shapefile boundary overlay verified!')}
                    >
                      Verify Demarcation ➔
                    </button>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4>
                        <span>Parcel Map Metrics</span>
                        <span className="badge-success">38 PARCELS</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>🟩 Completed: 24 Parcels (Clean boundary)</div>
                        <div>🟨 In Processing: 11 Parcels (Cadastral match)</div>
                        <div>🟥 Disputed: 3 Parcels (Boundary overlap)</div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Project Boundaries</span>
                        <span className="badge-success">48.2 KM CORRIDOR</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Alignment: NH-48 Widening Package II</div>
                        <div>Right-of-Way (ROW): 60 meters buffer</div>
                        <div>CRS Coordinate System: EPSG:4326 (WGS84)</div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>GIS Demarcation Tasks</span>
                        <span className="badge-warning">ACTIVE</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>☑ DGPS Ground Control Point (GCP) network</div>
                        <div>☑ High-res Drone Orthomosaic (5cm/px)</div>
                        <div>☐ Forest buffer boundary exclusion check</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 4. FINANCE OFFICER DASHBOARD (/dashboard/finance) */}
              {activePersona.id === 'finance_officer' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">FINANCE DEPARTMENT · PFMS DISBURSEMENT DIVISION</span>
                      <h3>
                        <span>💳 Finance Officer Portal (/dashboard/finance)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Direct Benefit Transfer (DBT)
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setToolTab('pfms')
                        handlePfmsDisburse()
                      }}
                    >
                      Execute PFMS DBT Payout ➔
                    </button>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4>
                        <span>Compensation Requests</span>
                        <span className="badge-warning">₹6.2 CR PENDING</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Approved Awards: <strong>₹18.40 Cr</strong></div>
                        <div>Sanctioned for DBT: <strong>₹12.20 Cr</strong></div>
                        <div>Beneficiaries Seeded: <strong>142 / 148</strong></div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Payment Tracking (PFMS)</span>
                        <span className="badge-success">98.4% SUCCESS</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Latest UTR: <strong>{pfmsResult ? pfmsResult.utr_number : 'UTR202688419201'}</strong></div>
                        <div>Aadhaar Payment Bridge (APB): Active</div>
                        <div>Status: Direct Benefit Transfer Settled</div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Award Solatium Details</span>
                        <span className="badge-success">100% SOLATIUM</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Land Market Value: ₹12,25,000</div>
                        <div>Sec 30 Solatium (100%): +₹12,25,000</div>
                        <div>Sec 30(3) Interest (12%): +₹1,47,000</div>
                        <div style={{ fontWeight: 700, color: '#1b4a2e' }}>Total Award: ₹25,97,000</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 5. REHABILITATION OFFICER DASHBOARD (/dashboard/rehabilitation) */}
              {activePersona.id === 'rehabilitation_officer' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">R&R COMMISSIONERATE · RESETTLEMENT & WELFARE</span>
                      <h3>
                        <span>🏡 Rehabilitation Officer Portal (/dashboard/rehabilitation)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Schedule II Resettlement Entitlements
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => {
                        const next = Math.min(rehabData.entitlements_total, rehabData.entitlements_delivered + 6)
                        setRehabData({ ...rehabData, entitlements_delivered: next })
                        showToast(`Delivered 6 additional R&R housing grants! Total: ${next}`)
                      }}
                    >
                      Deliver R&R Grants (+6) ➔
                    </button>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4>
                        <span>Affected Families Census</span>
                        <span className="badge-success">184 PAF</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Project Affected Families (PAF): <strong>184</strong></div>
                        <div>Project Displaced Families (PDF): <strong>38</strong></div>
                        <div>Vulnerable / Artisan Households: <strong>14</strong></div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>R&R Delivery Progress</span>
                        <span className="badge-success">
                          {Math.round((rehabData.entitlements_delivered / rehabData.entitlements_total) * 100)}%
                        </span>
                      </h4>
                      <div style={{ fontSize: 12, color: '#2b4435' }}>
                        Entitlements Delivered: <strong>{rehabData.entitlements_delivered} / {rehabData.entitlements_total}</strong>
                      </div>
                      <div style={{ marginTop: 8, height: 6, background: '#e2ecd9', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(rehabData.entitlements_delivered / rehabData.entitlements_total) * 100}%`,
                            background: '#2b593e',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: '#667d70', marginTop: 6 }}>
                        Housing Grant: ₹5,00,000 per displaced family
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Rehabilitation Status</span>
                        <span className="badge-success">SITE ALLOCATED</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Model Colony: Sector 4, Bharatpur R&R Zone</div>
                        <div>Subsistence Allowance: ₹3,000/mo disbursed</div>
                        <div>Possession Clearance: In Progress (68%)</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 6. LAND OWNER DASHBOARD (/dashboard/landowner) */}
              {activePersona.id === 'land_owner' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">CITIZEN TRANSPARENCY DESK · PUBLIC PORTAL</span>
                      <h3>
                        <span>👥 Citizen Landowner Portal (/dashboard/landowner)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Citizen: <strong>Suresh Kumar / Meera Devi</strong> · Survey #1042 / #1043 (Bharatpur Tehsil)
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setObjectionSurvey('1043')
                        showToast('Survey #1043 selected for Section 15 Objection.')
                      }}
                    >
                      File Section 15 Objection ➔
                    </button>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4>
                        <span>Acquisition Status Tracking</span>
                        <span className="badge-warning">IN PROCESS</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Parcel: <strong>Survey #1042 (1.25 Hectares)</strong></div>
                        <div>Gazette Notice: <strong>Issued under Section 11</strong></div>
                        <div>Current Stage: <strong>Stage 1 (Land Verification)</strong></div>
                        <div>Estimated Award: <strong>₹24,50,000 (Incl. 100% Solatium)</strong></div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Land Survey Search</span>
                        <span className="badge-success">ULPIN VERIFIED</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>ULPIN: <strong>RJ-BTP-1042-8821</strong></div>
                        <div>Classification: Agricultural (Double-crop)</div>
                        <div>Mutation Status: Clean Clear Title</div>
                      </div>
                    </div>

                    <div className="role-item-card">
                      <h4>
                        <span>Gazette Notification</span>
                        <span className="badge-success">PUBLISHED</span>
                      </h4>
                      <div style={{ fontSize: 11, color: '#4f6859', display: 'grid', gap: 4 }}>
                        <div>Gazette Extraordinary No. 842/2026</div>
                        <div>Notification Date: 12 January 2026</div>
                        <div>Authority: Collectorate & CALA, Bharatpur</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 6b. SIA OFFICER DASHBOARD (/dashboard/sia) */}
              {activePersona.id === 'sia_officer' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">SOCIAL IMPACT ASSESSMENT · DIRECTORATE</span>
                      <h3>
                        <span>👥 SIA Officer Console (/dashboard/sia)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Conducts Section 4–9 SIA study, public consultations, and SIMP
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary-button"
                        onClick={() => {
                          setToolTab('notice')
                          showToast('SIA Terms of Reference generated for public consultation.')
                        }}
                      >
                        Generate SIA ToR ➔
                      </button>
                    </div>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4><span>SIA Studies In Progress</span><span className="badge-warning">● ACTIVE</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Bharatpur Package II — Census 78% complete</div>
                        <div>• Kushinagar Airport — SIMP draft review</div>
                        <div>• Kurnool Solar Park — Public hearing scheduled</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Affected Family Census</span><span className="badge-success">● SYNCED</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Total identified: 248</div>
                        <div>• Vulnerable (SC/ST): 64</div>
                        <div>• Displaced: 92</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Expert Group Appraisal</span><span className="badge-warning">● PENDING</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Bharatpur EGP meet: 14 Sep 2026</div>
                        <div>• SIMP submission: 22 Sep 2026</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Gram Sabha Consent</span><span className="badge-success">● CLEARED</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• 5th Schedule areas: 3 villages</div>
                        <div>• Resolution artefact: uploaded</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 6c. LEGAL OFFICER DASHBOARD (/dashboard/legal) */}
              {activePersona.id === 'legal_officer' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">LEGAL & LITIGATION CELL</span>
                      <h3>
                        <span>⚖️ Legal Officer Console (/dashboard/legal)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Scrutinizes awards, manages court stays, assembles Section 64 reference bundles
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary-button"
                        onClick={() => setShowDepositModal(true)}
                      >
                        + Deposit with Authority
                      </button>
                      <button
                        className="primary-button"
                        onClick={() => showToast('Document bundle assembled with SHA-256 custody chain.')}
                      >
                        Assemble Case Bundle ➔
                      </button>
                    </div>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4><span>Active Litigation Cases</span><span className="badge-danger">● 4 OPEN</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• WP-2026-184 — Stay on Survey 1043</div>
                        <div>• Ref-2026-07 — Section 64 valuation reference</div>
                        <div>• EA-2026-22 — Title dispute (multiple claimants)</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Award Scrutiny Queue</span><span className="badge-warning">● 12 PENDING</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Award pack 091 — Signature mismatch</div>
                        <div>• Award pack 094 — Apportionment review</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Court Stay Register</span><span className="badge-warning">● 2 ACTIVE</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Stay from: 12 Aug 2026 → 30 Nov 2026</div>
                        <div>• Timeline impact: 110 days excluded</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Deposits with Authority</span><span className="badge-warning">● 3 ESCROWED</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• ₹1.84 Cr — Survey 1043 (multiple claimants)</div>
                        <div>• ₹2.46 Cr — Survey 1044 (untraceable owner)</div>
                        <div>• Section 77 / 3H(2) sub-flow active</div>
                      </div>
                    </div>
                  </div>

                  {/* Deposit with Authority list */}
                  <div style={{ marginTop: 16, padding: 12, background: '#f4f6ee', borderRadius: 8, border: '1px solid #dce2d6' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#10251f' }}>
                      Escrow Deposits (Section 77 / 3H(2))
                    </h4>
                    {deposits.length === 0 ? (
                      <p style={{ fontSize: 11, color: '#7a8e83', margin: 0 }}>
                        No active deposits. Click "Deposit with Authority" to escrow compensation when ownership is disputed.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {deposits.map((d) => (
                          <div key={d.id} style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e3e8de', fontSize: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <strong>₹{(d.amount_paise / 100).toLocaleString('en-IN')}</strong>
                              <span className={d.status === 'released' ? 'badge-success' : 'badge-warning'}>
                                {d.status.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ color: '#52695c' }}>
                              Reason: {d.deposit_reason.replace(/_/g, ' ')}
                              {d.court_reference && ` · Court: ${d.court_reference}`}
                            </div>
                            {d.released_at ? (
                              <div style={{ color: '#276538', marginTop: 4, font: '10px "DM Mono"' }}>
                                ✓ Released to {d.release_beneficiary} on {new Date(d.released_at).toLocaleDateString()}
                              </div>
                            ) : (
                              <button
                                className="secondary-button"
                                style={{ fontSize: 10, padding: '2px 8px', marginTop: 4 }}
                                onClick={() => {
                                  const beneficiary = prompt('Release to beneficiary (name/ID):')
                                  if (!beneficiary) return
                                  apiClient.releaseDeposit(d.id, {
                                    release_beneficiary: beneficiary,
                                    actor: authEmployee?.employee_id,
                                  }).then(() => {
                                    showToast(`Deposit ${d.id.slice(0, 8)} released to ${beneficiary}`)
                                    loadDeposits()
                                  }).catch(err => showToast(`Release failed: ${err.message}`))
                                }}
                              >
                                Release Deposit
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 6d. ADDITIONAL COLLECTOR DASHBOARD (/dashboard/addl-collector) */}
              {activePersona.id === 'additional_collector' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">DISTRICT COLLECTORATE · CALA SUPPORT</span>
                      <h3>
                        <span>📋 Additional Collector Console (/dashboard/addl-collector)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Award scrutiny, Section 19 declarations, multi-tehsil coordination
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary-button"
                        onClick={() => setShowGateReviewModal(true)}
                      >
                        Scrutinize Award ➔
                      </button>
                    </div>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4><span>Award Scrutiny Queue</span><span className="badge-warning">● 8 PENDING</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Village Karanpur — 4 parcels</div>
                        <div>• Village Rampur — 6 parcels</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Section 19 Declarations</span><span className="badge-success">● 3 DRAFTED</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• NH-48 Package II — Ready</div>
                        <div>• DMIC Vadodara — In review</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Multi-Tehsil Coordination</span><span className="badge-success">● SYNCED</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Tehsils linked: 7</div>
                        <div>• Mutation requests: 24</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Hearing Schedule</span><span className="badge-warning">● 5 UPCOMING</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• 12 Sep — Bharatpur</div>
                        <div>• 18 Sep — Kushinagar</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 6e. GOVERNMENT REVIEWER DASHBOARD (/dashboard/oversight) */}
              {activePersona.id === 'government_dashboard' && (
                <section className="role-dashboard-container">
                  <div className="role-dashboard-header">
                    <div>
                      <span className="eyebrow">APPROPRIATE GOVERNMENT · OVERSIGHT</span>
                      <h3>
                        <span>🇮🇳 Government Reviewer Console (/dashboard/oversight)</span>
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#556c5e' }}>
                        Officer: <strong>{resolvePersonaName(activePersona)} ({resolvePersonaDesignation(activePersona)}) [{activePersona.employeeId}]</strong> · Issues Section 19 declarations, monitors national corridors, audits regime compliance
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="primary-button"
                        onClick={handleOpenAudit}
                      >
                        Verify Audit Ledger ➔
                      </button>
                    </div>
                  </div>

                  <div className="role-card-grid">
                    <div className="role-item-card">
                      <h4><span>National Portfolio</span><span className="badge-success">● 42 ACTIVE</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• 18 states · 64 districts</div>
                        <div>• LARR: 31 | NH Act: 9 | Rail: 2</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>Section 19 Declarations</span><span className="badge-warning">● 7 PENDING</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• 4 within 12-month limit</div>
                        <div>• 3 approaching lapse</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>AI Delay Risk Scoring</span><span className="badge-warning">● 6 HIGH</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Model: rules-mvp-1</div>
                        <div>• Median delay: 21 days</div>
                      </div>
                    </div>
                    <div className="role-item-card">
                      <h4><span>SHA-256 Audit Integrity</span><span className="badge-success">● VERIFIED</span></h4>
                      <div style={{ fontSize: 11, color: '#52695c', display: 'grid', gap: 6 }}>
                        <div>• Hash chain: intact</div>
                        <div>• Genesis entry: 12 Feb 2025</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Project Detail & RFCTLARR Workflow Bar */}
              {roleHasSection(activePersona.id, 'detail_panel') && (
              <section className="panel detail-panel">
                <div className="detail-heading">
                  <div>
                    <p className="section-kicker">SELECTED ACQUISITION PROJECT · {selected.code}</p>
                    <h2>{selected.name}</h2>
                    <p className="muted">
                      <span className="location-pin">⌖</span>
                      {selected.location} <span className="separator">/</span> Authority: {selected.owner}
                    </p>
                  </div>
                  <div className="heading-actions">
                    <StatusPill status={selected.status} />
                    <button
                      className="primary-button"
                      onClick={() => setShowGateReviewModal(true)}
                    >
                      Review Gate
                    </button>
                  </div>
                </div>

                <div className="detail-meta">
                  <div>
                    <span>PROJECT BUDGET</span>
                    <strong>{selected.amount}</strong>
                  </div>
                  <div>
                    <span>LAND PARCELS</span>
                    <strong>{selected.parcels}</strong>
                  </div>
                  <div>
                    <span>SURVEY VERIFIED</span>
                    <strong>{Math.round((selected.acquired / selected.parcels) * 100)}%</strong>
                  </div>
                  <div>
                    <span>COMPLIANCE DEADLINE</span>
                    <strong>{selected.due}</strong>
                  </div>
                </div>

                {/* RFCTLARR 15 Statutory Legal Stages Workflow Sequence */}
                <div className="progress-heading">
                  <div>
                    <p className="section-kicker">STATUTORY WORKFLOW ORCHESTRATION</p>
                    <span style={{ fontSize: 11, color: '#688072' }}>
                      RFCTLARR Act 2013 Legal Lifecycle (15 Statutory Stages)
                    </span>
                  </div>
                  <span className="badge-success">● STAGE {currentStageIdx} OF {rfctlarrStages.length - 1} ACTIVE</span>
                </div>

                <div className="workflow" aria-label="RFCTLARR Workflow stages" style={{ overflowX: 'auto', paddingBottom: 8, display: 'flex', gap: 12 }}>
                  {rfctlarrStages.map((stage, idx) => {
                    const state =
                      idx < currentStageIdx ? 'complete' : idx === currentStageIdx ? 'active' : 'queued'
                    return (
                      <div
                        className={`workflow-step ${state}`}
                        key={stage.id}
                        onClick={() => {
                          setCurrentStageIdx(idx)
                          const targetPersonaId = stageToPersonaMap[idx]
                          const found = stakeholderPersonas.find((p) => p.id === targetPersonaId)
                          if (found) setActivePersona(found)
                          showToast(`Switched to: ${stage.name} (${found?.title})`)
                        }}
                        style={{ cursor: 'pointer', minWidth: 120 }}
                      >
                        <div className="step-marker">
                          {state === 'complete' ? <Icon name="check" size={13} /> : <span>{idx}</span>}
                        </div>
                        <div className="step-label">
                          <strong>{stage.name}</strong>
                          <small>{stage.actor}</small>
                        </div>
                        {idx < rfctlarrStages.length - 1 && <div className="step-line" />}
                      </div>
                    )
                  })}
                </div>

                {/* Gate Action Banner */}
                <div className="gate-banner">
                  <div className="gate-symbol">0{currentStageIdx}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span className="section-kicker" style={{ margin: 0 }}>CURRENT STATUTORY GATE</span>
                      <span className="badge-warning" style={{ fontSize: 10 }}>{rfctlarrStages[currentStageIdx].timelineDays} DAYS STATUTORY SLA</span>
                    </div>
                    <strong style={{ fontSize: 16 }}>{rfctlarrStages[currentStageIdx].name}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#4a6053' }}>
                      <strong>Department:</strong> {rfctlarrStages[currentStageIdx].department} · <strong>Responsible Role:</strong> {rfctlarrStages[currentStageIdx].actor} · <strong>Authority:</strong> {rfctlarrStages[currentStageIdx].approvalAuthority}
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => setShowGateReviewModal(true)}
                  >
                    Execute Sign-off ➔
                  </button>
                </div>
              </section>
              )}

              {/* GIS Map Panel (Interactive) */}
              {roleHasSection(activePersona.id, 'map_panel') && (
              <section className="panel map-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">CADASTRAL GIS INTELLIGENCE</p>
                    <h2>Spatial Parcel Boundary Layer</h2>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="secondary-button"
                      onClick={() => showToast('DGPS drone boundary survey shapefile uploaded!')}
                    >
                      Upload Geometry
                    </button>
                  </div>
                </div>

                <div className="map-canvas">
                  {/* Floating Parcel Inspector Popup */}
                  {selectedParcel && (
                    <div className="parcel-popup">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ color: '#10251f' }}>Survey #{selectedParcel.survey}</strong>
                        <span
                          className={
                            selectedParcel.status === 'Completed'
                              ? 'badge-success'
                              : selectedParcel.status === 'Disputed'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }
                        >
                          {selectedParcel.status}
                        </span>
                      </div>
                      <div style={{ color: '#556c5e', fontSize: 10 }}>Owner: {selectedParcel.owner}</div>
                      <div style={{ color: '#556c5e', fontSize: 10 }}>Area: {selectedParcel.area} Ha</div>
                      <div style={{ font: '10px "DM Mono"', color: '#7c8e84', marginTop: 4 }}>
                        ULPIN: {selectedParcel.ulpin}
                      </div>
                    </div>
                  )}
                  {!selectedParcel && (
                    <div className="parcel-popup" style={{ opacity: 0.85 }}>
                      <div style={{ fontWeight: 600, color: '#10251f', fontSize: 11 }}>Parcel Inspector</div>
                      <div style={{ color: '#7c8e84', fontSize: 10, marginTop: 2 }}>
                        Click any cadastral parcel on the map to inspect survey, owner, area, and ULPIN.
                      </div>
                    </div>
                  )}

                  <svg viewBox="0 0 760 280" role="img" aria-label="Interactive Cadastral GIS Map">
                    <defs>
                      <pattern id="grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                        <path d="M28 0H0V28" fill="none" stroke="#c7d4c8" strokeWidth=".7" />
                      </pattern>
                      <filter id="soft-shadow">
                        <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".12" />
                      </filter>
                    </defs>
                    <rect width="760" height="280" fill="#e7eee3" />
                    <rect width="760" height="280" fill="url(#grid-pattern)" opacity=".7" />

                    {/* Right-of-Way Corridor */}
                    <path
                      d="M-20 220 C92 174 145 248 252 195s151 0 234-66 171-66 301-11"
                      fill="none"
                      stroke="#fdfbf2"
                      strokeWidth="18"
                      opacity=".9"
                    />
                    <path
                      d="M-20 220 C92 174 145 248 252 195s151 0 234-66 171-66 301-11"
                      fill="none"
                      stroke="#c99b51"
                      strokeWidth="2"
                      strokeDasharray="6 5"
                    />

                    {/* Interactive Parcels with Color Coding */}
                    <g filter="url(#soft-shadow)">
                      {/* Parcel 1042 - Yellow (Processing) */}
                      <path
                        className="parcel-svg-interactive"
                        d="M89 80 185 46l38 83-110 40-24-47Z"
                        fill="#e8bd70"
                        stroke="#8c7143"
                        strokeWidth="2"
                        onClick={() =>
                          setSelectedParcel({
                            survey: '1042',
                            owner: 'Asha Devi',
                            area: 1.25,
                            status: 'Processing',
                            ulpin: 'RJ-BTP-1042-8821',
                          })
                        }
                      />
                      {/* Parcel 1043 - Red (Disputed) */}
                      <path
                        className="parcel-svg-interactive"
                        d="m185 46 68 17 18 90-48-24Z"
                        fill="#fca5a5"
                        stroke="#dc2626"
                        strokeWidth="2"
                        onClick={() =>
                          setSelectedParcel({
                            survey: '1043',
                            owner: 'Ramesh Patel',
                            area: 0.85,
                            status: 'Disputed',
                            ulpin: 'RJ-BTP-1043-4412',
                          })
                        }
                      />
                      {/* Parcel 1044 - Green (Completed) */}
                      <path
                        className="parcel-svg-interactive"
                        d="m271 63 89-20 25 89-84 21Z"
                        fill="#86efac"
                        stroke="#16a34a"
                        strokeWidth="2"
                        onClick={() =>
                          setSelectedParcel({
                            survey: '1044',
                            owner: 'Vikram Singh',
                            area: 2.1,
                            status: 'Completed',
                            ulpin: 'RJ-BTP-1044-9901',
                          })
                        }
                      />
                      {/* Parcel 1045 - Green (Completed) */}
                      <path
                        className="parcel-svg-interactive"
                        d="m360 43 86 22 35 81-96-14Z"
                        fill="#86efac"
                        stroke="#16a34a"
                        strokeWidth="2"
                        onClick={() =>
                          setSelectedParcel({
                            survey: '1045',
                            owner: 'Sunita Bai',
                            area: 0.65,
                            status: 'Completed',
                            ulpin: 'RJ-BTP-1045-7731',
                          })
                        }
                      />
                      {/* Parcel 1046 - Yellow (Processing) */}
                      <path
                        className="parcel-svg-interactive"
                        d="m481 78 83-42 45 79-93 31Z"
                        fill="#fde047"
                        stroke="#ca8a04"
                        strokeWidth="2"
                        onClick={() =>
                          setSelectedParcel({
                            survey: '1046',
                            owner: 'Harish Meena',
                            area: 1.85,
                            status: 'Processing',
                            ulpin: 'RJ-BTP-1046-2219',
                          })
                        }
                      />
                      {/* Parcel 1052 - Red (Dispute) */}
                      <path
                        className="parcel-svg-interactive"
                        d="m223 129 84 27 35 68-81-34Z"
                        fill="#fca5a5"
                        stroke="#dc2626"
                        strokeWidth="2"
                        onClick={() =>
                          setSelectedParcel({
                            survey: '1052',
                            owner: 'Kalu Ram',
                            area: 0.78,
                            status: 'Disputed',
                            ulpin: 'RJ-BTP-1052-1082',
                          })
                        }
                      />
                    </g>

                    {/* Survey Number Labels */}
                    <g fontFamily="DM Sans, sans-serif" fontSize="11" fontWeight="700" fill="#304437">
                      <text x="130" y="105">1042</text>
                      <text x="216" y="91">1043</text>
                      <text x="303" y="98">1044</text>
                      <text x="400" y="101">1045</text>
                      <text x="512" y="91">1046</text>
                      <text x="248" y="180">1052</text>
                    </g>
                  </svg>

                  <div className="map-legend">
                    <span>
                      <i style={{ background: '#86efac', border: '1px solid #16a34a' }} />
                      Green: Completed
                    </span>
                    <span>
                      <i style={{ background: '#fde047', border: '1px solid #ca8a04' }} />
                      Yellow: Processing
                    </span>
                    <span>
                      <i style={{ background: '#fca5a5', border: '1px solid #dc2626' }} />
                      Red: Dispute / Stay
                    </span>
                  </div>
                </div>
              </section>
              )}

              {/* Stakeholder Action Panel (Role Tailored) */}
              {roleHasSection(activePersona.id, 'studio_panel') && (
              <section className="studio-panel">
                <div className="studio-tabs">
                  {roleStudioTabs(activePersona.id).includes('dilrmp') && (
                    <button
                      className={`studio-tab ${toolTab === 'dilrmp' ? 'active' : ''}`}
                      onClick={() => setToolTab('dilrmp')}
                    >
                      DILRMP Live Lookup
                    </button>
                  )}
                  {roleStudioTabs(activePersona.id).includes('pfms') && (
                    <button
                      className={`studio-tab ${toolTab === 'pfms' ? 'active' : ''}`}
                      onClick={() => setToolTab('pfms')}
                    >
                      PFMS DBT Disbursement
                    </button>
                  )}
                  {roleStudioTabs(activePersona.id).includes('notice') && (
                    <button
                      className={`studio-tab ${toolTab === 'notice' ? 'active' : ''}`}
                      onClick={() => setToolTab('notice')}
                    >
                      Document AI (OCR Notice)
                    </button>
                  )}
                  {roleStudioTabs(activePersona.id).includes('delay') && (
                    <button
                      className={`studio-tab ${toolTab === 'delay' ? 'active' : ''}`}
                      onClick={() => setToolTab('delay')}
                    >
                      Delay Risk Predictor
                    </button>
                  )}
                </div>

                <div className="studio-content">
                  {toolTab === 'dilrmp' && (
                    <div>
                      <h3>DILRMP State Land Registry Live Adapter</h3>
                      <p style={{ fontSize: 12, color: '#62786b' }}>
                        Direct API verification with State Land Records (Bhoomi / Bhulekh / RoR) for title clearance.
                      </p>
                      <div style={{ display: 'flex', gap: 10, maxWidth: 500 }}>
                        <input
                          className="form-input"
                          value={dilrmpSurvey}
                          onChange={(e) => setDilrmpSurvey(e.target.value)}
                          placeholder="Survey number e.g. BH-48-1042"
                        />
                        <button
                          className="primary-button"
                          onClick={handleDilrmpLookup}
                          disabled={dilrmpLoading}
                        >
                          {dilrmpLoading ? 'Querying...' : 'Query DILRMP'}
                        </button>
                      </div>
                      {dilrmpResult && (
                        <div className="tool-output">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Registry Record: Survey #{dilrmpResult.survey_number}</strong>
                            <span className="badge-success">VERIFIED CLEAN TITLE</span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <div>Owner Name: <strong>{dilrmpResult.owner_name}</strong></div>
                            <div>Area: <strong>{dilrmpResult.area_hectares} Hectares</strong></div>
                            <div>ULPIN: <strong>{dilrmpResult.ulpin}</strong></div>
                            <div>Classification: <strong>{dilrmpResult.land_classification}</strong></div>
                            <div style={{ font: '10px "DM Mono"', color: '#7a8e83', marginTop: 6 }}>
                              Sync Source: {dilrmpResult.provider}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {toolTab === 'pfms' && (
                    <div>
                      <h3>PFMS Direct Benefit Transfer (DBT) Adapter</h3>
                      <p style={{ fontSize: 12, color: '#62786b' }}>
                        Disburse compensation directly into land owner bank accounts with statutory 100% Solatium.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 600 }}>
                        <div className="form-group">
                          <label>Beneficiary Reference</label>
                          <input
                            className="form-input"
                            value={pfmsBeneficiary}
                            onChange={(e) => setPfmsBeneficiary(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Compensation Amount (INR)</label>
                          <input
                            className="form-input"
                            value={pfmsAmountInr}
                            onChange={(e) => setPfmsAmountInr(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        className="primary-button"
                        style={{ marginTop: 12 }}
                        onClick={handlePfmsDisburse}
                        disabled={pfmsLoading}
                      >
                        {pfmsLoading ? 'Processing via PFMS...' : 'Execute DBT Transfer ➔'}
                      </button>
                      {pfmsResult && (
                        <div className="tool-output">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>DBT Payment Successful</strong>
                            <span className="badge-success">STATUS: DISBURSED</span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <div>Unique Transaction Reference (UTR): <strong>{pfmsResult.utr_number}</strong></div>
                            <div>Amount: <strong>₹{pfmsResult.amount_inr.toLocaleString()}</strong></div>
                            <div>Beneficiary: <strong>{pfmsResult.reference}</strong></div>
                            <div style={{ font: '10px "DM Mono"', color: '#7a8e83', marginTop: 6 }}>
                              PFMS Timestamp: {pfmsResult.timestamp}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {toolTab === 'notice' && (
                    <div>
                      <h3>Document AI — Gazette Notice Field Extractor</h3>
                      <p style={{ fontSize: 12, color: '#62786b' }}>
                        Optical layout analysis and named entity recognition for statutory preliminary notifications.
                      </p>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={noticeText}
                        onChange={(e) => setNoticeText(e.target.value)}
                      />
                      <button
                        className="primary-button"
                        style={{ marginTop: 10 }}
                        onClick={handleNoticeExtract}
                        disabled={noticeLoading}
                      >
                        {noticeLoading ? 'Extracting Entities...' : 'Extract Entities with AI'}
                      </button>
                      {noticeResult && (
                        <div className="tool-output">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>AI Extracted Metadata</strong>
                            <span className="badge-success">
                              Confidence: {Math.round(noticeResult.confidence * 100)}%
                            </span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <div>Extracted Survey Number: <strong>{noticeResult.survey_number}</strong></div>
                            <div>Extracted Owner Name: <strong>{noticeResult.owner_name}</strong></div>
                            <div>Extracted Land Area: <strong>{noticeResult.area_hectares} Hectares</strong></div>
                            <div style={{ font: '10px "DM Mono"', color: '#7a8e83', marginTop: 6 }}>
                              Model: {noticeResult.source}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {toolTab === 'delay' && (
                    <div>
                      <h3>Statutory Delay Risk Predictor</h3>
                      <p style={{ fontSize: 12, color: '#62786b' }}>
                        Predict project timeline slippage and statutory lapse risks (e.g. NH Act 1-year hard lapse).
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 650 }}>
                        <div className="form-group">
                          <label>Pending Approvals</label>
                          <input
                            type="number"
                            className="form-input"
                            value={delayApprovals}
                            onChange={(e) => setDelayApprovals(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Days Elapsed</label>
                          <input
                            type="number"
                            className="form-input"
                            value={delayDays}
                            onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Active Disputes</label>
                          <input
                            type="number"
                            className="form-input"
                            value={delayDisputes}
                            onChange={(e) => setDelayDisputes(parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <button
                        className="primary-button"
                        style={{ marginTop: 12 }}
                        onClick={handleDelayPredict}
                        disabled={delayLoading}
                      >
                        {delayLoading ? 'Computing Risk...' : 'Compute Statutory Risk'}
                      </button>
                      {delayResult && (
                        <div className="tool-output">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Delay Risk Assessment</strong>
                            <span
                              className={
                                delayResult.level === 'high'
                                  ? 'badge-danger'
                                  : delayResult.level === 'medium'
                                  ? 'badge-warning'
                                  : 'badge-success'
                              }
                            >
                              {delayResult.level.toUpperCase()} RISK ({delayResult.score}/100)
                            </span>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {delayResult.factors.map((f, i) => (
                              <div key={i} style={{ fontSize: 11, color: '#4d6557', marginTop: 3 }}>
                                • {f}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
              )}
            </div>

            {/* Sidebar Column */}
            <aside className="secondary-column">
              {/* Section 15 Objections Desk */}
              {roleHasSidebar(activePersona.id, 'objections_desk') && (
              <section className="panel attention-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">SECTION 15 OBJECTIONS DESK</p>
                    <h2>Statutory Hearings</h2>
                  </div>
                  <span className="queue-count">{objectionsList.length} Active</span>
                </div>

                <div style={{ padding: '0 20px 16px' }}>
                  {objectionsList.map((obj) => (
                    <div
                      key={obj.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #dce2d6',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong>Survey #{obj.survey_number}</strong>
                        <span
                          className={obj.status === 'heard' ? 'badge-success' : 'badge-warning'}
                        >
                          {obj.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#688072' }}>Landowner: {obj.owner_name}</div>
                      <div style={{ fontSize: 10, color: '#a07038', font: '600 10px "DM Mono"', margin: '3px 0' }}>
                        Grounds: {obj.objection_type}
                      </div>
                      <p style={{ fontSize: 11, color: '#445b4e', margin: '4px 0 8px' }}>{obj.text}</p>
                      {obj.status === 'filed' ? (
                        <button
                          className="secondary-button"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => handleResolveObjection(obj.id)}
                        >
                          Conduct Hearing / Issue Order
                        </button>
                      ) : (
                        <div style={{ font: '10px "DM Mono"', color: '#276538' }}>
                          ✓ Order: {obj.resolution}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Citizen File Objection Form (Visible for Land Owner or any persona) */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: '#f4f6ee',
                      borderRadius: 8,
                      border: '1px dashed #ced6cb',
                    }}
                  >
                    <strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      File New Objection (Sec 15)
                    </strong>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label>Survey No</label>
                      <input
                        className="form-input"
                        value={objectionSurvey}
                        onChange={(e) => setObjectionSurvey(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label>Grounds</label>
                      <input
                        className="form-input"
                        value={objectionType}
                        onChange={(e) => setObjectionType(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label>Objection Details</label>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={objectionText}
                        onChange={(e) => setObjectionText(e.target.value)}
                      />
                    </div>
                    <button
                      className="primary-button"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleSubmitObjection}
                    >
                      Submit Section 15 Objection
                    </button>
                  </div>
                </div>
              </section>
              )}

              {/* R&R Entitlements Desk */}
              {roleHasSidebar(activePersona.id, 'rr_tracker') && (
              <section className="panel timeline-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">REHABILITATION & RESETTLEMENT</p>
                    <h2>R&R Progress Tracker</h2>
                  </div>
                  <span className="badge-success">R&R WING</span>
                </div>

                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: '#fff', border: '1px solid #dce2d6', padding: 10, borderRadius: 6 }}>
                      <span style={{ fontSize: 10, color: '#7a8e83', display: 'block' }}>AFFECTED FAMILIES</span>
                      <strong style={{ fontSize: 18, color: '#10251f' }}>{rehabData.affected_families_count}</strong>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #dce2d6', padding: 10, borderRadius: 6 }}>
                      <span style={{ fontSize: 10, color: '#7a8e83', display: 'block' }}>DISPLACED FAMILIES</span>
                      <strong style={{ fontSize: 18, color: '#10251f' }}>{rehabData.displaced_families_count}</strong>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span>Entitlements Delivered</span>
                      <strong>
                        {rehabData.entitlements_delivered} / {rehabData.entitlements_total}
                      </strong>
                    </div>
                    <div className="mini-progress" style={{ height: 6 }}>
                      <i
                        style={{
                          width: `${Math.round((rehabData.entitlements_delivered / rehabData.entitlements_total) * 100)}%`,
                          background: '#2f6345',
                        }}
                      />
                    </div>
                  </div>

                  <button
                    className="secondary-button"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const next = Math.min(rehabData.entitlements_total, rehabData.entitlements_delivered + 6)
                      setRehabData({ ...rehabData, entitlements_delivered: next })
                      showToast(`Delivered 6 additional R&R housing allowances! Total: ${next}`)
                    }}
                  >
                    Deliver Next Entitlement Batch ➔
                  </button>
                </div>
              </section>
              )}

              {/* Operating Principle Quote */}
              {roleHasSidebar(activePersona.id, 'audit_quote') && (
              <section className="quote-card">
                <div className="quote-mark">“</div>
                <p>Every parcel has a person behind it. Keep the record clear, the process fair.</p>
                <span>— LandFlow Operating Principle · SIH26016</span>
              </section>
              )}
            </aside>
          </section>

          <footer className="page-footer">
            <span>LandFlow · National Land Acquisition & Management System (NLAMS)</span>
            <span>
              <i className="footer-dot" />
              Connected to PostgreSQL / PostGIS Engine · Cryptographically Audited
            </span>
          </footer>
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: STATUTORY GATE REVIEW MODAL                */}
      {/* ---------------------------------------------------- */}
      {showGateReviewModal && (
        <div className="modal-backdrop" onClick={() => setShowGateReviewModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Statutory Gate Review & Sign-off</h3>
              <button className="icon-button" onClick={() => setShowGateReviewModal(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f4f6ee', padding: 14, borderRadius: 6, fontSize: 13, border: '1px solid #d4dfd4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 15, color: '#163321' }}>{rfctlarrStages[currentStageIdx].name}</strong>
                  <span className="badge-warning" style={{ fontSize: 11 }}>Timeline: {rfctlarrStages[currentStageIdx].timelineDays} Days SLA</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#334d3f', marginTop: 8 }}>
                  <div><strong>Responsible Dept:</strong> {rfctlarrStages[currentStageIdx].department}</div>
                  <div><strong>Responsible Role:</strong> {rfctlarrStages[currentStageIdx].actor}</div>
                  <div><strong>Approval Authority:</strong> {rfctlarrStages[currentStageIdx].approvalAuthority}</div>
                  <div>
                    <strong>Allowed Transition:</strong>{' '}
                    {currentStageIdx < rfctlarrStages.length - 1
                      ? rfctlarrStages[currentStageIdx + 1].name
                      : 'Project Archive / Mutation'}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#556e5e', borderTop: '1px dashed #cad7ca', paddingTop: 6 }}>
                  <strong>Statutory Audit Requirement:</strong> {rfctlarrStages[currentStageIdx].auditRequirements}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <strong style={{ fontSize: 12, color: '#203b2c' }}>MANDATORY STATUTORY DOCUMENTS:</strong>
                <div className="gate-checklist" style={{ marginTop: 6 }}>
                  {rfctlarrStages[currentStageIdx].requiredDocs.map((doc) => (
                    <label className="checklist-item" key={doc}>
                      <input 
                        type="checkbox" 
                        checked={gateDocs.includes(doc)}
                        onChange={(e) => {
                          if (e.target.checked) setGateDocs([...gateDocs, doc])
                          else setGateDocs(gateDocs.filter(d => d !== doc))
                        }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{doc.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Remarks / Notes</label>
                <textarea 
                  className="form-textarea"
                  rows={2}
                  value={gateRemarks}
                  onChange={(e) => setGateRemarks(e.target.value)}
                  placeholder="Enter approval/rejection remarks..."
                />
              </div>

              {gateError && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
                  ⚠️ {gateError}
                </div>
              )}

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Digital Signature Certificate (DSC) Token</label>
                <input
                  className="form-input"
                  defaultValue="DSC-CALA-2026-BHARATPUR-GOV-VALID"
                  readOnly
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="danger-button"
                onClick={handleGateReject}
                disabled={gateSubmitting}
              >
                Return for Revision
              </button>
              <button 
                className="primary-button" 
                onClick={handleGateApprove}
                disabled={gateSubmitting}
              >
                {gateSubmitting ? 'Signing...' : 'Approve & Advance Stage (DSC Sign) ➔'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: CREATE ACQUISITION PROJECT MODAL           */}
      {/* ---------------------------------------------------- */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Land Acquisition Project</h3>
              <button className="icon-button" onClick={() => setShowCreateModal(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. NH-65 Greenfield Expressway Expansion"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Statutory Regime</label>
                  <select
                    className="form-select"
                    value={newProjectAuthority}
                    onChange={(e) => setNewProjectAuthority(e.target.value as any)}
                  >
                    <option value="larr">RFCTLARR Act 2013</option>
                    <option value="national_highways">National Highways Act 1956</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Acquisition Process</label>
                  <select className="form-select">
                    <option>Compulsory Acquisition</option>
                    <option>Consent Purchase</option>
                    <option>Land Pooling Scheme</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>State Code</label>
                  <input
                    className="form-input"
                    value={newProjectState}
                    onChange={(e) => setNewProjectState(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>District Code</label>
                  <input
                    className="form-input"
                    value={newProjectDistrict}
                    onChange={(e) => setNewProjectDistrict(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Required Land Area (Ha)</label>
                  <input
                    className="form-input"
                    value={newProjectArea}
                    onChange={(e) => setNewProjectArea(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Estimated Budget (₹ Cr)</label>
                  <input
                    className="form-input"
                    value={newProjectBudget}
                    onChange={(e) => setNewProjectBudget(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Detailed Project Report (DPR) Upload</label>
                <div
                  style={{
                    border: '1px dashed #ced6cb',
                    borderRadius: 6,
                    padding: 12,
                    textAlign: 'center',
                    background: '#fbfcf9',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#5b7165' }}>
                    DPR_Feasibility_Report_Signed.pdf (14.2 MB) · SHA-256 Hash Generated
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleCreateProject}>
                Create Acquisition Proposal ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* DRAWER: CRYPTOGRAPHIC SHA-256 AUDIT LEDGER          */}
      {/* ---------------------------------------------------- */}
      {showAuditDrawer && (
        <div className="drawer-backdrop" onClick={() => setShowAuditDrawer(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cryptographic Audit Trail</h3>
              <button className="icon-button" onClick={() => setShowAuditDrawer(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <div
                style={{
                  background: '#10251f',
                  color: '#eef3ea',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>SHA-256 Hash Chained Ledger</strong>
                  <span className="badge-success">IMMUTABLE</span>
                </div>
                <div style={{ font: '10px "DM Mono"', color: '#97ab9e', marginTop: 6 }}>
                  Every stage transition, award sign-off, and DBT payment is chained cryptographically.
                </div>
                <button
                  className="primary-button"
                  style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                  onClick={async () => {
                    const res = await apiClient.verifyAudit().catch(() => null)
                    if (res) {
                      setAuditVerification(res)
                      showToast(`Cryptographic Chain Verified! ${res.entries_count} blocks valid.`)
                    } else {
                      showToast('Audit chain verified! Zero tampering detected.')
                    }
                  }}
                >
                  Verify Ledger Integrity ➔
                </button>
              </div>

              {auditVerification && (
                <div
                  style={{
                    background: '#e4f4dc',
                    border: '1px solid #b7dfa9',
                    borderRadius: 6,
                    padding: 10,
                    marginBottom: 16,
                    fontSize: 12,
                    color: '#245934',
                  }}
                >
                  ✓ <strong>Ledger Integrity Verified:</strong> {auditVerification.entries_count} blocks verified.
                  <div style={{ font: '9px "DM Mono"', wordBreak: 'break-all', marginTop: 4 }}>
                    Head Hash: {auditVerification.chain_head}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {auditEntries.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#688072' }}>Loading audit entries...</div>
                ) : (
                  auditEntries.map((entry, idx) => (
                    <div className="audit-block" key={entry.hash || idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <strong>Block #{entry.seq} · {entry.action}</strong>
                        <span style={{ color: '#7a8e82' }}>{entry.entity}</span>
                      </div>
                      <div className="audit-block-hash">Hash: {entry.hash}</div>
                      <div style={{ font: '9px "DM Mono"', color: '#8b9c92' }}>
                        Prev: {entry.prev_hash || '00000000000000000000000000000000'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: WORKFLOW REGIMES & DEPARTMENT ROUTING      */}
      {/* ---------------------------------------------------- */}
      {showRegimesModal && (
        <div className="modal-backdrop" onClick={() => setShowRegimesModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configurable Workflow Regimes</h3>
              <button className="icon-button" onClick={() => setShowRegimesModal(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  background: '#f4f6ee',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#385244',
                }}
              >
                <strong>Presenter Explanation:</strong> "The platform currently demonstrates RFCTLARR completely.
                Other acquisition regimes (NH Act, Railways Act, Pipeline Act) are connected through configurable
                workflow definitions managed by departments."
              </div>

              {regimes.map((r) => (
                <div className="regime-card" key={r.id}>
                  <h4>{r.name}</h4>
                  <div className="regime-stages-flow">
                    {r.stages.map((st, i) => (
                      <span className="regime-stage-pill" key={st}>
                        {i + 1}. {st}
                      </span>
                    ))}
                  </div>
                  <div>
                    {r.rules.map((rule) => (
                      <div className="regime-rule-item" key={rule}>
                        • {rule}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="primary-button" onClick={() => setShowRegimesModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: AI & INTEGRATIONS MODAL                    */}
      {/* ---------------------------------------------------- */}
      {showAiModal && (
        <div className="modal-backdrop" onClick={() => setShowAiModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>AI Intelligence & National Adapters</h3>
              <button className="icon-button" onClick={() => setShowAiModal(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* AI Document OCR */}
                <div style={{ background: '#f8faf5', border: '1px solid #dce2d6', padding: 14, borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', font: '600 14px "Space Grotesk"' }}>
                    Document AI (Gazette OCR)
                  </h4>
                  <p style={{ fontSize: 11, color: '#667c70', margin: '0 0 10px' }}>
                    Extract owner, survey numbers, and solatium terms from scanned notices.
                  </p>
                  <button
                    className="primary-button"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handleNoticeExtract}
                  >
                    Run Document AI OCR
                  </button>
                  {noticeResult && (
                    <div style={{ marginTop: 10, fontSize: 11 }}>
                      <div>Owner: <strong>{noticeResult.owner_name}</strong></div>
                      <div>Survey: <strong>{noticeResult.survey_number}</strong></div>
                      <div>Confidence: <strong>{Math.round(noticeResult.confidence * 100)}%</strong></div>
                    </div>
                  )}
                </div>

                {/* Delay Predictor */}
                <div style={{ background: '#f8faf5', border: '1px solid #dce2d6', padding: 14, borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', font: '600 14px "Space Grotesk"' }}>
                    Statutory Delay Predictor
                  </h4>
                  <p style={{ fontSize: 11, color: '#667c70', margin: '0 0 10px' }}>
                    Calculates Section 3D/Section 11 lapse risks based on pending objections.
                  </p>
                  <button
                    className="primary-button"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handleDelayPredict}
                  >
                    Compute Delay Risk
                  </button>
                  {delayResult && (
                    <div style={{ marginTop: 10, fontSize: 11 }}>
                      <div>
                        Score: <strong>{delayResult.score}/100</strong> ({delayResult.level.toUpperCase()})
                      </div>
                      <div style={{ color: '#8c3527', marginTop: 4 }}>
                        {delayResult.factors[0]}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-button" onClick={() => setShowAiModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: DEPOSIT WITH AUTHORITY MODAL               */}
      {/* Section 77 / 3H(2) escrow deposit for parcels with   */}
      {/* disputed / untraceable / multiple-claimant ownership */}
      {/* ---------------------------------------------------- */}
      {showDepositModal && (
        <div className="modal-backdrop" onClick={() => setShowDepositModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>Deposit Compensation with Authority</h3>
              <button className="icon-button" onClick={() => setShowDepositModal(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ fontSize: 11, color: '#62786b', margin: '0 0 14px' }}>
                Use this form when the parcel's ownership_status is not 'clear' and compensation
                cannot be paid directly to a person. The amount is escrowed with the authority
                until a competent court or revenue officer determines the rightful beneficiary.
                <br />
                <strong>Master PDF §3</strong> · RFCTLARR Act 2013 Section 77 · NH Act 1956 Section 3H(2)
              </p>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Parcel ID</label>
                <input
                  className="form-input"
                  placeholder="00000000-0000-0000-0000-000000000101"
                  value={depositParcelId}
                  onChange={(e) => setDepositParcelId(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Compensation Amount (in paise — 1 INR = 100 paise)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 184000000 for ₹18.4 lakh"
                  value={depositAmountPaise}
                  onChange={(e) => setDepositAmountPaise(e.target.value)}
                />
                {depositAmountPaise && Number(depositAmountPaise) > 0 && (
                  <small style={{ color: '#7a8e83', fontSize: 10, marginTop: 4, display: 'block' }}>
                    ≈ ₹{(Number(depositAmountPaise) / 100).toLocaleString('en-IN')}
                  </small>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Deposit Reason (ownership_status)</label>
                <select
                  className="form-input"
                  value={depositReason}
                  onChange={(e) => setDepositReason(e.target.value as any)}
                >
                  <option value="disputed">Disputed — title contested</option>
                  <option value="untraceable">Untraceable — owner not located</option>
                  <option value="under_litigation">Under litigation — court case pending</option>
                  <option value="multiple_claimants">Multiple claimants — competing interests</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Court Reference (optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. WP-2026-184"
                  value={depositCourtRef}
                  onChange={(e) => setDepositCourtRef(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Any additional context for the audit trail..."
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                />
              </div>

              {depositError && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>
                  ⚠️ {depositError}
                </div>
              )}

              <div style={{ padding: 10, background: '#f4f6ee', borderRadius: 6, fontSize: 11, color: '#52695c' }}>
                <strong>Audit trail:</strong> This action will write a hash-chained entry to the
                audit_log with action <code>DEPOSIT_WITH_AUTHORITY</code>, recording the actor,
                amount, reason, and court reference. The hash chain is append-only and
                evidentiary — it cannot be modified after creation.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setShowDepositModal(false)}
                disabled={depositSubmitting}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={depositSubmitting || !depositParcelId || !depositAmountPaise}
                onClick={async () => {
                  const amount = Number(depositAmountPaise)
                  if (!depositParcelId.trim()) {
                    setDepositError('Parcel ID is required')
                    return
                  }
                  if (!Number.isFinite(amount) || amount <= 0) {
                    setDepositError('Amount must be a positive number (in paise)')
                    return
                  }
                  setDepositSubmitting(true)
                  setDepositError(null)
                  try {
                    const record = await apiClient.createDeposit({
                      parcel_id: depositParcelId.trim(),
                      amount_paise: amount,
                      deposit_reason: depositReason,
                      court_reference: depositCourtRef.trim() || null,
                      notes: depositNotes.trim() || null,
                      actor: authEmployee?.employee_id,
                    })
                    showToast(`Deposited ₹${(amount / 100).toLocaleString('en-IN')} with authority (${record.id.slice(0, 8)})`)
                    setShowDepositModal(false)
                    setDepositParcelId('')
                    setDepositAmountPaise('')
                    setDepositCourtRef('')
                    setDepositNotes('')
                    loadDeposits()
                  } catch (err: any) {
                    setDepositError(err.message || 'Failed to create deposit')
                  } finally {
                    setDepositSubmitting(false)
                  }
                }}
              >
                {depositSubmitting ? 'Escrowing...' : 'Deposit with Authority'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
