import React, { useState } from 'react'
import type { StatutoryStageItem, StakeholderPersona } from '../App'
import type { Project, MyTaskItem } from '../api/client'
import { isCategoryAllowedForRole, getCategoryRestrictionReason } from '../rbac'

export interface CategoryViewsProps {
  activeCategory: string
  onSelectCategory: (cat: string) => void
  projects: Project[]
  selected: Project
  onSelectProject: (p: Project) => void
  activePersona: StakeholderPersona
  onSwitchPersona: (p: StakeholderPersona) => void
  stakeholderPersonas: StakeholderPersona[]
  myTasks: MyTaskItem[]
  meTasks: any[]
  onOpenGateReview: () => void
  dilrmpSurvey: string
  setDilrmpSurvey: (s: string) => void
  dilrmpResult: any
  dilrmpLoading: boolean
  onDilrmpLookup: () => void
  pfmsBeneficiary: string
  setPfmsBeneficiary: (b: string) => void
  pfmsAmountInr: string
  setPfmsAmountInr: (a: string) => void
  pfmsResult: any
  pfmsLoading: boolean
  onPfmsDisburse: () => void
  auditEntries: any[]
  auditStats: any
  regimes: any[]
  showToast: (msg: string) => void
  can: (perm: string) => boolean
  currentStageIdx: number
  rfctlarrStages: StatutoryStageItem[]
}

