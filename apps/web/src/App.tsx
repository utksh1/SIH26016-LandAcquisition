import { useMemo, useState } from 'react'
import { kpis, notices, projects, selectedProject, workflow, type Language, type Project, type Role } from './api/mockData'

type IconName = 'grid' | 'folder' | 'map' | 'people' | 'shield' | 'search' | 'bell' | 'arrow' | 'chevron' | 'calendar' | 'more' | 'download' | 'close' | 'check'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'grid': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
    case 'folder': return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" /><path d="M3 10h18" /></svg>
    case 'map': return <svg {...common}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></svg>
    case 'people': return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a2.5 2.5 0 0 1 0 5M17 14a4.5 4.5 0 0 1 4 5" /></svg>
    case 'shield': return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.7 4.7" /></svg>
    case 'bell': return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>
    case 'arrow': return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
    case 'chevron': return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>
    case 'calendar': return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 9h18" /></svg>
    case 'more': return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
    case 'download': return <svg {...common}><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></svg>
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>
    case 'check': return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>
  }
}

const mvpRoles: Role[] = ['Admin', 'Collector', 'Revenue Officer', 'Land Owner']

const roleIcons: Record<Role, IconName> = {
  Admin: 'shield',
  Collector: 'folder',
  'Revenue Officer': 'map',
  'Land Owner': 'people',
}

type RoleCopy = {
  description: string
  accountName: string
  initials: string
  publicTitle: string
  publicBody: string
  gateAction: string
  gateTitle: string
  gateDetail: string
}

const roleCopy: Record<Role, Record<Language, RoleCopy>> = {
  Admin: {
    en: {
      description: 'National administration view · 42 projects across 18 states',
      accountName: 'Ananya Sen',
      initials: 'AS',
      publicTitle: 'Public access desk',
      publicBody: 'Give landowners a clear view of their survey and compensation status.',
      gateAction: 'Review gate',
      gateTitle: 'Approve compensation award pack',
      gateDetail: '12 of 18 village packets ready · Collector sign-off required',
    },
    hi: {
      description: 'राष्ट्रीय प्रशासन दृश्य · 18 राज्यों में 42 परियोजनाएं',
      accountName: 'अनन्या सेन',
      initials: 'अस',
      publicTitle: 'जनता सहायता डेस्क',
      publicBody: 'भूमि मालिकों को सर्वे और मुआवज़े की स्पष्ट जानकारी दें।',
      gateAction: 'गेट की समीक्षा करें',
      gateTitle: 'मुआवज़ा पुरस्कार पैक स्वीकृत करें',
      gateDetail: '18 में से 12 गांव पैकेट तैयार · कलेक्टर की स्वीकृति आवश्यक',
    },
  },
  Collector: {
    en: {
      description: 'District execution view · 14 awards awaiting sign-off',
      accountName: 'Vikram Singh',
      initials: 'VS',
      publicTitle: 'District landowner desk',
      publicBody: 'Keep landowners updated on survey and compensation progress.',
      gateAction: 'Review gate',
      gateTitle: 'Approve compensation award pack',
      gateDetail: '12 of 18 village packets ready · your sign-off is required',
    },
    hi: {
      description: 'जिला निष्पादन दृश्य · 14 पुरस्कार स्वीकृति की प्रतीक्षा में',
      accountName: 'विक्रम सिंह',
      initials: 'विस',
      publicTitle: 'जिला भूमि मालिक डेस्क',
      publicBody: 'भूमि मालिकों को सर्वे और मुआवज़े की प्रगति से अपडेट रखें।',
      gateAction: 'गेट की समीक्षा करें',
      gateTitle: 'मुआवज़ा पुरस्कार पैक स्वीकृत करें',
      gateDetail: '18 में से 12 गांव पैकेट तैयार · आपकी स्वीकृति आवश्यक',
    },
  },
  'Revenue Officer': {
    en: {
      description: 'Revenue coordination view · 38 records due for verification',
      accountName: 'Neha Sharma',
      initials: 'NS',
      publicTitle: 'Revenue register desk',
      publicBody: 'Reconcile survey records before compensation moves to the next gate.',
      gateAction: 'Verify records',
      gateTitle: 'Verify compensation award pack',
      gateDetail: '12 of 18 village packets ready · revenue record verification required',
    },
    hi: {
      description: 'राजस्व समन्वय दृश्य · 38 रिकॉर्ड सत्यापन के लिए लंबित',
      accountName: 'नेहा शर्मा',
      initials: 'नेश',
      publicTitle: 'राजस्व रजिस्टर डेस्क',
      publicBody: 'मुआवज़ा अगले चरण में जाने से पहले सर्वे रिकॉर्ड का मिलान करें।',
      gateAction: 'रिकॉर्ड सत्यापित करें',
      gateTitle: 'मुआवज़ा पुरस्कार पैक सत्यापित करें',
      gateDetail: '18 में से 12 गांव पैकेट तैयार · राजस्व रिकॉर्ड सत्यापन आवश्यक',
    },
  },
  'Land Owner': {
    en: {
      description: 'Landowner transparency view · 12,482 records available',
      accountName: 'Suresh Kumar',
      initials: 'SK',
      publicTitle: 'My land records',
      publicBody: 'Check your survey and compensation status, or raise a grievance.',
      gateAction: 'View award status',
      gateTitle: 'View compensation award status',
      gateDetail: '12 of 18 village packets ready · updates are available in the public register',
    },
    hi: {
      description: 'भूमि मालिक पारदर्शिता दृश्य · 12,482 रिकॉर्ड उपलब्ध',
      accountName: 'सुरेश कुमार',
      initials: 'सु कु',
      publicTitle: 'मेरे भूमि रिकॉर्ड',
      publicBody: 'अपने सर्वे और मुआवज़े की स्थिति देखें या शिकायत दर्ज करें।',
      gateAction: 'पुरस्कार की स्थिति देखें',
      gateTitle: 'मुआवज़ा पुरस्कार की स्थिति देखें',
      gateDetail: '18 में से 12 गांव पैकेट तैयार · अपडेट सार्वजनिक रजिस्टर में उपलब्ध हैं',
    },
  },
}

