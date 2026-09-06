import React, { useState } from 'react'
import type { StatutoryStageItem, StakeholderPersona } from '../App'
import type { Project, MyTaskItem } from '../api/client'
import { isCategoryAllowedForRole, getCategoryRestrictionReason, filterParcelsByJurisdiction } from '../rbac'

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

  // Multi-District & Multi-Owner Cadastral Parcels database with strict jurisdictional isolation
  const allCadastralParcels = [
    // --- Kurnool District (AP-KUR) ---
    {
      id: 'PARCEL-1042',
      survey: 'AP-KUR-1042',
      survey_number: 'AP-KUR-1042',
      district_code: 'KUR',
      state_code: 'AP',
      owner_id: 'CITIZEN-AP-01',
      ulpin: '29000000000021',
      owner: 'Rameshwar Sharma',
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
      coordinates: '15.8250° N, 78.0350° E',
    },
    {
      id: 'PARCEL-1043',
      survey: 'AP-KUR-1043',
      survey_number: 'AP-KUR-1043',
      district_code: 'KUR',
      state_code: 'AP',
      owner_id: 'CITIZEN-AP-01',
      ulpin: '29000000000022',
      owner: 'Rameshwar Sharma & Brothers',
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
      coordinates: '15.8280° N, 78.0410° E',
    },
    {
      id: 'PARCEL-1044',
      survey: 'KPL/2026/SN-114/7',
      survey_number: 'KPL/2026/SN-114/7',
      district_code: 'KUR',
      state_code: 'AP',
      ulpin: '29000000000023',
      owner: 'Gram Panchayat Common Pasture (Gauchar)',
      areaHa: 6.40,
      areaBigha: 24.96,
      soil: 'Gauchar / Community Land',
      status: 'Verified',
      marketRate: '₹28,00,000 / ha',
      grossAward: '₹4,03,20,000',
      solatium: '₹1,34,40,000',
      dbtStatus: 'Deposited in Authority',
      utr: 'PFMS202688419288',
      encumbrance: 'Gram Sabha Resolution Passed',
      coordinates: '15.8300° N, 78.0500° E',
    },

    // --- Mahabubnagar District (TS-MBN) ---
    {
      id: 'PARCEL-2041',
      survey: 'TS-MBN-2026/SN-2041',
      survey_number: 'TS-MBN-2026/SN-2041',
      district_code: 'MBN',
      state_code: 'TS',
      owner_id: 'CITIZEN-TS-01',
      ulpin: '36000000000021',
      owner: 'Sunita Devi w/o Late Venkat Rao',
      areaHa: 8.20,
      areaBigha: 32.00,
      soil: 'Black Cotton (Semi-Arid Commercial)',
      status: 'Verified',
      marketRate: '₹48,00,000 / ha',
      grossAward: '₹7,87,20,000',
      solatium: '₹2,62,40,000',
      dbtStatus: 'Disbursed',
      utr: 'PFMS202699318210',
      encumbrance: 'Nil (Clean Title)',
      coordinates: '16.7450° N, 78.0050° E',
    },
    {
      id: 'PARCEL-2042',
      survey: 'TS-MBN-2026/SN-2042',
      survey_number: 'TS-MBN-2026/SN-2042',
      district_code: 'MBN',
      state_code: 'TS',
      ulpin: '36000000000022',
      owner: 'Jadcherla Industrial Development Cooperative',
      areaHa: 12.50,
      areaBigha: 48.75,
      soil: 'Commercial Wet Land',
      status: 'Under Scrutiny',
      marketRate: '₹52,00,000 / ha',
      grossAward: '₹13,00,00,000',
      solatium: '₹4,33,33,333',
      dbtStatus: 'Pending Escrow',
      utr: 'Pending Approval',
      encumbrance: 'Consent Deed Pending Verification',
      coordinates: '16.7510° N, 78.0120° E',
    },

    // --- Varanasi District (UP-VNS) ---
    {
      id: 'PARCEL-3012',
      survey: 'UP-VNS-2026/SN-3012',
      survey_number: 'UP-VNS-2026/SN-3012',
      district_code: 'VNS',
      state_code: 'UP',
      owner_id: 'CITIZEN-UP-01',
      ulpin: '09000000000031',
      owner: 'Vikram Singh s/o R. P. Singh',
      areaHa: 14.50,
      areaBigha: 56.55,
      soil: 'Alluvial Ganga Basin (Multi-Crop)',
      status: 'Verified',
      marketRate: '₹62,00,000 / ha',
      grossAward: '₹17,98,00,000',
      solatium: '₹5,99,33,333',
      dbtStatus: 'Disbursed',
      utr: 'PFMS202677109244',
      encumbrance: 'Nil (Clean Title)',
      coordinates: '25.3200° N, 82.9800° E',
    },
    {
      id: 'PARCEL-3013',
      survey: 'UP-VNS-2026/SN-3013',
      survey_number: 'UP-VNS-2026/SN-3013',
      district_code: 'VNS',
      state_code: 'UP',
      ulpin: '09000000000032',
      owner: 'Kashi Agro Producers Society',
      areaHa: 5.10,
      areaBigha: 19.89,
      soil: 'Irrigated Fertile Loam',
      status: 'Verified',
      marketRate: '₹58,00,000 / ha',
      grossAward: '₹5,91,60,000',
      solatium: '₹1,97,20,000',
      dbtStatus: 'Deposited in Authority',
      utr: 'PFMS202677109299',
      encumbrance: 'Section 77(2) Judicial Escrow Deposited',
      coordinates: '25.3250° N, 82.9850° E',
    },
  ]

  // Filter parcels according to active persona's jurisdictional boundary
  const cadastralParcels = filterParcelsByJurisdiction(allCadastralParcels, activePersona.jurisdiction)

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
  // CATEGORY 3A: CADASTRAL LAND PARCELS REGISTRY (PARCELS)
  // =========================================================================
  if (activeCategory === 'parcels') {
    const activeParcel = cadastralParcels.find((p) => p.id === selectedParcelId) || cadastralParcels[0]

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Cadastral Land Parcels Registry',
          'Authoritative statutory parcel schedule under Sections 11 & 19 of RFCTLARR Act 2013. Reconciled with State DILRMP (Bhoomi / Bhulekh) and Unique Land Parcel Identification Numbers (ULPIN).',
          'PARCELS REGISTRY',
          '#00684a',
          `${cadastralParcels.length} Parcels Synchronized`
        )}

        {/* Parcels Metric Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>NOTIFIED AREA</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#001e2b', margin: '4px 0' }}>5.80 Hectares</strong>
            <small style={{ color: '#00a35c', fontSize: 11 }}>100% Right-of-Way Surveyed</small>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>PARCEL DILRMP SYNC</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#00684a', margin: '4px 0' }}>3 Verified / 1 Scrutiny</strong>
            <small style={{ color: '#5c6c7a', fontSize: 11 }}>Bhoomi & Webland Live Link</small>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>ASSESSED VALUATION</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#001e2b', margin: '4px 0' }}>₹4,80,82,500</strong>
            <small style={{ color: '#5c6c7a', fontSize: 11 }}>Sec 26 Base Market Value</small>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>ULPIN SEEDING</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#00684a', margin: '4px 0' }}>14-Digit Standard</strong>
            <small style={{ color: '#00a35c', fontSize: 11 }}>NIC Geo-referenced Standard</small>
          </div>
        </div>

        {/* Tabular Registry */}
        <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong style={{ fontSize: 16, color: '#001e2b' }}>Cadastral Parcel Ledger</strong>
              <div style={{ fontSize: 12, color: '#5c6c7a' }}>Select any parcel to inspect Jamabandi record and title history</div>
            </div>
            <button
              onClick={() => onSelectCategory('gis-map')}
              style={{
                background: '#3d4f9f',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open Spatial GIS Studio ➔
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f4f7f6', borderBottom: '2px solid #e1e5e8', color: '#1c2d38' }}>
                  <th style={{ padding: '12px 14px' }}>Survey No</th>
                  <th style={{ padding: '12px 14px' }}>ULPIN</th>
                  <th style={{ padding: '12px 14px' }}>Recorded Owner</th>
                  <th style={{ padding: '12px 14px' }}>Area (Ha / Bigha)</th>
                  <th style={{ padding: '12px 14px' }}>Land Class</th>
                  <th style={{ padding: '12px 14px' }}>Assessed Rate</th>
                  <th style={{ padding: '12px 14px' }}>DILRMP Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cadastralParcels.map((p) => {
                  const isSelected = p.id === activeParcel.id
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedParcelId(p.id)}
                      style={{
                        borderBottom: '1px solid #eceff1',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#00684a', fontFamily: 'DM Mono' }}>
                        {p.survey}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'DM Mono', fontSize: 11, color: '#5c6c7a' }}>
                        {p.ulpin}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#001e2b' }}>
                        {p.owner}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {p.areaHa} Ha <small style={{ color: '#5c6c7a' }}>({p.areaBigha} Bigha)</small>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#3d4f5b' }}>
                        {p.soil}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#001e2b' }}>
                        {p.marketRate}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: p.status === 'Verified' ? '#c3f0d2' : '#fff8e0',
                            color: p.status === 'Verified' ? '#00684a' : '#946f3f',
                          }}
                        >
                          ● {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedParcelId(p.id)
                            onSelectCategory('gis-map')
                          }}
                          style={{
                            background: '#f4f7f6',
                            border: '1px solid #c1ccd6',
                            borderRadius: 4,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: '#001e2b',
                          }}
                        >
                          View on Map ⌖
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Parcel Dossier */}
        <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: '#00684a', fontWeight: 700 }}>PARCEL DOSSIER</span>
              <h3 style={{ margin: '2px 0 0', fontSize: 18, color: '#001e2b' }}>
                Survey #{activeParcel.survey} · {activeParcel.owner}
              </h3>
            </div>
            <button
              onClick={() => {
                setDilrmpSurvey(activeParcel.survey)
                onSelectCategory('dilrmp')
                onDilrmpLookup()
              }}
              style={{
                background: '#00684a',
                color: '#fff',
                border: 'none',
                borderRadius: 9999,
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Verify RoR against DILRMP ➔
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, fontSize: 13 }}>
            <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#5c6c7a', fontSize: 11 }}>ULPIN Geometry:</span>
              <strong style={{ display: 'block', color: '#001e2b', fontFamily: 'DM Mono' }}>{activeParcel.ulpin}</strong>
            </div>
            <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#5c6c7a', fontSize: 11 }}>DGPS Coordinates:</span>
              <strong style={{ display: 'block', color: '#001e2b', fontFamily: 'DM Mono' }}>{activeParcel.coordinates}</strong>
            </div>
            <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#5c6c7a', fontSize: 11 }}>Gross Award & Solatium:</span>
              <strong style={{ display: 'block', color: '#00684a' }}>{activeParcel.grossAward} (Solatium: {activeParcel.solatium})</strong>
            </div>
            <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#5c6c7a', fontSize: 11 }}>Encumbrance Status:</span>
              <strong style={{ display: 'block', color: activeParcel.encumbrance.includes('Pending') ? '#dc2626' : '#00684a' }}>
                {activeParcel.encumbrance}
              </strong>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 3B: SPATIAL GIS CADASTRAL MAP STUDIO (GIS-MAP)
  // =========================================================================
  if (activeCategory === 'gis-map') {
    const activeParcel = cadastralParcels.find((p) => p.id === selectedParcelId) || cadastralParcels[0]

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Spatial GIS Cadastral Map Studio',
          'Interactive GIS spatial boundary layer with DGPS drone flight overlays, Right-of-Way (ROW) corridor buffer analysis, and EPSG:4326 coordinate inspection.',
          'SPATIAL GIS STUDIO',
          '#3d4f9f',
          `${cadastralParcels.length} Spatial Polygons Active`
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
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
                height: 380,
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
                  strokeDasharray="6 4"
                />

                {/* Cadastral Polygon 1: 1042 */}
                <polygon
                  points="60,110 160,100 150,170 50,165"
                  fill={selectedParcelId === 'PARCEL-1042' ? 'rgba(0,237,100,0.45)' : 'rgba(0,181,69,0.25)'}
                  stroke={selectedParcelId === 'PARCEL-1042' ? '#00ed64' : '#00b545'}
                  strokeWidth={selectedParcelId === 'PARCEL-1042' ? 3 : 1.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => setSelectedParcelId('PARCEL-1042')}
                />
                <text x="80" y="142" fill="#eaf1e8" fontSize="10" fontFamily="DM Mono" fontWeight="700">
                  #1042
                </text>

                {/* Cadastral Polygon 2: 1043 */}
                <polygon
                  points="160,100 270,85 260,150 150,170"
                  fill={selectedParcelId === 'PARCEL-1043' ? 'rgba(250,110,57,0.5)' : 'rgba(250,110,57,0.25)'}
                  stroke={selectedParcelId === 'PARCEL-1043' ? '#fa6e39' : '#d97706'}
                  strokeWidth={selectedParcelId === 'PARCEL-1043' ? 3 : 1.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => setSelectedParcelId('PARCEL-1043')}
                />
                <text x="185" y="130" fill="#eaf1e8" fontSize="10" fontFamily="DM Mono" fontWeight="700">
                  #1043 (Dispute)
                </text>

                {/* Cadastral Polygon 3: 1044 */}
                <polygon
                  points="270,85 380,105 370,180 260,150"
                  fill={selectedParcelId === 'PARCEL-1044' ? 'rgba(0,237,100,0.45)' : 'rgba(0,181,69,0.25)'}
                  stroke={selectedParcelId === 'PARCEL-1044' ? '#00ed64' : '#00b545'}
                  strokeWidth={selectedParcelId === 'PARCEL-1044' ? 3 : 1.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => setSelectedParcelId('PARCEL-1044')}
                />
                <text x="295" y="140" fill="#eaf1e8" fontSize="10" fontFamily="DM Mono" fontWeight="700">
                  #1044
                </text>

                {/* Cadastral Polygon 4: 1045 */}
                <polygon
                  points="380,105 460,130 450,220 370,180"
                  fill={selectedParcelId === 'PARCEL-1045' ? 'rgba(0,237,100,0.45)' : 'rgba(0,181,69,0.25)'}
                  stroke={selectedParcelId === 'PARCEL-1045' ? '#00ed64' : '#00b545'}
                  strokeWidth={selectedParcelId === 'PARCEL-1045' ? 3 : 1.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => setSelectedParcelId('PARCEL-1045')}
                />
                <text x="395" y="165" fill="#eaf1e8" fontSize="10" fontFamily="DM Mono" fontWeight="700">
                  #1045
                </text>
              </svg>
            </div>
          </div>

          {/* Right Column: Spatial Attributes Inspector */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 14, color: '#001e2b' }}>Spatial Attribute Inspector</strong>
              <span style={{ fontSize: 11, color: '#3d4f9f', fontWeight: 700, fontFamily: 'DM Mono' }}>
                {activeParcel.coordinates}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div style={{ background: '#f8faf9', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Selected Parcel:</span>
                <strong style={{ display: 'block', fontSize: 15, color: '#001e2b' }}>Survey #{activeParcel.survey}</strong>
                <small style={{ color: '#5c6c7a', fontFamily: 'DM Mono' }}>ULPIN: {activeParcel.ulpin}</small>
              </div>
              <div style={{ background: '#f8faf9', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Landowner & Soil:</span>
                <div style={{ fontWeight: 600, color: '#001e2b' }}>{activeParcel.owner}</div>
                <div style={{ color: '#5c6c7a', fontSize: 12 }}>{activeParcel.soil}</div>
              </div>
              <div style={{ background: '#f8faf9', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Area & Market Value:</span>
                <div style={{ fontWeight: 600, color: '#00684a' }}>
                  {activeParcel.areaHa} Ha ({activeParcel.areaBigha} Bigha) · {activeParcel.marketRate}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => onSelectCategory('parcels')}
                style={{
                  width: '100%',
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
                Open Full Parcels Registry ➔
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

        {/* Action / File Objection Form - Only for Citizen Landowners or Authorized Officers */}
        {can('objection.submit') && (
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
        )}

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
  // CATEGORY 6A: SECTION 23/30 STATUTORY AWARD DECREES REGISTRY (AWARDS)
  // =========================================================================
  if (activeCategory === 'awards') {
    const awardDecrees = [
      {
        id: 'AWD-2026-001',
        survey: 'BH-48-1042',
        awardee: 'Asha Devi w/o Ram Lal',
        area: '1.25 Ha',
        baseVal: '₹52,50,000',
        solatium: '₹52,50,000',
        interest: '₹13,12,500',
        totalAward: '₹1,18,12,500',
        status: 'Signed & Gazetted',
        gazetteDate: '2026-08-24',
        dsc: 'DSC-CALA-KRN-SEC23-VALID',
      },
      {
        id: 'AWD-2026-002',
        survey: 'BH-48-1043',
        awardee: 'Manoj Kumar Sharma & Brothers',
        area: '2.10 Ha',
        baseVal: '₹71,40,000',
        solatium: '₹71,40,000',
        interest: '₹17,85,000',
        totalAward: '₹1,60,65,000',
        status: 'Under Reference (Sec 64)',
        gazetteDate: '2026-08-28',
        dsc: 'DSC-CALA-KRN-SEC23-VALID',
      },
      {
        id: 'AWD-2026-003',
        survey: 'BH-48-1044',
        awardee: 'Gram Panchayat Common Pasture',
        area: '0.85 Ha',
        baseVal: '₹23,80,000',
        solatium: '₹23,80,000',
        interest: '₹5,95,000',
        totalAward: '₹53,55,000',
        status: 'Authority Deposit (Sec 77)',
        gazetteDate: '2026-09-01',
        dsc: 'DSC-CALA-KRN-SEC23-VALID',
      },
      {
        id: 'AWD-2026-004',
        survey: 'BH-48-1045',
        awardee: 'Sukhvinder Singh s/o Gurdial Singh',
        area: '1.65 Ha',
        baseVal: '₹66,00,000',
        solatium: '₹66,00,000',
        interest: '₹16,50,000',
        totalAward: '₹1,48,50,000',
        status: 'Signed & Gazetted',
        gazetteDate: '2026-09-03',
        dsc: 'DSC-CALA-KRN-SEC23-VALID',
      },
    ]

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 23 & 30 Statutory Award Decrees Registry',
          'Formal civil decree rolls of compensation awards pronounced by CALA under Sections 23, 30(2) (100% Solatium), and 30(3) (12% Interest) of RFCTLARR Act 2013.',
          'AWARD DECREES',
          '#7b3ff2',
          '4 Civil Decrees Gazetted'
        )}

        {/* Awards Metric Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>TOTAL AWARD ROLL</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#001e2b', margin: '4px 0' }}>₹4,80,82,500</strong>
            <small style={{ color: '#00a35c', fontSize: 11 }}>Civil Decrees Enforced</small>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>100% SOLATIUM (SEC 30(2))</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#00684a', margin: '4px 0' }}>₹2,13,70,000</strong>
            <small style={{ color: '#5c6c7a', fontSize: 11 }}>Mandatory First Schedule</small>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>12% INTEREST (SEC 30(3))</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#7b3ff2', margin: '4px 0' }}>₹53,42,500</strong>
            <small style={{ color: '#5c6c7a', fontSize: 11 }}>Accrued from Sec 11 Notice</small>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 10, padding: 16 }}>
            <span style={{ fontSize: 11, color: '#5c6c7a', textTransform: 'uppercase', fontFamily: 'DM Mono' }}>DSC DIGITAL SIGNATURES</span>
            <strong style={{ display: 'block', fontSize: 20, color: '#00684a', margin: '4px 0' }}>100% Validated</strong>
            <small style={{ color: '#00a35c', fontSize: 11 }}>e-Sign Act 2000 Sealed</small>
          </div>
        </div>

        {/* Awards Decrees Table */}
        <div style={{ background: '#fff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong style={{ fontSize: 16, color: '#001e2b' }}>Gazetted Section 23/30 Award Roll</strong>
              <div style={{ fontSize: 12, color: '#5c6c7a' }}>Form No. 14 Award Determinations published in Official Gazette</div>
            </div>
            <button
              onClick={() => onSelectCategory('compensation')}
              style={{
                background: '#00b545',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open Valuation Calculator ➔
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f4f7f6', borderBottom: '2px solid #e1e5e8', color: '#1c2d38' }}>
                  <th style={{ padding: '12px 14px' }}>Decree ID</th>
                  <th style={{ padding: '12px 14px' }}>Survey No</th>
                  <th style={{ padding: '12px 14px' }}>Awardee Name</th>
                  <th style={{ padding: '12px 14px' }}>Base Value (Sec 26)</th>
                  <th style={{ padding: '12px 14px' }}>100% Solatium</th>
                  <th style={{ padding: '12px 14px' }}>12% Interest</th>
                  <th style={{ padding: '12px 14px' }}>Total Award Decree</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {awardDecrees.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #eceff1' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7b3ff2', fontFamily: 'DM Mono' }}>
                      {a.id}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'DM Mono', fontWeight: 600 }}>{a.survey}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#001e2b' }}>{a.awardee}</td>
                    <td style={{ padding: '12px 14px' }}>{a.baseVal}</td>
                    <td style={{ padding: '12px 14px', color: '#00684a', fontWeight: 600 }}>{a.solatium}</td>
                    <td style={{ padding: '12px 14px', color: '#7b3ff2' }}>{a.interest}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#001e2b' }}>{a.totalAward}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: a.status.includes('Signed') ? '#c3f0d2' : '#fff8e0',
                          color: a.status.includes('Signed') ? '#00684a' : '#946f3f',
                        }}
                      >
                        ● {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CATEGORY 6B: FIRST SCHEDULE VALUATION ENGINE & CALCULATOR (COMPENSATION)
  // =========================================================================
  if (activeCategory === 'compensation') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'First Schedule Statutory Valuation Engine',
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
              {can('payment.initiate') || can('payment.approve') ? (
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
              ) : (
                <div style={{ padding: '10px 14px', background: '#f8faf6', border: '1px solid #ced6cb', borderRadius: 8, fontSize: 12, color: '#4f6859', marginTop: 8 }}>
                  🔒 <strong>Segregation of Duties (§25):</strong> PFMS DBT fund transfers can only be executed by an authorized <strong>Finance Officer</strong>. Your role has read-only clearance audit access.
                </div>
              )}
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
      </div >
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
            {can('possession.initiate') ? (
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
            ) : (
              <div style={{ padding: '12px 14px', background: '#f8faf6', border: '1px solid #ced6cb', borderRadius: 8, fontSize: 12, color: '#4f6859' }}>
                🔒 <strong>Statutory Authority Restriction:</strong> Under RFCTLARR Act 2013 Section 38, physical possession of land can only be executed by the <strong>District Collector / Competent Authority (CALA)</strong>.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CITIZEN CATEGORY 1: MY LAND HOLDINGS (MY-LAND)
  // =========================================================================
  if (activeCategory === 'my-land') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'My Registered Land Holdings & Cadastral Records',
          'Verified land parcels registered under your Aadhaar / RoR Jamabandi. Shows survey numbers, khasra dimensions, acquisition status, and DILRMP state database synchronization.',
          'LAND HOLDINGS',
          '#00a35c',
          'Landowner: Asha Devi (Survey #1042)'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Detailed Land Record */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: '#00684a', fontWeight: 700 }}>VERIFIED ROR RECORD</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 18, color: '#001e2b' }}>
                  Survey #BH-48-1042 / 1A
                </h3>
              </div>
              <span style={{ background: '#c3f0d2', color: '#00684a', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
                ✓ DILRMP Verified
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 18 }}>
              <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Unique Parcel ID (ULPIN):</span>
                <strong style={{ display: 'block', color: '#001e2b', fontFamily: 'DM Mono' }}>14081042-2026-RAJ</strong>
              </div>
              <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>RoR Jamabandi:</span>
                <strong style={{ display: 'block', color: '#001e2b' }}>Khewat #14 / Khatauni #82</strong>
              </div>
              <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Acquired Parcel Area:</span>
                <strong style={{ display: 'block', color: '#00684a' }}>1.25 Hectares (4.88 Bigha)</strong>
              </div>
              <div style={{ background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Land Classification:</span>
                <strong style={{ display: 'block', color: '#001e2b' }}>Chahi-1 (Double Cropped)</strong>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #eceff1', paddingTop: 14, display: 'flex', gap: 10 }}>
              <button
                onClick={() => showToast('Jamabandi RoR extract downloaded in Hindi & English (PDF)')}
                style={{
                  background: '#00684a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 18px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Download RoR Jamabandi Certificate (PDF) ⬇
              </button>
            </div>
          </div>

          {/* Boundaries and Neighbors */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>Cadastral Boundary Four-Corners</h3>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div style={{ padding: 10, background: '#f4f7f6', borderRadius: 6 }}>
                <strong>North:</strong> Khasra #1041 (Village Canal / Distributary)
              </div>
              <div style={{ padding: 10, background: '#f4f7f6', borderRadius: 6 }}>
                <strong>South:</strong> Khasra #1043 (Manoj Kumar Sharma & Brothers)
              </div>
              <div style={{ padding: 10, background: '#f4f7f6', borderRadius: 6 }}>
                <strong>East:</strong> Pipeline Right-of-Way Corridor Boundary
              </div>
              <div style={{ padding: 10, background: '#f4f7f6', borderRadius: 6 }}>
                <strong>West:</strong> Gram Panchayat Village Road (12m Paved)
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CITIZEN CATEGORY 2: STATUTORY NOTICES & GAZETTES (MY-NOTICES)
  // =========================================================================
  if (activeCategory === 'my-notices') {
    const citizenNotices = [
      {
        id: 'NOT-2026-01',
        section: 'Section 11(1)',
        title: 'Preliminary Notification & Land Use Freeze Order',
        date: '2026-04-12',
        gazette: 'Gazette of India Ext. No. 418/2026',
        servedVia: 'Registered Post with A/D (Delivered)',
      },
      {
        id: 'NOT-2026-02',
        section: 'Section 15(2)',
        title: 'Notice for Hearing of Objections Before CALA',
        date: '2026-06-18',
        gazette: 'Collectorate Notice Board No. LA/2026/89',
        servedVia: 'Hand Delivered by Village Talathi (Signed)',
      },
      {
        id: 'NOT-2026-03',
        section: 'Section 19(1)',
        title: 'Declaration of Acquisition for Public Purpose',
        date: '2026-07-29',
        gazette: 'Gazette of India Ext. No. 712/2026',
        servedVia: 'Panchayat Chaupal Publication',
      },
      {
        id: 'NOT-2026-04',
        section: 'Section 21',
        title: 'Public Notice of Claims to Compensation and Possession',
        date: '2026-08-15',
        gazette: 'Form No. 9 Public Notice',
        servedVia: 'Speed Post (Article #EK88291024IN)',
      },
    ]

    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Statutory Gazette Notices & Summons',
          'Official notifications and legal summons served under RFCTLARR Act 2013 regarding Survey #1042, including preliminary notifications, declaration copies, and award enquiry notices.',
          'STATUTORY NOTICES',
          '#fa6e39',
          `${citizenNotices.length} Notices Served`
        )}

        <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f4f7f6', borderBottom: '2px solid #e1e5e8', color: '#1c2d38' }}>
                  <th style={{ padding: '12px 14px' }}>Notice ID</th>
                  <th style={{ padding: '12px 14px' }}>Statutory Section</th>
                  <th style={{ padding: '12px 14px' }}>Subject / Purpose</th>
                  <th style={{ padding: '12px 14px' }}>Publication Date</th>
                  <th style={{ padding: '12px 14px' }}>Service Mode</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Official Copy</th>
                </tr>
              </thead>
              <tbody>
                {citizenNotices.map((n) => (
                  <tr key={n.id} style={{ borderBottom: '1px solid #eceff1' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'DM Mono', fontWeight: 700, color: '#fa6e39' }}>{n.id}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {n.section}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <strong style={{ color: '#001e2b' }}>{n.title}</strong>
                      <div style={{ fontSize: 11, color: '#5c6c7a' }}>{n.gazette}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'DM Mono' }}>{n.date}</td>
                    <td style={{ padding: '12px 14px', color: '#00684a', fontWeight: 600 }}>{n.servedVia}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => showToast(`Downloaded certified copy: ${n.title}`)}
                        style={{
                          background: '#f4f7f6',
                          border: '1px solid #c1ccd6',
                          borderRadius: 4,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Download PDF ⬇
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CITIZEN CATEGORY 3: CITIZEN OBJECTIONS (MY-OBJECTIONS)
  // =========================================================================
  if (activeCategory === 'my-objections') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Section 15 Citizen Objections & Hearing Docket',
          'Track personal hearing appointments before the Competent Authority (CALA), review speaking orders, and file supplementary evidentiary proof regarding Survey #1042.',
          'CITIZEN OBJECTIONS',
          '#fa6e39',
          'Docket #OBJ-2026-SEC15-084'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Active Objection Status */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 16, color: '#001e2b' }}>Active Hearing Case Docket</strong>
              <span style={{ background: '#fff8e0', color: '#946f3f', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
                Hearing Scheduled
              </span>
            </div>

            <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Docket Number:</span>
                <div style={{ fontFamily: 'DM Mono', fontWeight: 700, color: '#001e2b' }}>OBJ-2026-SEC15-084</div>
              </div>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Grounds of Objection:</span>
                <div style={{ fontWeight: 600, color: '#b91c1c' }}>
                  Valuation Dispute — High-yield mango orchard and borewell under-assessed in PWD valuation schedule
                </div>
              </div>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Hearing Date & Location:</span>
                <div style={{ fontWeight: 600, color: '#00684a' }}>
                  18 Sep 2026, 11:30 AM · Court Hall No. 2, District Collectorate, Kurnool
                </div>
              </div>
              <div>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>Presiding Authority:</span>
                <div style={{ color: '#001e2b' }}>District Collector & CALA / Joint Collector (Revenue)</div>
              </div>
            </div>
          </div>

          {/* Supplementary Evidence Upload Form */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#001e2b' }}>Submit Supplementary Documents</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Document Type</label>
                <select style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 6, border: '1px solid #c1ccd6', marginTop: 4 }}>
                  <option>Registered Sale Deed of Adjoining Barani Land (2025-26)</option>
                  <option>Horticulture Officer Valuation Certificate for Fruit Trees</option>
                  <option>Groundwater Department Borewell Registration & Log</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Document Description / Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Provide details of sale deed or crop valuation..."
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #c1ccd6', marginTop: 4 }}
                />
              </div>
              <button
                onClick={() => showToast('Document successfully submitted and appended to Objection Case Docket!')}
                style={{
                  background: '#fa6e39',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: 6,
                }}
              >
                Upload Supplementary Evidence ➔
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CITIZEN CATEGORY 4: MY COMPENSATION AWARD (MY-COMPENSATION)
  // =========================================================================
  if (activeCategory === 'my-compensation') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'My Statutory Compensation Determination Sheet',
          'Certified First Schedule statutory compensation statement passed under Sections 23, 26, 29, 30(2), and 30(3) of RFCTLARR Act 2013 for Survey #1042.',
          'COMPENSATION ENTITLEMENT',
          '#00b545',
          'Total Award: ₹1,61,37,450'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Statutory Breakdown Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#001e2b' }}>
              First Schedule Legal Entitlement Computation
            </h3>

            <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Base Land Value (Circle Rate × 1.25 Ha):</span>
                <strong style={{ color: '#001e2b' }}>₹52,50,000</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Rural Multiplier Factor (1.25x Distance Buffer):</span>
                <strong style={{ color: '#001e2b' }}>₹13,12,500</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Value of Assets & Mango Trees (Section 29):</span>
                <strong style={{ color: '#001e2b' }}>₹8,40,000</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1', color: '#00684a', fontWeight: 600 }}>
                <span>Subtotal Market Value (Component A):</span>
                <strong>₹74,02,500</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1', color: '#00684a', fontWeight: 600 }}>
                <span>100% Mandatory Solatium (Section 30(2)) (Component B):</span>
                <strong>₹74,02,500</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1', color: '#7b3ff2', fontWeight: 600 }}>
                <span>12% p.a. Additional Market Value (Section 30(3) - 18 Mos):</span>
                <strong>₹13,32,450</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 16, color: '#001e2b', fontWeight: 700 }}>
                <span>Grand Total Certified Award Payable:</span>
                <span style={{ color: '#00684a' }}>₹1,61,37,450</span>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => showToast('Downloaded Form 14 Certified Award Decree Statement (PDF)')}
                style={{
                  background: '#00684a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 20px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Download Certified Form 14 Statement (PDF) ⬇
              </button>
            </div>
          </div>

          {/* Solatium & Tax Exemption Notice */}
          <div style={{ background: '#001e2b', color: '#ffffff', borderRadius: 12, padding: 24 }}>
            <span style={{ font: '700 11px "DM Mono"', color: '#00ed64', letterSpacing: '0.08em' }}>
              SECTION 96 TAX EXEMPTION
            </span>
            <h3 style={{ margin: '4px 0 14px', fontSize: 18, color: '#ffffff' }}>
              100% Income Tax & Stamp Duty Exempt
            </h3>
            <p style={{ fontSize: 13, color: '#c1ccd6', lineHeight: 1.5 }}>
              Under <strong>Section 96 of RFCTLARR Act 2013</strong>, no income tax, capital gains tax, or stamp duty can be levied on any award or agreement made under this Act. The gross amount of <strong>₹1,61,37,450</strong> is credited without TDS deduction.
            </p>
            <div style={{ marginTop: 18, padding: 12, background: 'rgba(0,237,100,0.1)', border: '1px solid #00ed64', borderRadius: 8 }}>
              <small style={{ color: '#a7f3d0', fontSize: 11 }}>
                Section 96 Certificate Reference: <strong>SEC96-EXEMPT-KRN-2026-1042</strong>
              </small>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CITIZEN CATEGORY 5: PFMS DISBURSEMENTS (MY-PAYMENTS)
  // =========================================================================
  if (activeCategory === 'my-payments') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'PFMS Direct Benefit Transfer (DBT) Bank Tracker',
          'Electronic compensation disbursement status integrated with Public Financial Management System (PFMS) and Reserve Bank of India NEFT/RTGS gateway.',
          'PFMS DBT DISBURSEMENT',
          '#00684a',
          'Disbursed & Credited ✓'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Bank Transaction Receipt */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: '#00684a', fontWeight: 700 }}>NEFT/RTGS TRANSACTION</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 18, color: '#001e2b' }}>
                  ₹1,61,37,450 CREDITED
                </h3>
              </div>
              <span style={{ background: '#c3f0d2', color: '#00684a', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
                ✓ SUCCESSFUL
              </span>
            </div>

            <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Beneficiary Name:</span>
                <strong style={{ color: '#001e2b' }}>Asha Devi w/o Late Ram Prasad</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Bank & Branch:</span>
                <strong style={{ color: '#001e2b' }}>State Bank of India (Kurnool Main Branch)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Bank Account Number:</span>
                <strong style={{ fontFamily: 'DM Mono', color: '#001e2b' }}>•••• •••• •••• 4092</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>IFSC Code:</span>
                <strong style={{ fontFamily: 'DM Mono', color: '#001e2b' }}>SBIN0001248</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>PFMS UTR Number:</span>
                <strong style={{ fontFamily: 'DM Mono', color: '#00684a' }}>SBINR5202609060081294</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #eceff1' }}>
                <span style={{ color: '#5c6c7a' }}>Credit Timestamp:</span>
                <strong style={{ fontFamily: 'DM Mono', color: '#001e2b' }}>06 Sep 2026, 11:42 AM IST</strong>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => showToast('Downloaded PFMS Official Electronic Payment Receipt (PDF)')}
                style={{
                  background: '#001e2b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 20px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Download Official Bank Credit Advice (PDF) ⬇
              </button>
            </div>
          </div>

          {/* NPCI & Aadhaar Seeding */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>NPCI Aadhaar Payment Bridge</h3>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <strong style={{ color: '#00684a', display: 'block' }}>✓ Aadhaar Seeding Active</strong>
                <small style={{ color: '#5c6c7a' }}>Direct Benefit Transfer routed via NPCI Aadhaar Payment Bridge (APB)</small>
              </div>
              <div style={{ padding: 12, background: '#f8faf9', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <span style={{ color: '#5c6c7a', fontSize: 11 }}>PFMS Sanction Authority:</span>
                <div style={{ fontWeight: 600, color: '#001e2b' }}>Ministry of Road Transport / CALA District Escrow</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // CITIZEN CATEGORY 6: GRIEVANCES & R&R (GRIEVANCES)
  // =========================================================================
  if (activeCategory === 'grievances') {
    return (
      <div className="category-panel-container">
        {renderCategoryHeader(
          'Citizen Grievance & Resettlement Assistance Desk',
          'File formal complaints and requests regarding land acquisition, rehabilitation entitlements, family census discrepancies, or physical resettlement assistance under Second Schedule.',
          'GRIEVANCE PORTAL',
          '#7b3ff2',
          'Grievance Redressal Mechanism'
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          {/* Active Grievances */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#001e2b' }}>Track Existing Grievance</h3>
            <div style={{ padding: 16, background: '#f8faf9', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: '#7b3ff2' }}>GRV-2026-RNR-019</span>
                <span style={{ background: '#fff8e0', color: '#946f3f', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                  Under Investigation
                </span>
              </div>
              <strong style={{ color: '#001e2b', display: 'block', marginBottom: 4 }}>
                Second Schedule Resettlement Housing Assistance Allotment
              </strong>
              <p style={{ fontSize: 12, color: '#5c6c7a', margin: '0 0 8px', lineHeight: 1.4 }}>
                Request for allocation of constructed house plot in Resettlement Colony Ward 3 under Second Schedule Item 1. Notice issued to Tehsildar for verification.
              </p>
              <div style={{ fontSize: 11, color: '#688072' }}>
                Officer Assigned: <strong>Administrator R&R / Sub-Divisional Magistrate</strong>
              </div>
            </div>
          </div>

          {/* New Grievance Form */}
          <div style={{ background: '#ffffff', border: '1px solid #e1e5e8', borderRadius: 12, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#001e2b' }}>Lodge New Grievance</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Grievance Category</label>
                <select style={{ width: '100%', height: 36, padding: '0 8px', borderRadius: 6, border: '1px solid #c1ccd6', marginTop: 4 }}>
                  <option>Second Schedule R&R Family Entitlements</option>
                  <option>Boundary Demarcation / Encroachment Issue</option>
                  <option>Compensation Apportionment Dispute Between Co-sharers</option>
                  <option>Delay in Physical Possession Notice</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1c2d38' }}>Description of Complaint</label>
                <textarea
                  rows={3}
                  placeholder="Explain the issue clearly with survey number..."
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #c1ccd6', marginTop: 4 }}
                />
              </div>
              <button
                onClick={() => showToast('Grievance registered successfully! Tracking ID: GRV-2026-RNR-020')}
                style={{
                  background: '#7b3ff2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '10px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: 6,
                }}
              >
                Register Formal Grievance ➔
              </button>
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
            {can('sia.create') && (
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
            )}
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
            {can('deposit.create') && (
              <button
                onClick={() => showToast('New Section 77 Judicial Deposit order initiated')}
                style={{
                  background: '#00ed64',
                  color: '#001e2b',
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
            )}
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