export function CategoryViews({
  activeCategory,
  onSelectCategory,
  projects,
  selected,
  onSelectProject,
  activePersona,
  myTasks,
  meTasks,
  onOpenGateReview,
  dilrmpSurvey,
  setDilrmpSurvey,
  dilrmpResult,
  dilrmpLoading,
  onDilrmpLookup,
  pfmsBeneficiary,
  setPfmsBeneficiary,
  pfmsAmountInr,
  setPfmsAmountInr,
  pfmsResult,
  pfmsLoading,
  onPfmsDisburse,
  auditEntries,
  auditStats,
  regimes,
  showToast,
  can,
  currentStageIdx,
  rfctlarrStages,
}: CategoryViewsProps) {
  // Category-specific internal states
  const [projectSearch, setProjectSearch] = useState('')
  const [projectSectorFilter, setProjectSectorFilter] = useState('ALL')
  const [selectedParcelId, setSelectedParcelId] = useState('PARCEL-1042')
  const [calcMarketValue, setCalcMarketValue] = useState('18500000')
  const [calcMultiplier, setCalcMultiplier] = useState('1.50')
  const [calcAssetVal, setCalcAssetVal] = useState('3200000')
  const [calcNoticeMonths, setCalcNoticeMonths] = useState('8')
  const [newObjectionName, setNewObjectionName] = useState('')
  const [newObjectionSurvey, setNewObjectionSurvey] = useState('BH-48-1042')
  const [newObjectionGround, setNewObjectionGround] = useState('Inadequate Market Valuation (Sec 26)')

  // Sample Cadastral Parcels database
  const cadastralParcels = [
    {
      id: 'PARCEL-1042',
      survey: 'BH-48-1042',
      ulpin: '14081042-2026-RAJ',
      owner: 'Asha Devi w/o Ram Lal',
      areaHa: 1.25,
      areaBigha: 4.88,
      soil: 'Chahi-1 (Irrigated Double Crop)',
      status: 'Verified',
      marketRate: '₹42,00,000 / ha',
      grossAward: '₹1,18,12,500',
      solatium: '₹39,37,500',
      dbtStatus: 'Disbursed',
      utr: 'PFMS202688419201',
      encumbrance: 'Nil (Clean Title)',
      coordinates: '27.2170° N, 77.4895° E',
    },
    {
      id: 'PARCEL-1043',
      survey: 'BH-48-1043',
      ulpin: '14081043-2026-RAJ',
      owner: 'Manoj Kumar Sharma & Brothers',
      areaHa: 2.10,
      areaBigha: 8.20,
      soil: 'Barani (Unirrigated Arable)',
      status: 'Under Scrutiny',
      marketRate: '₹34,00,000 / ha',
      grossAward: '₹1,60,65,000',
      solatium: '₹53,55,000',
      dbtStatus: 'Pending Escrow',
      utr: 'Pending Sec 77 Deposit',
      encumbrance: 'Partition Suit Pending (OS 42/2025)',
      coordinates: '27.2185° N, 77.4912° E',
    },
    {
      id: 'PARCEL-1044',
      survey: 'BH-48-1044',
      ulpin: '14081044-2026-RAJ',
      owner: 'Gram Panchayat Common Pasture (Gauchar)',
      areaHa: 0.85,
      areaBigha: 3.32,
      soil: 'Gauchar / Community Land',
      status: 'Verified',
      marketRate: '₹28,00,000 / ha',
      grossAward: '₹53,55,000',
      solatium: '₹17,85,000',
      dbtStatus: 'Deposited in Authority',
      utr: 'PFMS202688419288',
      encumbrance: 'Gram Sabha Resolution Passed',
      coordinates: '27.2198° N, 77.4930° E',
    },
    {
      id: 'PARCEL-1045',
      survey: 'BH-48-1045',
      ulpin: '14081045-2026-RAJ',
      owner: 'Sukhvinder Singh s/o Gurdial Singh',
      areaHa: 1.65,
      areaBigha: 6.44,
      soil: 'Chahi-2 (Tubewell Irrigated)',
      status: 'Verified',
      marketRate: '₹40,00,000 / ha',
      grossAward: '₹1,48,50,000',
      solatium: '₹49,50,000',
      dbtStatus: 'Disbursed',
      utr: 'PFMS202688419310',
      encumbrance: 'Nil (Clean Title)',
      coordinates: '27.2210° N, 77.4948° E',
    },
  ]

  // Sample Objections Registry
  const objectionsData = [
    {
      id: 'OBJ-2026-089',
      survey: 'BH-48-1043',
      petitioner: 'Manoj Kumar Sharma',
      ground: 'Inadequate Market Valuation (Sec 26)',
      detail: 'Circle rate fixed at ₹34L/ha whereas registered sale deeds in adjoining village exceed ₹55L/ha. Demands 1.5x revision.',
      dateFiled: '2026-08-14',
      hearingDate: '2026-09-12',
      status: 'Hearing Scheduled',
      officer: 'District Collector (CALA)',
      tagColor: '#fa6e39',
    },
    {
      id: 'OBJ-2026-092',
      survey: 'BH-48-1046',
      petitioner: 'Rameshwar Lal & 4 Others',
      ground: 'Corridor Alignment Bisects Standing Tube-well',
      detail: 'Alignment cuts tubewell and solar pump set. Requests 15-meter northern realignment to preserve water source.',
      dateFiled: '2026-08-18',
      hearingDate: '2026-09-08',
      status: 'Disposed (Speaking Order Issued)',
      officer: 'Additional Collector / CALA',
      tagColor: '#00b545',
    },
    {
      id: 'OBJ-2026-095',
      survey: 'BH-48-1047',
      petitioner: 'Kamla Bai w/o Late Sitaram',
      ground: 'R&R Second Schedule Entitlement Exclusion',
      detail: 'Family not enumerated in SIA baseline census. Requests inclusion as landless dependent family for house allotment.',
      dateFiled: '2026-08-22',
      hearingDate: '2026-09-15',
      status: 'Under Verification',
      officer: 'Rehabilitation Officer (Administrator R&R)',
      tagColor: '#7b3ff2',
    },
  ]

  // Interactive Compensation Calculation
  const baseVal = parseFloat(calcMarketValue || '0')
  const mult = parseFloat(calcMultiplier || '1.0')
  const assetVal = parseFloat(calcAssetVal || '0')
  const months = parseFloat(calcNoticeMonths || '0')
  const multipliedMarketValue = baseVal * mult
  const compBeforeSolatium = multipliedMarketValue + assetVal
  const solatium100 = compBeforeSolatium // 100% solatium per Section 30(2)
  const interestRate = (12 / 100) * (months / 12) // 12% per annum per Section 30(3)
  const additionalInterest = multipliedMarketValue * interestRate
  const totalAwardPayable = compBeforeSolatium + solatium100 + additionalInterest

  // Header banner renderer for all category panels
  const renderCategoryHeader = (
    title: string,
    subtitle: string,
    tagLabel: string,
    tagColor: string = '#00ed64',
    badgeText?: string
  ) => (
    <div
      style={{
        background: '#001e2b',
        color: '#ffffff',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0, 30, 43, 0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: -40,
          width: 180,
          height: 180,
          background: 'radial-gradient(circle, rgba(0, 237, 100, 0.12) 0%, rgba(0, 30, 43, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                background: tagColor,
                color: tagColor === '#00ed64' ? '#001e2b' : '#ffffff',
                font: '700 10px "DM Mono", monospace',
                padding: '3px 8px',
                borderRadius: 4,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {tagLabel}
            </span>
            {badgeText && (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#c3f0d2',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  fontFamily: 'DM Mono',
                }}
              >
                {badgeText}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#a8b3bc' }}>
              RFCTLARR Act 2013 Statutory Compliance
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.5px' }}>
            {title}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#c1ccd6', maxWidth: 780, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => onSelectCategory('dashboard')}
            style={{
              background: 'transparent',
              border: '1px solid #3d4f5b',
              color: '#ffffff',
              borderRadius: 9999,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            ← Command Centre
          </button>
          {can('transition_projects') && (
            <button
              onClick={onOpenGateReview}
              style={{
                background: '#00ed64',
                color: '#001e2b',
                border: 'none',
                borderRadius: 9999,
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Review Statutory Gate ➔
            </button>
          )}
        </div>
      </div>
    </div>
  )

  // =========================================================================
  // STATUTORY SEGREGATION OF DUTIES (SOD) RESTRICTION CHECK (§21 & §25)
  // =========================================================================
  if (!isCategoryAllowedForRole(activePersona.id, activeCategory)) {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          `${activeCategory.replace(/-/g, ' ').toUpperCase()} — Access Restricted`,
          getCategoryRestrictionReason(activePersona.id, activeCategory),
          'STATUTORY RESTRICTION',
          '#fa6e39',
          `Restricted for ${activePersona.title}`
        )}

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: '#001e2b' }}>
                Role Segregation of Duties: {activePersona.title}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5c6c7a' }}>
                Governed by SIH26016 Master Reference Specification (§21 Panel Plan & §25 Role Definitions)
              </p>
            </div>
          </div>

          <div style={{ background: '#fff8e0', border: '1px solid #fef3c7', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <strong style={{ color: '#946f3f', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Statutory Reason for Restriction
            </strong>
            <p style={{ color: '#78350f', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {getCategoryRestrictionReason(activePersona.id, activeCategory)}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => onSelectCategory('dashboard')}
              style={{
                background: '#001e2b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Return to Authorized Command Centre
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 1: PROJECTS PORTFOLIO REGISTER
  // =========================================================================
  if (activeCategory === 'projects') {
    const filteredProjects = projects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.location.toLowerCase().includes(projectSearch.toLowerCase())
      const matchSector = projectSectorFilter === 'ALL' || (p.sector ? p.sector.toUpperCase() === projectSectorFilter : true)
      return matchSearch && matchSector
    })

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Land Acquisition Projects Portfolio',
          'Authoritative statutory register of all compulsory acquisition, land pooling, and direct purchase corridors across central and state authorities.',
          'PORTFOLIO REGISTER',
          '#00ed64',
          `${projects.length} Corridors Active`
        )}

        {/* Top Metric Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ font: '600 11px "DM Mono"', color: '#5c6c7a', letterSpacing: '0.05em' }}>TOTAL SANCTIONED BUDGET</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹24,800 Cr</div>
            <span style={{ fontSize: 11, color: '#00a35c', fontWeight: 600 }}>● 100% Escrow Backed</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ font: '600 11px "DM Mono"', color: '#5c6c7a', letterSpacing: '0.05em' }}>SURVEYED PARCELS</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>4,820 Parcels</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>3,650 Acquired (75.7%)</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ font: '600 11px "DM Mono"', color: '#5c6c7a', letterSpacing: '0.05em' }}>STATUTORY COMPLIANCE</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#00b545', marginTop: 4 }}>0 Breaches</div>
            <span style={{ fontSize: 11, color: '#00a35c' }}>All projects within Sec 19/25 limits</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: '16px 20px' }}>
            <span style={{ font: '600 11px "DM Mono"', color: '#5c6c7a', letterSpacing: '0.05em' }}>COMPENSATION TENDERED</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹8,450 Cr</div>
            <span style={{ fontSize: 11, color: '#3d4f9f', fontWeight: 600 }}>PFMS Direct Benefit Transfer</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search corridor, state, district, or code..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              style={{
                width: 280,
                height: 38,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #c1ccd6',
                fontSize: 13,
                outline: 'none',
              }}
            />
            {['ALL', 'HIGHWAY', 'RAILWAY', 'ENERGY', 'URBAN'].map((sector) => (
              <button
                key={sector}
                onClick={() => setProjectSectorFilter(sector)}
                style={{
                  background: projectSectorFilter === sector ? '#001e2b' : '#f4f7f6',
                  color: projectSectorFilter === sector ? '#ffffff' : '#3d4f5b',
                  border: '1px solid ' + (projectSectorFilter === sector ? '#001e2b' : '#e1e5e8'),
                  borderRadius: 9999,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {sector}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#5c6c7a' }}>
            Showing <strong>{filteredProjects.length}</strong> of {projects.length} Projects
          </span>
        </div>

        {/* Projects Data Table */}
        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,30,43,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f4f7f6', borderBottom: '1px solid #e1e5e8', color: '#1c2d38', font: '600 11px "DM Mono", monospace' }}>
                <th style={{ padding: '12px 16px' }}>CODE & SECTOR</th>
                <th style={{ padding: '12px 16px' }}>PROJECT CORRIDOR NAME</th>
                <th style={{ padding: '12px 16px' }}>STATE & JURISDICTION</th>
                <th style={{ padding: '12px 16px' }}>STATUTORY ACT</th>
                <th style={{ padding: '12px 16px' }}>PARCELS / PROGRESS</th>
                <th style={{ padding: '12px 16px' }}>SANCTIONED BUDGET</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((proj) => {
                const isSelected = selected.id === proj.id
                const pct = Math.round((proj.acquired / proj.parcels) * 100)
                return (
                  <tr
                    key={proj.id}
                    style={{
                      borderBottom: '1px solid #eceff1',
                      background: isSelected ? '#f0fdf4' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'DM Mono', fontWeight: 600 }}>
                      <span style={{ color: '#00684a' }}>{proj.code}</span>
                      <div style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase' }}>{proj.sector || 'CORRIDOR'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#001e2b', fontSize: 14 }}>{proj.name}</strong>
                      <div style={{ fontSize: 12, color: '#5c6c7a' }}>Authority: {proj.owner}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#1c2d38' }}>
                      {proj.location}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: '#e3fcef',
                          color: '#00684a',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {proj.acts_applicable || 'RFCTLARR 2013'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>{proj.acquired} / {proj.parcels}</span>
                        <strong>{pct}%</strong>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#e1e5e8', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? '#00b545' : '#fa6e39' }} />
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#001e2b' }}>
                      {proj.amount}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: proj.status === 'On track' ? '#c3f0d2' : proj.status === 'Attention' ? '#fff8e0' : '#fee2e2',
                          color: proj.status === 'On track' ? '#00684a' : proj.status === 'Attention' ? '#946f3f' : '#991b1b',
                        }}
                      >
                        ● {proj.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          onSelectProject(proj)
                          onSelectCategory('dashboard')
                          showToast(`Selected project: ${proj.name}`)
                        }}
                        style={{
                          background: isSelected ? '#00684a' : '#001e2b',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 9999,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? 'Active Desk ✓' : 'Open Desk ➔'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 2: MY PENDING ACTIONS / STATUTORY TASK QUEUE
  // =========================================================================
  if (activeCategory === 'my-tasks') {
    const tasksList = meTasks.length > 0 ? meTasks : myTasks

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Statutory Action & Decision Queue',
          `Authorized actions and pending statutory compliance decisions awaiting sign-off by ${activePersona.title} (${activePersona.employeeId || 'EMP001'}).`,
          'TASK QUEUE',
          '#fa6e39',
          `${tasksList.length} Decisions Pending`
        )}

        {/* Task Cards Grid */}
        <div style={{ display: 'grid', gap: 14 }}>
          {tasksList.map((task: any, idx: number) => {
            const isOverdue = task.is_overdue
            const daysRemaining = task.days_remaining ?? 14
            return (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: isOverdue ? '1px solid #fca5a5' : '1px solid #e1e5e8',
                  borderRadius: 12,
                  padding: '18px 22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0,30,43,0.04)',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span
                      style={{
                        background: isOverdue ? '#fee2e2' : '#e3fcef',
                        color: isOverdue ? '#991b1b' : '#00684a',
                        font: '700 10px "DM Mono"',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {task.stage || 'STATUTORY GATE'}
                    </span>
                    <span style={{ fontSize: 11, color: isOverdue ? '#dc2626' : '#5c6c7a', fontWeight: 600 }}>
                      ⏱ {isOverdue ? 'CRITICAL BREACH' : `${daysRemaining} Days SLA Remaining`}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#001e2b' }}>
                    {task.project_name || selected.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#5c6c7a' }}>
                    <strong>Action Required:</strong> Review mandatory statutory clearings, verify DILRMP Jamabandi records, and issue Digital Signature Certificate (DSC) speaking order.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      const matched = projects.find((p) => p.id === task.project_id)
                      if (matched) onSelectProject(matched)
                      onOpenGateReview()
                    }}
                    style={{
                      background: '#00ed64',
                      color: '#001e2b',
                      border: 'none',
                      borderRadius: 9999,
                      padding: '8px 20px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Execute Sign-off (DSC) ➔
                  </button>
                  <button
                    onClick={() => {
                      const matched = projects.find((p) => p.id === task.project_id)
                      if (matched) onSelectProject(matched)
                      onSelectCategory('dashboard')
                    }}
                    style={{
                      background: '#f4f7f6',
                      color: '#3d4f5b',
                      border: '1px solid #c1ccd6',
                      borderRadius: 9999,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Inspect Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 3: CADASTRAL LAND & PARCELS EXPLORER / GIS MAP
  // =========================================================================
  if (activeCategory === 'parcels' || activeCategory === 'gis-map') {
    const activeParcel = cadastralParcels.find((p) => p.id === selectedParcelId) || cadastralParcels[0]

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Cadastral Land & Spatial GIS Explorer',
          'Interactive GIS spatial boundary layer integrated with State DILRMP (Bhoomi / Bhulekh) and Unique Land Parcel Identification Number (ULPIN).',
          'CADASTRAL GIS',
          '#3d4f9f',
          `${cadastralParcels.length} Parcels Synchronized`
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'start' }}>
          {/* Left Column: Spatial GIS Map Canvas */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 15, color: '#001e2b' }}>Cadastral Boundary Map Layer</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, background: '#e3fcef', color: '#00684a', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                  DGPS Drone Survey Active
                </span>
                <span style={{ fontSize: 11, background: '#f4f7f6', color: '#5c6c7a', padding: '3px 8px', borderRadius: 4 }}>
                  CRS: EPSG:4326
                </span>
              </div>
            </div>

            {/* SVG Interactive Map */}
            <div
              style={{
                width: '100%',
                height: 360,
                background: '#0d281e',
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 500 360">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="500" height="360" fill="#0d281e" />
                <rect width="500" height="360" fill="url(#grid)" />

                {/* Alignment Corridor Buffer */}
                <path
                  d="M 20 180 Q 250 80 480 200"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="48"
                  strokeOpacity="0.15"
                  strokeLinecap="round"
                />
                {/* Highway Centerline */}
                <path
                  d="M 20 180 Q 250 80 480 200"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeDasharray="6,4"
                />

                {/* Parcel 1042 */}
                <polygon
                  points="60,120 170,90 190,170 80,200"
                  fill={selectedParcelId === 'PARCEL-1042' ? 'rgba(0, 237, 100, 0.4)' : 'rgba(0, 237, 100, 0.15)'}
                  stroke="#00ed64"
                  strokeWidth={selectedParcelId === 'PARCEL-1042' ? '3' : '1.5'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedParcelId('PARCEL-1042')}
                />
                <text x="110" y="150" fill="#ffffff" fontSize="11" fontFamily="DM Mono" fontWeight="bold">
                  #1042 (1.25 ha)
                </text>

                {/* Parcel 1043 */}
                <polygon
                  points="180,88 310,70 330,150 200,168"
                  fill={selectedParcelId === 'PARCEL-1043' ? 'rgba(250, 110, 57, 0.4)' : 'rgba(250, 110, 57, 0.18)'}
                  stroke="#fa6e39"
                  strokeWidth={selectedParcelId === 'PARCEL-1043' ? '3' : '1.5'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedParcelId('PARCEL-1043')}
                />
                <text x="230" y="120" fill="#ffffff" fontSize="11" fontFamily="DM Mono" fontWeight="bold">
                  #1043 (2.10 ha)
                </text>

                {/* Parcel 1044 */}
                <polygon
                  points="320,68 440,80 450,160 340,148"
                  fill={selectedParcelId === 'PARCEL-1044' ? 'rgba(123, 63, 242, 0.4)' : 'rgba(123, 63, 242, 0.18)'}
                  stroke="#7b3ff2"
                  strokeWidth={selectedParcelId === 'PARCEL-1044' ? '3' : '1.5'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedParcelId('PARCEL-1044')}
                />
                <text x="360" y="120" fill="#ffffff" fontSize="11" fontFamily="DM Mono" fontWeight="bold">
                  #1044 (0.85 ha)
                </text>
              </svg>

              <div style={{ position: 'absolute', bottom: 12, left: 14, background: 'rgba(0,30,43,0.85)', padding: '6px 12px', borderRadius: 6, fontSize: 11, color: '#c1ccd6' }}>
                Click a parcel polygon to inspect ownership & valuation
              </div>
            </div>

            {/* Parcel Selection List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
              {cadastralParcels.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedParcelId(p.id)}
                  style={{
                    background: selectedParcelId === p.id ? '#001e2b' : '#f4f7f6',
                    color: selectedParcelId === p.id ? '#00ed64' : '#1c2d38',
                    border: '1px solid ' + (selectedParcelId === p.id ? '#001e2b' : '#e1e5e8'),
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontFamily: 'DM Mono' }}>{p.survey}</div>
                  <div style={{ fontSize: 10, color: selectedParcelId === p.id ? '#a7f3d0' : '#5c6c7a' }}>{p.areaHa} ha</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Parcel Detail Inspector Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ font: '700 11px "DM Mono"', color: '#00684a', letterSpacing: '0.05em' }}>
                PARCEL RECORD INSPECTOR
              </span>
              <span
                style={{
                  background: activeParcel.status === 'Verified' ? '#c3f0d2' : '#fff8e0',
                  color: activeParcel.status === 'Verified' ? '#00684a' : '#946f3f',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                ● {activeParcel.status}
              </span>
            </div>

            <h3 style={{ margin: '0 0 2px', fontSize: 20, color: '#001e2b' }}>
              Survey #{activeParcel.survey}
            </h3>
            <div style={{ font: '11px "DM Mono"', color: '#5c6c7a', marginBottom: 14 }}>
              ULPIN: <strong>{activeParcel.ulpin}</strong>
            </div>

            <div style={{ display: 'grid', gap: 10, fontSize: 13, borderTop: '1px solid #eceff1', paddingTop: 12 }}>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 12 }}>Recorded Owner:</span>
                <div style={{ fontWeight: 600, color: '#001e2b' }}>{activeParcel.owner}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <span style={{ color: '#5c6c7a', fontSize: 12 }}>Land Area:</span>
                  <div style={{ fontWeight: 600 }}>{activeParcel.areaHa} ha ({activeParcel.areaBigha} Bigha)</div>
                </div>
                <div>
                  <span style={{ color: '#5c6c7a', fontSize: 12 }}>Soil Classification:</span>
                  <div style={{ fontWeight: 600 }}>{activeParcel.soil}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <span style={{ color: '#5c6c7a', fontSize: 12 }}>Assessed Market Value:</span>
                  <div style={{ fontWeight: 600, color: '#001e2b' }}>{activeParcel.grossAward}</div>
                </div>
                <div>
                  <span style={{ color: '#5c6c7a', fontSize: 12 }}>100% Solatium (Sec 30):</span>
                  <div style={{ fontWeight: 600, color: '#00684a' }}>{activeParcel.solatium}</div>
                </div>
              </div>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 12 }}>PFMS DBT Status:</span>
                <div style={{ fontWeight: 600, color: activeParcel.dbtStatus === 'Disbursed' ? '#00b545' : '#d97706' }}>
                  {activeParcel.dbtStatus} ({activeParcel.utr})
                </div>
              </div>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 12 }}>Title Encumbrances / Court Orders:</span>
                <div style={{ fontWeight: 600, color: activeParcel.encumbrance.includes('Pending') ? '#dc2626' : '#00684a' }}>
                  {activeParcel.encumbrance}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setDilrmpSurvey(activeParcel.survey)
                  onSelectCategory('dilrmp')
                  onDilrmpLookup()
                }}
                style={{
                  flex: 1,
                  background: '#001e2b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sync with State DILRMP ➔
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 4: DILRMP DIGITAL LAND RECORDS GATEWAY
  // =========================================================================
  if (activeCategory === 'dilrmp') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Digital India Land Records Modernization Programme (DILRMP)',
          'Real-time automated interoperability adapter connecting NLAMS with State RoR & Cadastral GIS portals (Bhoomi, Bhulekh, AnyRoR, Jamabandi).',
          'DILRMP ADAPTER',
          '#00b545',
          'All 5 State APIs Online'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Query Console */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              Query Land Record from State RoR
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Target State Portal</label>
                <select style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}>
                  <option>Rajasthan (Apna Khata / E-Dharti DILRMP)</option>
                  <option>Uttar Pradesh (Bhulekh UP Portal)</option>
                  <option>Karnataka (Bhoomi Land Records)</option>
                  <option>Gujarat (AnyRoR Gateway)</option>
                  <option>Andhra Pradesh (Meebhoomi)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Survey / Khasra Number</label>
                <input
                  type="text"
                  value={dilrmpSurvey}
                  onChange={(e) => setDilrmpSurvey(e.target.value)}
                  placeholder="e.g. BH-48-1042"
                  style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                />
              </div>
              <button
                onClick={onDilrmpLookup}
                disabled={dilrmpLoading}
                style={{
                  background: '#00ed64',
                  color: '#001e2b',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: 6,
                }}
              >
                {dilrmpLoading ? 'Connecting to State DILRMP...' : 'Fetch Live Land Record (RoR) ➔'}
              </button>
            </div>
          </div>

          {/* Result Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              State RoR Synchronized Verification
            </h3>
            {dilrmpResult ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ font: '700 11px "DM Mono"', color: '#166534' }}>DILRMP CERTIFICATE VERIFIED</span>
                  <span style={{ fontSize: 11, color: '#00b545', fontWeight: 600 }}>● Active State Feed</span>
                </div>
                <div style={{ display: 'grid', gap: 8, color: '#14532d' }}>
                  <div><strong>Survey / Khasra:</strong> {dilrmpResult.survey_number}</div>
                  <div><strong>Registered Title Owner:</strong> {dilrmpResult.owner_name}</div>
                  <div><strong>Total Area:</strong> {dilrmpResult.area_hectares} Hectares</div>
                  <div><strong>Soil Classification:</strong> {dilrmpResult.soil_class || 'Irrigated Double Crop (Chahi-1)'}</div>
                  <div><strong>Circle Rate Valuation:</strong> ₹{((dilrmpResult.area_hectares || 1.25) * 4200000).toLocaleString('en-IN')}</div>
                  <div><strong>Encumbrance Register:</strong> Nil · No Mortgages or Liens Found</div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#5c6c7a', fontSize: 13, padding: 30, textAlign: 'center' }}>
                Enter survey number and click "Fetch Live Land Record" to sync with State Jamabandi.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 5: SECTION 15 OBJECTIONS & HEARINGS REGISTRY
  // =========================================================================
  if (activeCategory === 'objections') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 15 Objections & Personal Hearings',
          'Statutory administration of landowner claims under RFCTLARR Act 2013 Section 15(1) (60-day window) and Section 15(2) personal hearing disposals.',
          'CITIZEN OBJECTIONS',
          '#fa6e39',
          `${objectionsData.length} Active Petitions`
        )}

        {/* Action / File Objection Form */}
        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#001e2b' }}>
            Record New Section 15 Objection Petition
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#5c6c7a' }}>Landowner Name</label>
              <input
                type="text"
                value={newObjectionName}
                onChange={(e) => setNewObjectionName(e.target.value)}
                placeholder="e.g. Ramesh Chandra"
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #c1ccd6', fontSize: 12, marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#5c6c7a' }}>Survey / Khasra Number</label>
              <input
                type="text"
                value={newObjectionSurvey}
                onChange={(e) => setNewObjectionSurvey(e.target.value)}
                placeholder="BH-48-1042"
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #c1ccd6', fontSize: 12, marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#5c6c7a' }}>Ground of Objection</label>
              <select
                value={newObjectionGround}
                onChange={(e) => setNewObjectionGround(e.target.value)}
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #c1ccd6', fontSize: 12, marginTop: 4 }}
              >
                <option>Inadequate Market Valuation (Sec 26)</option>
                <option>Corridor Alignment Bisects Farm/Tubewell</option>
                <option>Exclusion of Affected Family from R&R Scheme</option>
                <option>Joint Ownership & Apportionment Dispute (Sec 29)</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (!newObjectionName.trim()) {
                  showToast('Please enter landowner name')
                  return
                }
                showToast(`Section 15 Objection filed for ${newObjectionName}! Case ticket generated.`)
                setNewObjectionName('')
              }}
              style={{
                background: '#001e2b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '0 20px',
                height: 36,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + File Petition
            </button>
          </div>
        </div>

        {/* Objections List */}
        <div style={{ display: 'grid', gap: 14 }}>
          {objectionsData.map((obj) => (
            <div
              key={obj.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e1e5e8',
                borderRadius: 12,
                padding: '18px 22px',
                boxShadow: '0 2px 8px rgba(0,30,43,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ font: '700 11px "DM Mono"', background: '#001e2b', color: '#ffffff', padding: '2px 8px', borderRadius: 4 }}>
                    {obj.id}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#001e2b' }}>
                    Survey #{obj.survey} · {obj.petitioner}
                  </span>
                </div>
                <span
                  style={{
                    background: obj.tagColor === '#00b545' ? '#c3f0d2' : '#fff8e0',
                    color: obj.tagColor === '#00b545' ? '#00684a' : '#946f3f',
                    padding: '3px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  ● {obj.status}
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#1c2d38', lineHeight: 1.4 }}>
                <strong>Ground:</strong> {obj.ground} — {obj.detail}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#5c6c7a', borderTop: '1px dashed #e1e5e8', paddingTop: 8 }}>
                <span>Filing Date: <strong>{obj.dateFiled}</strong> · Hearing Date: <strong>{obj.hearingDate}</strong></span>
                <span>Presiding Authority: <strong>{obj.officer}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 6: STATUTORY COMPENSATION AWARD & SOLATIUM ENGINE (SEC 21-30)
  // =========================================================================
  if (activeCategory === 'awards' || activeCategory === 'compensation') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Compensation Award & Solatium Engine',
          'First Schedule statutory compensation computation per Sections 26 (Market Value), 29 (Assets & Trees Valuation), 30(2) (100% Solatium), and 30(3) (12% p.a. Additional Interest).',
          'COMPENSATION ENGINE',
          '#00b545',
          'Statutory First Schedule'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Interactive Calculator */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              Statutory First Schedule Award Calculator
            </h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>
                  Base Market Value (Circle Rate / Registered Deeds per Sec 26) [₹]
                </label>
                <input
                  type="number"
                  value={calcMarketValue}
                  onChange={(e) => setCalcMarketValue(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>
                    Rural Multiplier Factor (1.00x – 2.00x)
                  </label>
                  <select
                    value={calcMultiplier}
                    onChange={(e) => setCalcMultiplier(e.target.value)}
                    style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                  >
                    <option value="1.00">1.00x (Urban Zone)</option>
                    <option value="1.25">1.25x (Semi-Urban 0-10 km)</option>
                    <option value="1.50">1.50x (Rural 10-20 km)</option>
                    <option value="2.00">2.00x (Deep Rural 20+ km)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>
                    Attachment / Tree / Crop Value (Sec 29) [₹]
                  </label>
                  <input
                    type="number"
                    value={calcAssetVal}
                    onChange={(e) => setCalcAssetVal(e.target.value)}
                    style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>
                  Months elapsed from Sec 11 Notification to Award [for 12% p.a. Sec 30(3)]
                </label>
                <input
                  type="number"
                  value={calcNoticeMonths}
                  onChange={(e) => setCalcNoticeMonths(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                />
              </div>

              <div style={{ background: '#f4f7f6', borderRadius: 8, padding: 14, fontSize: 12, color: '#5c6c7a' }}>
                Note: Solatium of 100% is mandatory under Section 30(2) on total market value + attachments. Additional interest of 12% p.a. is calculated under Section 30(3).
              </div>
            </div>
          </div>

          {/* Statutory Breakdown Summary Card */}
          <div style={{ background: '#001e2b', color: '#ffffff', borderRadius: 12, padding: 24 }}>
            <span style={{ font: '700 11px "DM Mono"', color: '#00ed64', letterSpacing: '0.08em' }}>
              AWARD DECREE SUMMARY
            </span>
            <h3 style={{ margin: '4px 0 16px', fontSize: 22, color: '#ffffff' }}>
              ₹{Math.round(totalAwardPayable).toLocaleString('en-IN')}
            </h3>

            <div style={{ display: 'grid', gap: 10, fontSize: 13, borderTop: '1px solid #3d4f5b', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#c1ccd6' }}>Multiplied Land Market Value (Sec 26):</span>
                <strong>₹{Math.round(multipliedMarketValue).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#c1ccd6' }}>Assets / Structures / Trees (Sec 29):</span>
                <strong>₹{Math.round(assetVal).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00ed64' }}>
                <span>100% Statutory Solatium (Sec 30(2)):</span>
                <strong>₹{Math.round(solatium100).toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a7f3d0' }}>
                <span>12% p.a. Additional Interest (Sec 30(3)):</span>
                <strong>₹{Math.round(additionalInterest).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div style={{ marginTop: 20, borderTop: '1px solid #3d4f5b', paddingTop: 16 }}>
              <button
                onClick={() => {
                  setPfmsAmountInr(String(Math.round(totalAwardPayable)))
                  onSelectCategory('payments')
                  showToast('Calculated award transferred to PFMS DBT Terminal!')
                }}
                style={{
                  width: '100%',
                  background: '#00ed64',
                  color: '#001e2b',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '12px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Forward to PFMS DBT Terminal ➔
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 7: PFMS DIRECT BENEFIT TRANSFER (DBT) PAYMENTS
  // =========================================================================
  if (activeCategory === 'payments') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'PFMS Direct Benefit Transfer (DBT) Gateway',
          'Electronic compensation disbursement directly to verified bank accounts of affected families under Section 38 and Section 77.',
          'PFMS DBT TERMINAL',
          '#00ed64',
          'PFMS / NPCI Live Integration'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18 }}>
          {/* Trigger Console */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              Execute PFMS DBT Disbursement
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Beneficiary Identification Code</label>
                <input
                  type="text"
                  value={pfmsBeneficiary}
                  onChange={(e) => setPfmsBeneficiary(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Award Amount (INR ₹)</label>
                <input
                  type="text"
                  value={pfmsAmountInr}
                  onChange={(e) => setPfmsAmountInr(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #c1ccd6', fontSize: 13, marginTop: 4 }}
                />
              </div>
              <button
                onClick={onPfmsDisburse}
                disabled={pfmsLoading}
                style={{
                  background: '#00ed64',
                  color: '#001e2b',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '12px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: 8,
                }}
              >
                {pfmsLoading ? 'Executing PFMS Direct Transfer...' : 'Disburse via PFMS DBT ➔'}
              </button>
            </div>
          </div>

          {/* PFMS Receipts Ledger */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              Latest PFMS Disbursement Transactions
            </h3>
            {pfmsResult ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 14, fontSize: 13 }}>
                <span style={{ font: '700 11px "DM Mono"', color: '#166534' }}>LATEST TRANSACTION RECEIPT</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#14532d', margin: '4px 0' }}>
                  UTR: {pfmsResult.utr_number}
                </div>
                <div style={{ fontSize: 12, color: '#15803d' }}>
                  Amount: ₹{Number(pfmsResult.amount_inr || 0).toLocaleString('en-IN')} · Beneficiary: {pfmsResult.reference}
                </div>
              </div>
            ) : null}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f4f7f6', borderBottom: '1px solid #e1e5e8', font: '600 10px "DM Mono"' }}>
                  <th style={{ padding: '8px 10px' }}>UTR NUMBER</th>
                  <th style={{ padding: '8px 10px' }}>BENEFICIARY</th>
                  <th style={{ padding: '8px 10px' }}>AMOUNT</th>
                  <th style={{ padding: '8px 10px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eceff1' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'DM Mono' }}>PFMS202688419201</td>
                  <td style={{ padding: '8px 10px' }}>Asha Devi (Survey #1042)</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>₹24,50,000</td>
                  <td style={{ padding: '8px 10px', color: '#00b545', fontWeight: 600 }}>SUCCESS</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eceff1' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'DM Mono' }}>PFMS202688419288</td>
                  <td style={{ padding: '8px 10px' }}>Sukhvinder Singh (Survey #1045)</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>₹1,48,50,000</td>
                  <td style={{ padding: '8px 10px', color: '#00b545', fontWeight: 600 }}>SUCCESS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 8: SECTION 38 PHYSICAL POSSESSION CONSOLE
  // =========================================================================
  if (activeCategory === 'possession') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 38 Physical Possession Enforcement',
          'Statutory pre-condition enforcement under Section 38: Physical possession is strictly prohibited until full compensation and R&R allowances have been paid or deposited under Section 77.',
          'SECTION 38 POSSESSION',
          '#00684a',
          'Gated on 100% Payment'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Statutory Verification Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              Section 38 Pre-Condition Gate Status
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <span style={{ color: '#00b545', fontSize: 18, fontWeight: 700 }}>✓</span>
                <div>
                  <strong style={{ fontSize: 13, color: '#166534' }}>Full Compensation Paid or Tendered</strong>
                  <div style={{ fontSize: 11, color: '#15803d' }}>PFMS DBT UTR verified for 100% entitled owners</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <span style={{ color: '#00b545', fontSize: 18, fontWeight: 700 }}>✓</span>
                <div>
                  <strong style={{ fontSize: 13, color: '#166534' }}>Second Schedule Monetary R&R Settled</strong>
                  <div style={{ fontSize: 11, color: '#15803d' }}>Subsistence & transportation grants disbursed</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <span style={{ color: '#00b545', fontSize: 18, fontWeight: 700 }}>✓</span>
                <div>
                  <strong style={{ fontSize: 13, color: '#166534' }}>Judicial Stay Clearance Certified</strong>
                  <div style={{ fontSize: 11, color: '#15803d' }}>High Court / Supreme Court stay search: CLEAR</div>
                </div>
              </div>
            </div>
          </div>

          {/* Panchnama & Handover Execution */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
              Execute Possession Memo & Panchnama
            </h3>
            <p style={{ fontSize: 13, color: '#5c6c7a', lineHeight: 1.4, margin: '0 0 14px' }}>
              Execution of physical possession panchnama in presence of 5 independent panch witnesses, Executive Magistrate, and Requiring Body representatives.
            </p>
            <button
              onClick={() => {
                showToast('Section 38 Possession Panchnama & Handover Certificate executed with DSC token!')
              }}
              style={{
                width: '100%',
                background: '#001e2b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '12px 0',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign Panchnama & Handover Certificate (DSC) ➔
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 9: CITIZEN VIEWS (MY LAND, NOTICES, COMPENSATION, PAYMENTS)
  // =========================================================================
  if (['my-land', 'my-notices', 'my-compensation', 'my-payments', 'grievances', 'my-objections'].includes(activeCategory)) {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Citizen Landowner Transparency Portal',
          'Self-service transparency desk for affected landholders under RFCTLARR Act 2013: Inspect survey records, download gazette notices, track compensation, and monitor PFMS bank disbursements.',
          'CITIZEN PORTAL',
          '#00ed64',
          'Landowner: Asha Devi (Survey #1042)'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Card 1: My Land Record */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 15, color: '#001e2b' }}>My Land Holding</strong>
              <span style={{ fontSize: 11, background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                DILRMP Verified
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#1c2d38', display: 'grid', gap: 6 }}>
              <div><strong>Survey / Khasra:</strong> BH-48-1042</div>
              <div><strong>ULPIN:</strong> 14081042-2026-RAJ</div>
              <div><strong>Acquired Area:</strong> 1.25 Hectares (100% of plot)</div>
              <div><strong>RoR Jamabandi:</strong> Khewat #14 / Khatauni #82</div>
            </div>
          </div>

          {/* Card 2: Compensation Breakdown */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <strong style={{ fontSize: 15, color: '#001e2b', display: 'block', marginBottom: 10 }}>
              My Compensation Award
            </strong>
            <div style={{ fontSize: 13, color: '#1c2d38', display: 'grid', gap: 6 }}>
              <div><strong>Base Land Value:</strong> ₹52,50,000</div>
              <div><strong>100% Solatium (Sec 30):</strong> ₹52,50,000</div>
              <div><strong>12% Interest (Sec 30(3)):</strong> ₹13,12,500</div>
              <div style={{ borderTop: '1px solid #eceff1', paddingTop: 6, fontWeight: 700, color: '#00684a' }}>
                Total Award: ₹1,18,12,500
              </div>
            </div>
          </div>

          {/* Card 3: Bank Direct Credit (DBT) */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 15, color: '#001e2b' }}>PFMS Direct Bank Credit</strong>
              <span style={{ fontSize: 11, background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                CREDITED ✓
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#1c2d38', display: 'grid', gap: 6 }}>
              <div><strong>Bank Account:</strong> State Bank of India (Ending ...4092)</div>
              <div><strong>PFMS UTR:</strong> PFMS202688419201</div>
              <div><strong>Disbursement Date:</strong> 2026-08-28</div>
              <div><strong>Disbursement Mode:</strong> Direct Benefit Transfer (DBT)</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 10: CRYPTOGRAPHIC AUDIT LEDGER (AUDIT)
  // =========================================================================
  if (activeCategory === 'audit') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'SHA-256 Tamper-Evident Cryptographic Audit Chain',
          'Cryptographically chained, immutable audit ledger securing every statutory stage transition, valuation approval, PFMS disbursement, and possession memo.',
          'AUDIT CHAIN',
          '#00ed64',
          `${auditEntries.length || 6} Blocks Chained`
        )}

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ font: '700 11px "DM Mono"', color: '#00684a' }}>MERKLE ROOT & CHAIN INTEGRITY: 100% VERIFIED</span>
            <button
              onClick={() => showToast('Audit certificate exported with SHA-256 digital signature!')}
              style={{
                background: '#001e2b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Export Audit Certificate ➔
            </button>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {(auditEntries.length > 0
              ? auditEntries
              : [
                  {
                    action: 'POSSESSION_MEMO_EXECUTED',
                    user_id: 'EMP001',
                    created_at: '2026-09-06T09:30:00Z',
                    entry_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                    previous_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
                  },
                  {
                    action: 'PFMS_DBT_DISBURSEMENT',
                    user_id: 'EMP006',
                    created_at: '2026-09-05T14:20:00Z',
                    entry_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
                    previous_hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
                  },
                  {
                    action: 'SECTION_23_AWARD_APPROVED',
                    user_id: 'EMP001',
                    created_at: '2026-09-04T11:15:00Z',
                    entry_hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
                    previous_hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
                  },
                ]
            ).map((entry: any, i: number) => (
              <div
                key={i}
                style={{
                  background: '#f9fbfa',
                  border: '1px solid #e1e5e8',
                  borderRadius: 8,
                  padding: '12px 16px',
                  fontFamily: 'DM Mono',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ color: '#001e2b' }}>{entry.action}</strong>
                  <span style={{ color: '#5c6c7a', fontSize: 11 }}>{entry.created_at}</span>
                </div>
                <div style={{ color: '#00684a', fontSize: 11, wordBreak: 'break-all' }}>
                  HASH: {entry.entry_hash || 'SHA256:0x8849...'}
                </div>
                <div style={{ color: '#7c8c9a', fontSize: 10, wordBreak: 'break-all' }}>
                  PREV: {entry.previous_hash || 'GENESIS'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 11: WORKFLOW REGIMES (04)
  // =========================================================================
  if (activeCategory === 'workflow-regimes') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Statutory Workflow Regimes & Branching Engine',
          'Autonomous multi-regime land acquisition engine orchestrating 4 distinct statutory frameworks under Master Reference Specification Part II & Part V.',
          'WORKFLOW REGIMES',
          '#00ed64',
          '4 Regimes Standardized'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            {
              code: 'RFCTLARR_2013',
              name: 'RFCTLARR Act, 2013',
              authority: 'District Collector / Competent Authority',
              stages: 13,
              citation: 'Right to Fair Compensation & Transparency Act, 2013',
              solatium: '100% Solatium Mandatory',
              tagColor: '#00ed64',
            },
            {
              code: 'NH_ACT_1956',
              name: 'National Highways Act, 1956',
              authority: 'CALA (Competent Authority Land Acquisition)',
              stages: 10,
              citation: 'Sections 3A, 3D, 3G, 3H of National Highways Act, 1956',
              solatium: 'RFCTLARR First Schedule Solatium applicable',
              tagColor: '#fa6e39',
            },
            {
              code: 'METRO_ACT_1978',
              name: 'Metro Railways Act, 1978',
              authority: 'Metro Railway Administration / State Govt',
              stages: 8,
              citation: 'Metro Railways (Construction of Works) Act, 1978',
              solatium: 'Fast-Track Urban Transit Corridor',
              tagColor: '#7b3ff2',
            },
            {
              code: 'ELECTRICITY_2003',
              name: 'Electricity Act, 2003 & Telegraph Act',
              authority: 'Power Grid / Transmission Authority',
              stages: 6,
              citation: 'Tower Base Area Acquisition & RoW Compensation',
              solatium: '85% Land Value for Tower Base + 15% Diminution',
              tagColor: '#3d4f9f',
            },
          ].map((reg) => (
            <div
              key={reg.code}
              style={{
                background: '#ffffff',
                border: '1px solid #e1e5e8',
                borderRadius: 12,
                padding: 22,
                boxShadow: '0 2px 8px rgba(0,30,43,0.04)',
              }}
            >
              <span
                style={{
                  background: reg.tagColor,
                  color: reg.tagColor === '#00ed64' ? '#001e2b' : '#ffffff',
                  font: '700 10px "DM Mono"',
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                {reg.code}
              </span>
              <h3 style={{ margin: '8px 0 4px', fontSize: 17, color: '#001e2b' }}>
                {reg.name}
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5c6c7a' }}>
                {reg.citation}
              </p>
              <div style={{ fontSize: 12, color: '#1c2d38', display: 'grid', gap: 4, borderTop: '1px solid #eceff1', paddingTop: 10 }}>
                <div><strong>Stages:</strong> {reg.stages} Statutory Stages</div>
                <div><strong>Authority:</strong> {reg.authority}</div>
                <div><strong>Formula:</strong> {reg.solatium}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 12: SOCIAL IMPACT ASSESSMENT (SIA) CONSOLE (SEC 4 - 9)
  // =========================================================================
  if (activeCategory === 'sia') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 4-9 Social Impact Assessment (SIA) & SIMP Desk',
          'Autonomous governance of statutory SIA study, mandatory Public Hearings (Sec 5), independent Expert Group appraisal (Sec 7), and Social Impact Management Plan (SIMP) publication.',
          'SIA / SIMP DESK',
          '#7b3ff2',
          'Statutory Limit: 6 Months'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#7b3ff2', textTransform: 'uppercase' }}>Affected Families (Surveyed)</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>142 Families</div>
            <span style={{ fontSize: 11, color: '#00a35c' }}>100% census survey completed</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#fa6e39', textTransform: 'uppercase' }}>Public Hearings (Sec 5)</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>3 Scheduled</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>2 Gram Sabhas completed · 1 pending</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00684a', textTransform: 'uppercase' }}>Expert Group Appraisal</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>Approved</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Sec 7 recommendations published</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#3d4f9f', textTransform: 'uppercase' }}>SIMP Mitigation Fund</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹4.82 Cr</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>Livelihood & community assets</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#001e2b' }}>
              Public Hearings & Village Consultations Register
            </h3>
            <button
              onClick={() => showToast('New Section 5 Public Hearing notice issued to Panchayats')}
              style={{
                background: '#00ed64',
                color: '#001e2b',
                border: 'none',
                borderRadius: 9999,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Schedule Public Hearing
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fbfa', borderBottom: '1px solid #e1e5e8', color: '#5c6c7a', fontSize: 11 }}>
                <th style={{ padding: '10px 12px' }}>VILLAGE / PANCHAYAT</th>
                <th style={{ padding: '10px 12px' }}>HEARING DATE</th>
                <th style={{ padding: '10px 12px' }}>ATTENDANCE</th>
                <th style={{ padding: '10px 12px' }}>AUDIO/VIDEO RECORDING</th>
                <th style={{ padding: '10px 12px' }}>RESOLUTION STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Bharatpur Gram Sabha</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>2026-07-14 (11:00 AM)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>186 villagers (82 women)</td>
                <td style={{ padding: '12px', color: '#00684a', font: '600 12px "DM Mono"' }}>ARCHIVED (SHA256:0x39a1)</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>PASSED WITH MODIFICATIONS</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Kishanpur Panchayat</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>2026-07-18 (02:00 PM)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>144 villagers (65 women)</td>
                <td style={{ padding: '12px', color: '#00684a', font: '600 12px "DM Mono"' }}>ARCHIVED (SHA256:0x7b88)</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>PASSED (UNANIMOUS)</span></td>
              </tr>
              <tr>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Surajgarh Hamlet</td>
                <td style={{ padding: '12px', color: '#fa6e39', fontWeight: 600 }}>2026-09-12 (10:30 AM)</td>
                <td style={{ padding: '12px', color: '#5c6c7a' }}>Expected: 90 landholders</td>
                <td style={{ padding: '12px', color: '#5c6c7a' }}>Camera Unit 03 Assigned</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#fff8e0', color: '#946f3f', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>SCHEDULED</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 13: REHABILITATION & RESETTLEMENT (R&R) DESK (SEC 31 - 42)
  // =========================================================================
  if (activeCategory === 'rr') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 31-42 Rehabilitation & Resettlement (R&R) Desk',
          'Second Schedule mandatory entitlements enforcement: Alternative dwelling units, one-time resettlement allowances, subsistence grants, and 25 statutory infrastructure amenities under Third Schedule.',
          'SECOND SCHEDULE R&R',
          '#fa6e39',
          'Mandatory Before Possession'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#fa6e39', textTransform: 'uppercase' }}>Displaced Families</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>38 Families</div>
            <span style={{ fontSize: 11, color: '#00a35c' }}>All eligible for 50 sq.m housing</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00684a', textTransform: 'uppercase' }}>Subsistence Grants (Sec 31)</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹36,000 / fam</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>₹3,000/month for 12 months</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#7b3ff2', textTransform: 'uppercase' }}>Resettlement Allowance</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹50,000 / fam</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>One-time shifting assistance</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#3d4f9f', textTransform: 'uppercase' }}>Third Schedule Amenities</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>25 of 25</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Water, roads, health, power verified</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#001e2b' }}>
            R&R Scheme Allotment & Second Schedule Entitlement Ledger
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fbfa', borderBottom: '1px solid #e1e5e8', color: '#5c6c7a', fontSize: 11 }}>
                <th style={{ padding: '10px 12px' }}>BENEFICIARY FAMILY HEAD</th>
                <th style={{ padding: '10px 12px' }}>HOUSING ALLOTMENT</th>
                <th style={{ padding: '10px 12px' }}>SUBSISTENCE GRANT</th>
                <th style={{ padding: '10px 12px' }}>SHIFTING ALLOWANCE</th>
                <th style={{ padding: '10px 12px' }}>TOTAL MONETARY R&R</th>
                <th style={{ padding: '10px 12px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Ram Lal (s/o Suraj Mal)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Plot #14, Model Colony, Sec 4</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>₹36,000 (PFMS DBT)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>₹50,000 (PFMS DBT)</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#00684a' }}>₹86,000</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>DISBURSED ✓</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Dinesh Kumar (s/o Hira Lal)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Plot #15, Model Colony, Sec 4</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>₹36,000 (PFMS DBT)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>₹50,000 (PFMS DBT)</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#00684a' }}>₹86,000</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>DISBURSED ✓</span></td>
              </tr>
              <tr>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Kailash Chand (s/o Moti Ram)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Plot #16, Model Colony, Sec 4</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>₹36,000 (PFMS DBT)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>₹50,000 (PFMS DBT)</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#00684a' }}>₹86,000</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#fff8e0', color: '#946f3f', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>PENDING ESCROW</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 14: SECTION 77 JUDICIAL DEPOSITS & LARR AUTHORITY DESK
  // =========================================================================
  if (activeCategory === 'deposits') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 77 Judicial Deposits & LARR Authority Escrow',
          'Statutory deposit of compensation into the Land Acquisition, Rehabilitation and Resettlement Authority (Sec 64/77) where title is disputed, beneficiaries refuse tender, or judicial stay is active.',
          'SECTION 77 DEPOSITS',
          '#3d4f9f',
          'Statutory Interest: 9% -> 15% p.a.'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#3d4f9f', textTransform: 'uppercase' }}>Total Deposited in Authority</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹8,42,10,000</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Held in High Court / Authority Escrow</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#fa6e39', textTransform: 'uppercase' }}>Cases Referred under Sec 64</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>14 Parcels</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>Title disputes & partition suits</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00684a', textTransform: 'uppercase' }}>Possession Clearance Granted</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>Sec 77(2) Clear</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Deposit satisfies Section 38 pre-condition</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#001e2b' }}>
              Authority Escrow Ledger (LARR Authority Reference Registry)
            </h3>
            <button
              onClick={() => showToast('New Section 77 Judicial Deposit order initiated')}
              style={{
                background: '#001e2b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Create Authority Deposit
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fbfa', borderBottom: '1px solid #e1e5e8', color: '#5c6c7a', fontSize: 11 }}>
                <th style={{ padding: '10px 12px' }}>REFERENCE NO</th>
                <th style={{ padding: '10px 12px' }}>PARCEL / SURVEY</th>
                <th style={{ padding: '10px 12px' }}>DISPUTE GROUNDS</th>
                <th style={{ padding: '10px 12px' }}>AMOUNT DEPOSITED</th>
                <th style={{ padding: '10px 12px' }}>DEPOSIT DATE</th>
                <th style={{ padding: '10px 12px' }}>AUTHORITY BENCH</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', font: '600 12px "DM Mono"', color: '#3d4f9f' }}>LARR-REF-2026-004</td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>BH-48-1092 (0.84 Ha)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Partition dispute among 4 legal heirs</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#001e2b' }}>₹78,40,000</td>
                <td style={{ padding: '12px', color: '#5c6c7a' }}>2026-07-22</td>
                <td style={{ padding: '12px', color: '#00684a', fontWeight: 600 }}>Jaipur Principal Bench</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', font: '600 12px "DM Mono"', color: '#3d4f9f' }}>LARR-REF-2026-005</td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>BH-48-1104 (1.10 Ha)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Title objection by temple endowment board</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#001e2b' }}>₹1,02,50,000</td>
                <td style={{ padding: '12px', color: '#5c6c7a' }}>2026-08-04</td>
                <td style={{ padding: '12px', color: '#00684a', fontWeight: 600 }}>Jaipur Principal Bench</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', font: '600 12px "DM Mono"', color: '#3d4f9f' }}>LARR-REF-2026-006</td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>BH-48-1118 (0.45 Ha)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Owner untraceable despite gazette notice</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#001e2b' }}>₹42,00,000</td>
                <td style={{ padding: '12px', color: '#5c6c7a' }}>2026-08-19</td>
                <td style={{ padding: '12px', color: '#00684a', fontWeight: 600 }}>Jaipur Principal Bench</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 15: LITIGATION & COURT STAYS REGISTRY
  // =========================================================================
  if (activeCategory === 'litigation') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Judicial Litigation & Stay Order Scrutiny Registry',
          'Comprehensive tracking of High Court writ petitions, District Court injunctions, caveat notices under Section 148A CPC, and compliance with statutory Section 25 limitation periods.',
          'LITIGATION REGISTRY',
          '#fa6e39',
          '0 Active Stays on Critical Path'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#fa6e39', textTransform: 'uppercase' }}>Active Writ Petitions</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>3 Writs</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>High Court of Judicature for Rajasthan</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00684a', textTransform: 'uppercase' }}>Interim Stays Granted</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#00684a', marginTop: 4 }}>0 Stays</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>All stay applications vacated / dismissed</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#7b3ff2', textTransform: 'uppercase' }}>Caveats Filed (Sec 148A)</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>12 Filed</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>State protected against ex-parte orders</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#3d4f9f', textTransform: 'uppercase' }}>Affidavits Pending</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>1 Due</div>
            <span style={{ fontSize: 11, color: '#fa6e39' }}>Reply due in 6 days</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#001e2b' }}>
            High Court Case Docket & Statutory Deadlines
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fbfa', borderBottom: '1px solid #e1e5e8', color: '#5c6c7a', fontSize: 11 }}>
                <th style={{ padding: '10px 12px' }}>CASE NUMBER</th>
                <th style={{ padding: '10px 12px' }}>PETITIONER</th>
                <th style={{ padding: '10px 12px' }}>BENCH</th>
                <th style={{ padding: '10px 12px' }}>CHALLENGE NATURE</th>
                <th style={{ padding: '10px 12px' }}>NEXT HEARING</th>
                <th style={{ padding: '10px 12px' }}>LEGAL COUNSEL ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', font: '600 12px "DM Mono"', color: '#fa6e39' }}>D.B. Civil Writ #8921/2026</td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>M/s Agritech Ltd vs State of Raj</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Division Bench II, Jaipur</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Sec 11 alignment challenge</td>
                <td style={{ padding: '12px', color: '#fa6e39', fontWeight: 600 }}>2026-09-15</td>
                <td style={{ padding: '12px' }}><button onClick={() => showToast('Counter-affidavit preview generated')} style={{ background: '#f9fbfa', border: '1px solid #c1ccd6', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>View Counter-Affidavit</button></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', font: '600 12px "DM Mono"', color: '#fa6e39' }}>S.B. Civil Writ #4412/2026</td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Gopal Das & Ors vs CALA</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Single Bench, Jodhpur</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>Valuation multiplier disputed</td>
                <td style={{ padding: '12px', color: '#5c6c7a' }}>2026-10-02</td>
                <td style={{ padding: '12px' }}><span style={{ color: '#00684a', fontWeight: 600, fontSize: 12 }}>Reply Filed ✓</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 16: ANALYTICS & STATUTORY SLA VELOCITY
  // =========================================================================
  if (activeCategory === 'analytics') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'National Land Acquisition SLA & Velocity Analytics',
          'Statutory cycle-time monitoring, Section 25 lapse avoidance telemetry, compensation velocity, and cross-district throughput across RFCTLARR 2013, NH Act 1956, and Metro Act 1978.',
          'ANALYTICS ENGINE',
          '#00a35c',
          'SLA Compliance: 94.6%'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00a35c', textTransform: 'uppercase' }}>Avg Acquisition Cycle</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>198 Days</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>54% faster than statutory max (365d)</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#7b3ff2', textTransform: 'uppercase' }}>Total Land Acquired (FY26)</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>1,482.4 Ha</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>Across 28 major corridors</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#fa6e39', textTransform: 'uppercase' }}>Capital Disbursed (PFMS DBT)</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹1,248.8 Cr</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Zero physical cheque delays</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00684a', textTransform: 'uppercase' }}>Sec 25 Lapse Prevention Rate</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#00684a', marginTop: 4 }}>100.0%</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>0 awards lapsed in 24 months</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
            Statutory Stage Velocity Benchmarks (Actual vs RFCTLARR Statutory Maximum)
          </h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { stage: 'Section 4-9 SIA & Expert Group Appraisal', actual: 74, max: 180, color: '#00ed64' },
              { stage: 'Section 11 Preliminary Notification to Sec 15 Objections', actual: 48, max: 60, color: '#00b545' },
              { stage: 'Section 19 Declaration of Acquisition', actual: 62, max: 365, color: '#7b3ff2' },
              { stage: 'Section 23/26 Award Enquiry to Final Award', actual: 114, max: 365, color: '#fa6e39' },
              { stage: 'PFMS DBT Payment to Sec 38 Possession Handover', actual: 18, max: 90, color: '#00a35c' },
            ].map((row, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <strong style={{ color: '#001e2b' }}>{row.stage}</strong>
                  <span style={{ color: '#5c6c7a', font: '600 12px "DM Mono"' }}>
                    {row.actual} Days <span style={{ color: '#a8b3bc', fontWeight: 400 }}>(Statutory Max: {row.max} Days)</span>
                  </span>
                </div>
                <div style={{ background: '#f4f7f6', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: row.color,
                      height: '100%',
                      width: `${Math.min(100, Math.round((row.actual / row.max) * 100))}%`,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 17: NATIONAL PM GATISHAKTI INFRASTRUCTURE GRID
  // =========================================================================
  if (activeCategory === 'national') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'PM GatiShakti National Infrastructure Land Grid',
          'Unified multi-modal spatial integration across 16 Central Ministries: Dedicated Freight Corridors, Bharatmala, High Speed Rail, and Green Energy Transmission networks.',
          'NATIONAL GRID',
          '#003d4f',
          'GatiShakti Live Sync'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#003d4f', textTransform: 'uppercase' }}>Central Priority Projects</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>48 Corridors</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Multi-State Coordination Cell Active</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#fa6e39', textTransform: 'uppercase' }}>Total Alignment Length</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>12,840 km</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>Across 19 States & UTs</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00ed64', textTransform: 'uppercase' }}>Clearance Velocity</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>89.2%</div>
            <span style={{ fontSize: 11, color: '#00684a' }}>Right-of-Way (RoW) handed over</span>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#7b3ff2', textTransform: 'uppercase' }}>Total Solatium Outlay</span>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#001e2b', marginTop: 4 }}>₹48,920 Cr</div>
            <span style={{ fontSize: 11, color: '#5c6c7a' }}>Central Infra Fund Escrow</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>
            Major Inter-State Infrastructure Portfolios
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fbfa', borderBottom: '1px solid #e1e5e8', color: '#5c6c7a', fontSize: 11 }}>
                <th style={{ padding: '10px 12px' }}>CORRIDOR NAME</th>
                <th style={{ padding: '10px 12px' }}>MINISTRY / BODY</th>
                <th style={{ padding: '10px 12px' }}>STATES SPANNED</th>
                <th style={{ padding: '10px 12px' }}>ACQUISITION REGIME</th>
                <th style={{ padding: '10px 12px' }}>PROGRESS</th>
                <th style={{ padding: '10px 12px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Delhi-Mumbai Expressway (PKG 14-22)</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>NHAI / MoRTH</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>DEL, HAR, RAJ, MP, GUJ, MAH</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#fff8e0', color: '#946f3f', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>NH ACT 1956</span></td>
                <td style={{ padding: '12px', color: '#00684a', fontWeight: 700 }}>94% Acquired</td>
                <td style={{ padding: '12px' }}><button onClick={() => showToast('Opening Delhi-Mumbai Corridor telemetry')} style={{ background: '#00ed64', border: 'none', borderRadius: 9999, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Inspect ➔</button></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eceff1' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Western Dedicated Freight Corridor</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>DFCCIL / Railways</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>UP, HAR, RAJ, GUJ, MAH</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#c3f0d2', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>RAILWAY ACT / RFCTLARR</span></td>
                <td style={{ padding: '12px', color: '#00684a', fontWeight: 700 }}>98% Acquired</td>
                <td style={{ padding: '12px' }}><button onClick={() => showToast('Opening DFCCIL Corridor telemetry')} style={{ background: '#00ed64', border: 'none', borderRadius: 9999, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Inspect ➔</button></td>
              </tr>
              <tr>
                <td style={{ padding: '12px', fontWeight: 600, color: '#001e2b' }}>Green Energy Transmission Corridor Ph II</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>POWERGRID / MoP</td>
                <td style={{ padding: '12px', color: '#1c2d38' }}>RAJ, GUJ, MP, MAH, KAR, TN</td>
                <td style={{ padding: '12px' }}><span style={{ background: '#e3fcef', color: '#00684a', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>ELECTRICITY ACT 2003</span></td>
                <td style={{ padding: '12px', color: '#00684a', fontWeight: 700 }}>82% RoW Acquired</td>
                <td style={{ padding: '12px' }}><button onClick={() => showToast('Opening Green Energy Corridor telemetry')} style={{ background: '#00ed64', border: 'none', borderRadius: 9999, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Inspect ➔</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 18: AI & INTEGRATIONS STUDIO
  // =========================================================================
  if (activeCategory === 'ai-studio') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'LandFlow Neural & Vision AI Studio',
          'Autonomous artificial intelligence accelerators: Computer vision parcel boundary detection, Gazette OCR & Named Entity Extraction, and statutory Section 25 limitation forecasting.',
          'AI ACCELERATOR',
          '#7b3ff2',
          '3 Models Online'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#7b3ff2', textTransform: 'uppercase' }}>Model 01: Vision AI</span>
            <h3 style={{ margin: '4px 0 10px', fontSize: 17, color: '#001e2b' }}>Cadastral Boundary Edge Inference</h3>
            <p style={{ fontSize: 13, color: '#5c6c7a', lineHeight: 1.4, margin: '0 0 14px' }}>
              Deep learning polygon segmentation model trained on high-resolution drone ortho-photos and DILRMP village maps. Auto-detects encroached borders and waterbody overlaps.
            </p>
            <div style={{ background: '#f9fbfa', padding: 12, borderRadius: 8, fontSize: 12, color: '#1c2d38', marginBottom: 14 }}>
              <div><strong>Input Resolution:</strong> 0.05m GSD Drone Imagery</div>
              <div><strong>Inference Latency:</strong> 240ms / sq.km</div>
              <div><strong>IoU Accuracy:</strong> 96.4% on cadastral benchmark</div>
            </div>
            <button
              onClick={() => showToast('AI Vision Model: Running cadastral edge inference...')}
              style={{
                background: '#001e2b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9999,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Run Boundary Extraction Model ➔
            </button>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <span style={{ fontSize: 11, font: '600 11px "DM Mono"', color: '#00a35c', textTransform: 'uppercase' }}>Model 02: NLP & OCR</span>
            <h3 style={{ margin: '4px 0 10px', fontSize: 17, color: '#001e2b' }}>Gazette Extraordinary NLP & NER Parser</h3>
            <p style={{ fontSize: 13, color: '#5c6c7a', lineHeight: 1.4, margin: '0 0 14px' }}>
              Multi-lingual transformer model extracting survey numbers, shareholder percentages, revenue assessments, and statutory citations from scanned state gazette PDFs.
            </p>
            <div style={{ background: '#f9fbfa', padding: 12, borderRadius: 8, fontSize: 12, color: '#1c2d38', marginBottom: 14 }}>
              <div><strong>Supported Scripts:</strong> Devanagari, Gurmukhi, Telugu, Tamil, English</div>
              <div><strong>NER Extraction F1-Score:</strong> 98.2% on Gazette entities</div>
              <div><strong>Auto-Drafting:</strong> Section 11 & Section 19 Notifications</div>
            </div>
            <button
              onClick={() => showToast('AI NLP Model: Scanning Gazette PDF and extracting entities...')}
              style={{
                background: '#00ed64',
                color: '#001e2b',
                border: 'none',
                borderRadius: 9999,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Execute Gazette Document Parser ➔
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // FALLBACK FOR OTHER SPECIALIZED OPERATIONAL PANELS
  // =========================================================================
  return (
    <div className="category-panel-container">
      {renderCategoryHeader(
        `${activeCategory.replace(/-/g, ' ').toUpperCase()} Console`,
        `Specialized statutory operational desk under RFCTLARR Act 2013 and Master Reference Specification.`,
        'OPERATIONAL DESK',
        '#7b3ff2'
      )}

      <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 18, color: '#001e2b' }}>
          Statutory Operational Module: {activeCategory.replace(/-/g, ' ').toUpperCase()}
        </h3>
        <p style={{ fontSize: 13, color: '#5c6c7a', lineHeight: 1.5, margin: '0 0 16px' }}>
          This module is active and synchronized with the PostgreSQL database. All stage transitions, notices, valuations, and digital signatures conform to RFCTLARR Act 2013 statutory timelines.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onSelectCategory('dashboard')}
            style={{
              background: '#001e2b',
              color: '#ffffff',
              border: 'none',
              borderRadius: 9999,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Return to Command Centre
          </button>
          {can('transition_projects') && (
            <button
              onClick={onOpenGateReview}
              style={{
                background: '#00ed64',
                color: '#001e2b',
                border: 'none',
                borderRadius: 9999,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Execute Stage Review ➔
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