const projectOwnerLabels: Record<string, Role> = {
  'District / CALA': 'Collector',
  'Project agency': 'Admin',
  'R&R Administrator': 'Collector',
  'State Revenue Dept.': 'Revenue Officer',
}

const translations = {
  en: {
    eyebrow: 'LAND ACQUISITION COMMAND CENTRE',
    title: 'Good morning, Ananya.',
    subtitle: 'Here is the pulse of your land portfolio across the country.',
    activeProjects: 'Active projects',
    projects: 'Projects',
    overview: 'Overview',
    fieldOps: 'Field operations',
    stakeholders: 'Stakeholders',
    compliance: 'Compliance & audit',
    allProjects: 'All projects',
    portfolio: 'Portfolio at a glance',
    attention: 'Needs your attention',
    selected: 'Selected project',
    progress: 'Statutory progress',
    gate: 'Next gate',
    parcels: 'parcels',
    publicTitle: 'Public access desk',
    publicBody: 'Give landowners a clear view of their survey and compensation status.',
    lookup: 'Look up a survey number',
    lookupPlaceholder: 'e.g. BH-48-1042',
    find: 'Find record',
    grievance: 'Raise a grievance',
    mapTitle: 'Parcel view',
  },
  hi: {
    eyebrow: 'भूमि अधिग्रहण कमांड सेंटर',
    title: 'सुप्रभात, अनन्या।',
    subtitle: 'देशभर में आपके भूमि पोर्टफोलियो की स्थिति यहां है।',
    activeProjects: 'सक्रिय परियोजनाएं',
    projects: 'परियोजनाएं',
    overview: 'अवलोकन',
    fieldOps: 'क्षेत्र संचालन',
    stakeholders: 'हितधारक',
    compliance: 'अनुपालन और ऑडिट',
    allProjects: 'सभी परियोजनाएं',
    portfolio: 'पोर्टफोलियो एक नज़र में',
    attention: 'आपका ध्यान आवश्यक',
    selected: 'चयनित परियोजना',
    progress: 'वैधानिक प्रगति',
    gate: 'अगला चरण',
    parcels: 'पार्सल',
    publicTitle: 'जनता सहायता डेस्क',
    publicBody: 'भूमि मालिकों को सर्वे और मुआवज़े की स्पष्ट जानकारी दें।',
    lookup: 'सर्वे नंबर खोजें',
    lookupPlaceholder: 'जैसे BH-48-1042',
    find: 'रिकॉर्ड खोजें',
    grievance: 'शिकायत दर्ज करें',
    mapTitle: 'पार्सल दृश्य',
  },
} as const

function StatusPill({ status }: { status: Project['status'] }) {
  const className = status.toLowerCase().replace(' ', '-')
  return <span className={`status-pill ${className}`}><span className="status-dot" />{status}</span>
}

function App() {
  const [role, setRole] = useState<Role>('Admin')
  const [language, setLanguage] = useState<Language>('en')
  const [selected, setSelected] = useState<Project>(selectedProject)
  const [query, setQuery] = useState('')
  const [lookupMessage, setLookupMessage] = useState('')
  const [grievanceSent, setGrievanceSent] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const t = translations[language]

  const roleDescription = useMemo(() => roleCopy[role][language].description, [role, language])

  const handleLookup = () => {
    if (!query.trim()) {
      setLookupMessage('Enter a survey number to search the public register.')
      return
    }
    setLookupMessage(`Record ${query.trim().toUpperCase()} found · award status is being verified.`)
  }

  return (
    <div className="app-shell">
      <aside className={`side-nav ${showMobileNav ? 'nav-open' : ''}`} aria-label="Primary navigation">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>L</span><i /></div>
          <div><strong>LandFlow</strong><span>SIH26016 / v2.4</span></div>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setShowMobileNav(false)}><Icon name="close" size={20} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-links">
          <button className="nav-link active"><Icon name="grid" /><span>{t.overview}</span><b>01</b></button>
          <button className="nav-link"><Icon name="folder" /><span>{t.projects}</span><b>42</b></button>
          <button className="nav-link"><Icon name="map" /><span>{t.fieldOps}</span><b>08</b></button>
          <button className="nav-link"><Icon name="people" /><span>{t.stakeholders}</span></button>
          <button className="nav-link"><Icon name="shield" /><span>{t.compliance}</span><b>03</b></button>
        </nav>
        <div className="nav-bottom">
          <div className="system-status"><span className="pulse" />All systems operational<div>Last sync 08:42 IST</div></div>
          <button className="user-card" aria-label="Open account menu"><span className="avatar">AS</span><span><strong>Ananya Sen</strong><small>Central Ministry</small></span><Icon name="chevron" size={15} /></button>
        </div>
      </aside>
      {showMobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setShowMobileNav(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setShowMobileNav(true)}><span /><span /><span /></button>
          <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{t.overview}</strong></div>
          <div className="topbar-actions">
            <button className="date-chip"><Icon name="calendar" size={16} />06 Sep 2026</button>
            <button className="icon-button notification" aria-label="Notifications"><Icon name="bell" size={19} /><i>3</i></button>
            <button className="language-toggle" onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')} aria-label={`Switch language to ${language === 'en' ? 'Hindi' : 'English'}`}><span className={language === 'en' ? 'chosen' : ''}>EN</span><span className={language === 'hi' ? 'chosen' : ''}>हि</span></button>
          </div>
        </header>

        <div className="page-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" />{t.eyebrow}</p>
              <h1>{t.title}</h1>
              <p className="welcome-copy">{t.subtitle}</p>
            </div>
            <div className="sync-card"><span className="sync-orbit"><span /></span><div><strong>Live oversight</strong><small>Updated 8 min ago</small></div><button aria-label="Refresh data"><Icon name="arrow" size={16} /></button></div>
          </section>

          <section className="role-strip" aria-labelledby="role-heading">
            <div className="role-label"><span id="role-heading">VIEW AS</span><small>{roleDescription}</small></div>
            <div className="role-options" role="tablist" aria-label="Switch dashboard role">
              {(Object.keys(roleIcons) as Role[]).map((item) => <button key={item} className={`role-option ${role === item ? 'active' : ''}`} role="tab" aria-selected={role === item} onClick={() => setRole(item)}><Icon name={roleIcons[item]} size={16} />{item}</button>)}
            </div>
          </section>

          <section className="kpi-grid" aria-label="Portfolio metrics">
            {kpis.map((kpi) => <article className={`kpi-card ${kpi.tone}`} key={kpi.label}><div className="kpi-top"><span>{kpi.label}</span><span className="kpi-icon">{kpi.icon}</span></div><strong>{kpi.value}</strong><p><span className="trend">↗</span>{kpi.delta}</p></article>)}
          </section>

          <section className="content-grid">
            <div className="primary-column">
              <section className="panel project-panel">
                <div className="panel-heading"><div><p className="section-kicker">{t.portfolio}</p><h2>{t.projects} <span>· 18 states</span></h2></div><button className="quiet-button">{t.allProjects}<Icon name="arrow" size={15} /></button></div>
                <div className="project-list" role="list">
                  {projects.map((project) => <button role="listitem" className={`project-row ${selected.id === project.id ? 'selected' : ''}`} key={project.id} onClick={() => setSelected(project)}><div className="project-tag">{project.id.split('-')[0]}</div><div className="project-main"><strong>{project.name}</strong><span>{project.location} <i>·</i> {project.code}</span></div><div className="project-stat"><strong>{project.acquired.toLocaleString()} <small>/ {project.parcels.toLocaleString()}</small></strong><span>{t.parcels}</span></div><div className="project-stage"><span>{project.stage}</span><div className="mini-progress"><i style={{ width: `${Math.round((project.acquired / project.parcels) * 100)}%` }} /></div></div><StatusPill status={project.status} /><Icon name="chevron" size={17} /></button>)}
                </div>
              </section>

              <section className="panel detail-panel">
                <div className="detail-heading"><div><p className="section-kicker">{t.selected} · {selected.code}</p><h2>{selected.name}</h2><p className="muted"><span className="location-pin">⌖</span>{selected.location} <span className="separator">/</span> {selected.owner}</p></div><div className="heading-actions"><StatusPill status={selected.status} /><button className="icon-button" aria-label="More project actions"><Icon name="more" /></button></div></div>
                <div className="detail-meta"><div><span>PROJECT VALUE</span><strong>{selected.amount}</strong></div><div><span>LAND PARCELS</span><strong>{selected.parcels.toLocaleString()}</strong></div><div><span>ACQUIRED</span><strong>{Math.round((selected.acquired / selected.parcels) * 100)}%</strong></div><div><span>NEXT DUE</span><strong>{selected.due}</strong></div></div>
                <div className="progress-heading"><div><p className="section-kicker">{t.progress}</p><span>Statutory workflow sequence</span></div><button className="quiet-button"><Icon name="download" size={15} />Export trail</button></div>
                <div className="workflow" aria-label="Project workflow progress">
                  {workflow.map((stage, index) => <div className={`workflow-step ${stage.state}`} key={stage.name}><div className="step-marker">{stage.state === 'complete' ? <Icon name="check" size={13} /> : <span>{index + 1}</span>}</div><div className="step-label"><strong>{stage.name}</strong><small>{stage.date ?? 'Queued'}</small></div>{index < workflow.length - 1 && <div className="step-line" />}</div>)}
                </div>
                <div className="gate-banner"><div className="gate-symbol">04</div><div><span>{t.gate} · 18 SEP 2026</span><strong>Approve compensation award pack</strong><p>12 of 18 village packets ready · CALA sign-off required</p></div><button className="primary-button">Review gate <Icon name="arrow" size={15} /></button></div>
              </section>

              <div className="lower-grid">
                <section className="panel map-panel"><div className="panel-heading"><div><p className="section-kicker">FIELD VIEW · BHARATPUR</p><h2>{t.mapTitle}</h2></div><button className="quiet-button">Open GIS <Icon name="arrow" size={15} /></button></div><div className="map-canvas"><svg viewBox="0 0 760 280" role="img" aria-label="Stylized map of surveyed land parcels"><defs><pattern id="grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#c7d4c8" strokeWidth=".7" /></pattern><filter id="soft-shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".12" /></filter></defs><rect width="760" height="280" fill="#e7eee3" /><rect width="760" height="280" fill="url(#grid-pattern)" opacity=".7" /><path d="M0 190 C110 144 157 238 260 189s139-4 210-64 170-71 290-14v169H0Z" fill="#d2e3d0" /><path d="M-20 220 C92 174 145 248 252 195s151 0 234-66 171-66 301-11" fill="none" stroke="#fdfbf2" strokeWidth="15" opacity=".9" /><path d="M-20 220 C92 174 145 248 252 195s151 0 234-66 171-66 301-11" fill="none" stroke="#c99b51" strokeWidth="2" strokeDasharray="6 5" /><g filter="url(#soft-shadow)"><path d="M89 80 185 46l38 83-110 40-24-47Z" fill="#e8bd70" stroke="#8c7143" strokeWidth="2" /><path d="m185 46 68 17 18 90-48-24Z" fill="#f4d991" stroke="#8c7143" strokeWidth="2" /><path d="m271 63 89-20 25 89-84 21Z" fill="#b8d6b8" stroke="#668d6a" strokeWidth="2" /><path d="m360 43 86 22 35 81-96-14Z" fill="#d6e9cc" stroke="#668d6a" strokeWidth="2" /><path d="m481 78 83-42 45 79-93 31Z" fill="#e8bd70" stroke="#8c7143" strokeWidth="2" /><path d="m564 36 88 16 31 69-85-6Z" fill="#f4d991" stroke="#8c7143" strokeWidth="2" /><path d="m110 174 113-45 48 61-86 51Z" fill="#b8d6b8" stroke="#668d6a" strokeWidth="2" /><path d="m223 129 84 27 35 68-81-34Z" fill="#d6e9cc" stroke="#668d6a" strokeWidth="2" /><path d="m307 156 84-24 40 62-79 30Z" fill="#f4d991" stroke="#8c7143" strokeWidth="2" /><path d="m391 132 96 14 40 56-100-8Z" fill="#b8d6b8" stroke="#668d6a" strokeWidth="2" /></g><g fontFamily="DM Sans, sans-serif" fontSize="11" fontWeight="700" fill="#536a5b"><text x="130" y="105">1042</text><text x="216" y="91">1043</text><text x="303" y="98">1044</text><text x="400" y="101">1045</text><text x="512" y="91">1046</text><text x="594" y="78">1047</text><text x="158" y="201">1051</text><text x="248" y="180">1052</text><text x="340" y="183">1053</text><text x="427" y="167">1054</text></g><g transform="translate(665 210)"><circle r="18" fill="#10251f" /><path d="M0-9v18M-9 0h18" stroke="#f5f2e8" strokeWidth="1.5" /><text x="-4" y="-26" fill="#10251f" fontSize="10" fontWeight="700">N</text></g></svg><div className="map-legend"><span><i className="legend-acquired" />Acquired</span><span><i className="legend-review" />Under review</span><span><i className="legend-road" />Right of way</span></div><div className="map-zoom"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button></div></div></section>
                <section className="panel public-panel"><div className="public-top"><div className="public-icon"><Icon name="people" size={20} /></div><span className="live-label"><i />PUBLIC PORTAL</span></div><p className="section-kicker">{t.publicTitle}</p><h2>{t.publicBody}</h2><label htmlFor="survey-lookup">{t.lookup}</label><div className="lookup-field"><Icon name="search" size={16} /><input id="survey-lookup" value={query} onChange={(event) => { setQuery(event.target.value); setLookupMessage('') }} onKeyDown={(event) => { if (event.key === 'Enter') handleLookup() }} placeholder={t.lookupPlaceholder} /><button onClick={handleLookup}>{t.find}</button></div>{lookupMessage && <p className="lookup-message" role="status">{lookupMessage}</p>}<div className="public-divider" /><button className="grievance-link" onClick={() => setGrievanceSent(true)}>{grievanceSent ? <><Icon name="check" size={15} />Grievance desk notified</> : <>{t.grievance}<Icon name="arrow" size={15} /></>}</button></section>
              </div>
            </div>

            <aside className="secondary-column">
              <section className="panel attention-panel"><div className="panel-heading"><div><p className="section-kicker">LIVE QUEUE</p><h2>{t.attention}</h2></div><span className="queue-count">03</span></div><div className="notice-list">{notices.map((notice) => <article className="notice" key={notice.title}><div className={`notice-icon ${notice.tone}`}><span>{notice.tone === 'coral' ? '!' : notice.tone === 'mint' ? '₹' : '◷'}</span></div><div><span className="notice-label">{notice.label}</span><h3>{notice.title}</h3><p>{notice.detail}</p></div><button aria-label={`Open ${notice.title}`}><Icon name="chevron" size={16} /></button></article>)}</div><button className="full-queue">View all queue items <Icon name="arrow" size={15} /></button></section>
              <section className="panel timeline-panel"><div className="panel-heading"><div><p className="section-kicker">ACTIVITY TRAIL</p><h2>Recent movement</h2></div><button className="icon-button" aria-label="More activity"><Icon name="more" /></button></div><div className="activity-list"><div className="activity-item"><span className="activity-avatar mint">RK</span><p><strong>Rakesh Kumar</strong> approved <b>₹12.8 Cr</b> for NH-48 awards<small>8 min ago · PFMS controller</small></p></div><div className="activity-item"><span className="activity-avatar gold">SG</span><p><strong>Survey team 08</strong> uploaded 46 boundary points<small>41 min ago · Bharatpur field ops</small></p></div><div className="activity-item"><span className="activity-avatar blue">AM</span><p><strong>Aditi Mehra</strong> opened a new R&R case<small>2 hrs ago · Kushinagar</small></p></div><div className="activity-item"><span className="activity-avatar coral">NS</span><p><strong>Notice window</strong> closes for 3 villages<small>Yesterday · State Revenue Dept.</small></p></div></div><button className="full-queue">View audit trail <Icon name="arrow" size={15} /></button></section>
              <section className="quote-card"><div className="quote-mark">“</div><p>Every parcel has a person behind it. Keep the record clear, the process fair.</p><span>— LandFlow operating principle</span></section>
            </aside>
          </section>
          <footer className="page-footer"><span>LandFlow · Government of India workflow cockpit</span><span><i className="footer-dot" />Data is mock data for demonstration</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
