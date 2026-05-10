import type {
  CompanyBrainWorkspaceSlice,
  CompanyBrandKit,
  DeckIntel,
  DeckSetup,
  DeckThemeProfile,
  DeckVisualDirection,
  Slide,
  SlideBlock,
  SlideDesignIntent,
  SlideRole,
  SlideTextStyle,
  SlideTransition,
  SlideTransitionType,
  SlideVisualPriority,
} from '../types/models.ts'
import { createId } from '../utils/ids.ts'

/**
 * Built-in theme profiles for the local-only design engine.
 * No AI / paid APIs — everything below is data + heuristics so generated decks remain editable.
 */
export const BUILTIN_THEME_PROFILES: DeckThemeProfile[] = [
  {
    id: 'executive-graphite',
    name: 'Executive graphite',
    description: 'High-contrast, generous whitespace for executive briefings.',
    mood: 'executive',
    primaryColor: '#0F172A',
    secondaryColor: '#334155',
    accentColor: '#2457E0',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 6,
    cardStyle: 'soft-shadow',
    chartStyle: 'executive',
    visualDensity: 'light',
  },
  {
    id: 'premium-noir',
    name: 'Premium noir',
    description: 'Quiet luxury for board / sponsor / executive proposals.',
    mood: 'premium',
    primaryColor: '#111418',
    secondaryColor: '#4B5563',
    accentColor: '#9F8456',
    backgroundColor: '#FAF8F4',
    textColor: '#111418',
    mutedTextColor: '#6B7280',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 4,
    cardStyle: 'flat',
    chartStyle: 'muted',
    visualDensity: 'light',
  },
  {
    id: 'minimal-paper',
    name: 'Minimal paper',
    description: 'Cleanest possible canvas; reads like a polished memo.',
    mood: 'minimal',
    primaryColor: '#111827',
    secondaryColor: '#374151',
    accentColor: '#2457E0',
    backgroundColor: '#FFFFFF',
    textColor: '#111827',
    mutedTextColor: '#4B5563',
    fontFamily: 'Inter',
    borderRadius: 4,
    cardStyle: 'flat',
    chartStyle: 'clean',
    visualDensity: 'light',
  },
  {
    id: 'modern-azure',
    name: 'Modern azure',
    description: 'Friendly, modern product/sales decks.',
    mood: 'modern',
    primaryColor: '#1E3A8A',
    secondaryColor: '#1F2937',
    accentColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    fontFamily: 'Inter',
    borderRadius: 8,
    cardStyle: 'soft-shadow',
    chartStyle: 'clean',
    visualDensity: 'balanced',
  },
  {
    id: 'technical-slate',
    name: 'Technical slate',
    description: 'Dense, precise, evidence-heavy technical narratives.',
    mood: 'technical',
    primaryColor: '#0B3954',
    secondaryColor: '#1F2937',
    accentColor: '#0AA1B3',
    backgroundColor: '#F5F7FA',
    textColor: '#111827',
    mutedTextColor: '#475569',
    fontFamily: 'Inter',
    borderRadius: 6,
    cardStyle: 'bordered',
    chartStyle: 'clean',
    visualDensity: 'dense',
  },
  {
    id: 'bold-spotlight',
    name: 'Bold spotlight',
    description: 'Confident sales proposal deck with strong accent moments.',
    mood: 'bold',
    primaryColor: '#0F172A',
    secondaryColor: '#1E293B',
    accentColor: '#F97316',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    fontFamily: 'Inter',
    borderRadius: 8,
    cardStyle: 'soft-shadow',
    chartStyle: 'bold',
    visualDensity: 'balanced',
  },
  {
    id: 'warm-earth',
    name: 'Warm earth',
    description: 'Hospitality, brand, and storytelling-led decks.',
    mood: 'warm',
    primaryColor: '#4B2E1F',
    secondaryColor: '#7B5132',
    accentColor: '#C97A3D',
    backgroundColor: '#FAF6EE',
    textColor: '#3F2A18',
    mutedTextColor: '#6F4F32',
    fontFamily: 'Inter',
    borderRadius: 10,
    cardStyle: 'soft-shadow',
    chartStyle: 'muted',
    visualDensity: 'balanced',
  },
  {
    id: 'operational-grid',
    name: 'Operational grid',
    description: 'Internal status, account reviews, and operational decks.',
    mood: 'operational',
    primaryColor: '#1F2937',
    secondaryColor: '#374151',
    accentColor: '#2457E0',
    backgroundColor: '#F8FAFC',
    textColor: '#111827',
    mutedTextColor: '#475569',
    fontFamily: 'Inter',
    borderRadius: 4,
    cardStyle: 'bordered',
    chartStyle: 'clean',
    visualDensity: 'dense',
  },
]

const DEFAULT_THEME_ID = 'modern-azure'

export function getBuiltinThemeProfile(id: string): DeckThemeProfile {
  const found = BUILTIN_THEME_PROFILES.find((profile) => profile.id === id)
  if (found) {
    return found
  }
  return BUILTIN_THEME_PROFILES.find((profile) => profile.id === DEFAULT_THEME_ID) ?? BUILTIN_THEME_PROFILES[0]
}

const PREMIUM_DECK_TYPES = new Set(['Executive briefing deck', 'Sponsor pitch deck'])

const SALES_PROPOSAL_DECK_TYPES = new Set([
  'Sales proposal deck',
  'Pilot proposal deck',
  'Renewal / expansion deck',
])

const OPERATIONAL_DECK_TYPES = new Set([
  'Client status / account review deck',
  'Discovery follow-up deck',
])

const TECHNICAL_HINTS = [
  'technical',
  'engineer',
  'platform',
  'architecture',
  'infrastructure',
  'security',
  'developer',
  'devops',
  'sre',
  'data platform',
]

const EXECUTIVE_AUDIENCE_HINTS = [
  'ceo',
  'cfo',
  'coo',
  'cio',
  'cto',
  'chief',
  'executive',
  'board',
  'vp ',
  'vp,',
  'svp',
  'evp',
  'president',
]

interface ChooseThemeProfileInput {
  deckSetup: DeckSetup
  brandKit?: CompanyBrandKit
  companyBrain?: Pick<CompanyBrainWorkspaceSlice, 'brandKits' | 'activeOrganizationId'>
  intel?: DeckIntel
}

/**
 * Heuristic theme picker. No AI calls.
 * Order: deck type → audience seniority → tone → fallback default.
 */
export function chooseThemeProfile({
  deckSetup,
  brandKit,
  intel,
}: ChooseThemeProfileInput): DeckVisualDirection {
  const deckType = (deckSetup.deckType ?? deckSetup.presentationType ?? '').trim()
  const audience = `${deckSetup.audience ?? ''} ${deckSetup.buyerPersona ?? ''}`.toLowerCase()
  const tone = (deckSetup.tone ?? '').toLowerCase()
  const intelPriorities = (intel?.inferredPriorities ?? []).join(' ').toLowerCase()
  const signalBlob = `${tone} ${audience} ${intelPriorities}`

  const audienceIsExecutive = EXECUTIVE_AUDIENCE_HINTS.some((hint) => audience.includes(hint))
  const isTechnical = TECHNICAL_HINTS.some((hint) => signalBlob.includes(hint))

  let themeProfileId = DEFAULT_THEME_ID
  let reason = 'Default modern theme for general business decks.'
  let audienceFit = audience.trim()
    ? `Audience signal: ${audience.trim()}.`
    : 'No audience signal — neutral modern framing.'
  let deckTypeFit = `Deck type "${deckType || 'unspecified'}" → neutral default.`
  let confidence = 0.55

  if (PREMIUM_DECK_TYPES.has(deckType)) {
    themeProfileId = audienceIsExecutive ? 'premium-noir' : 'executive-graphite'
    reason = audienceIsExecutive
      ? 'Premium / briefing deck for executive audience — quiet luxury palette.'
      : 'Executive briefing / sponsor deck — high-contrast executive theme.'
    audienceFit = audienceIsExecutive
      ? 'Executive — heavy whitespace, restrained chrome.'
      : 'Senior — confident, calm hierarchy.'
    deckTypeFit = 'Executive / sponsor decks favour premium or executive moods.'
    confidence = 0.82
  } else if (SALES_PROPOSAL_DECK_TYPES.has(deckType)) {
    if (audienceIsExecutive) {
      themeProfileId = 'premium-noir'
      reason = 'Sales proposal to an executive audience — premium / quiet luxury palette.'
      audienceFit = 'Executive buyer — restrained but premium accents.'
      confidence = 0.8
    } else {
      themeProfileId = 'bold-spotlight'
      reason = 'Sales / pilot / renewal proposal — confident, accent-led theme.'
      audienceFit = 'Sales buyer — strong narrative emphasis.'
      confidence = 0.75
    }
    deckTypeFit = 'Sales proposal-style decks favour bold spotlight or premium noir.'
  } else if (OPERATIONAL_DECK_TYPES.has(deckType) || deckSetup.shareSetupInputs) {
    themeProfileId = 'operational-grid'
    reason = 'Internal status / operational review — dense, scannable grid theme.'
    audienceFit = 'Operational stakeholders — fast scanning of status, blockers.'
    deckTypeFit = 'Status / discovery follow-up decks favour operational grid.'
    confidence = 0.7
  } else if (isTechnical) {
    themeProfileId = 'technical-slate'
    reason = 'Technical content / audience — dense slate theme with crisp data styling.'
    audienceFit = 'Technical reviewers — denser proof, tighter margins.'
    deckTypeFit = `Deck type "${deckType || 'technical'}" reads as technical content.`
    confidence = 0.74
  } else if (audienceIsExecutive) {
    themeProfileId = 'executive-graphite'
    reason = 'Executive audience — generous whitespace, restrained palette.'
    audienceFit = 'Executive — high signal-to-noise, calm hierarchy.'
    deckTypeFit = `Deck type "${deckType || 'general'}" wrapped in executive theme.`
    confidence = 0.7
  } else if (tone.includes('warm') || tone.includes('story') || tone.includes('hospitality')) {
    themeProfileId = 'warm-earth'
    reason = 'Warm / story-led tone — hospitable palette.'
    audienceFit = 'Brand-narrative audience.'
    deckTypeFit = `Tone hint "${tone || 'warm'}" picked the warm earth theme.`
    confidence = 0.66
  } else if (tone.includes('minimal') || tone.includes('memo')) {
    themeProfileId = 'minimal-paper'
    reason = 'Minimal / memo tone — paper-like theme.'
    audienceFit = 'Reading-first audience.'
    deckTypeFit = `Tone hint "${tone || 'minimal'}" picked minimal paper.`
    confidence = 0.64
  }

  const brandFit = brandKit
    ? `Brand kit "${brandKit.id}" colors and font merged on top of base theme.`
    : 'No Brand Kit attached — using built-in palette as fallback.'

  return {
    themeProfileId,
    reason,
    audienceFit,
    deckTypeFit,
    brandFit,
    confidence,
  }
}

function isHexColor(value?: string): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
}

interface ResolveDeckThemeInput {
  visualDirection: DeckVisualDirection
  brandKit?: CompanyBrandKit
}

/**
 * Resolve final theme by merging brand kit overrides (when present) on top of the chosen built-in profile.
 * Falls back cleanly when no Brand Kit is attached.
 */
export function resolveDeckTheme({
  visualDirection,
  brandKit,
}: ResolveDeckThemeInput): DeckThemeProfile {
  const base = getBuiltinThemeProfile(visualDirection.themeProfileId)

  if (!brandKit) {
    return base
  }

  return {
    ...base,
    primaryColor: isHexColor(brandKit.primaryColor) ? brandKit.primaryColor : base.primaryColor,
    secondaryColor: isHexColor(brandKit.secondaryColor)
      ? brandKit.secondaryColor
      : base.secondaryColor,
    accentColor: isHexColor(brandKit.accentColor) ? brandKit.accentColor : base.accentColor,
    fontFamily: brandKit.fontFamily?.trim() || base.fontFamily,
    headingFontFamily: brandKit.fontFamily?.trim() || base.headingFontFamily,
  }
}

interface SlideRoleHeuristic {
  role: SlideRole
  tokens: string[]
}

/** Title tokens are matched lowercase substring (order matters; first wins). */
const ROLE_HEURISTICS: SlideRoleHeuristic[] = [
  { role: 'agenda', tokens: ['agenda'] },
  { role: 'section-divider', tokens: ['section divider', 'divider'] },
  { role: 'case-study', tokens: ['case study', 'customer story', 'success story'] },
  { role: 'risk', tokens: ['objection', 'risk'] },
  { role: 'problem', tokens: ['problem', 'pain', 'why now', 'current state'] },
  { role: 'pricing', tokens: ['pricing', 'investment'] },
  { role: 'proposal', tokens: ['proposal', 'commercial', 'offer', 'ask'] },
  { role: 'timeline', tokens: ['timeline', 'roadmap', 'milestone'] },
  { role: 'proof', tokens: ['proof', 'evidence', 'metric', 'kpi', 'results'] },
  { role: 'solution', tokens: ['solution', 'recommendation', 'approach', 'plan', 'how it works'] },
  { role: 'next-step', tokens: ['next step', 'cta', 'decision', 'recommended next'] },
  { role: 'closing', tokens: ['close', 'thank you', 'q&a', 'questions'] },
  { role: 'insight', tokens: ['insight', 'executive summary', 'opportunity', 'context'] },
]

export function inferSlideRole(slide: Slide, index: number, totalSlides: number): SlideRole {
  if (index === 0) {
    return 'title'
  }
  if (totalSlides > 1 && index === totalSlides - 1) {
    return 'next-step'
  }
  const title = (slide.title || '').toLowerCase()
  for (const heuristic of ROLE_HEURISTICS) {
    if (heuristic.tokens.some((token) => title.includes(token))) {
      return heuristic.role
    }
  }
  return 'insight'
}

export function inferLayoutIntent(role: SlideRole, slide: Slide): string {
  const hasImage = slide.blocks.some((block) => block.type === 'visual-placeholder')
  const hasChart = slide.blocks.some((block) => block.type === 'chart-placeholder')
  const hasQuote = slide.blocks.some((block) => block.type === 'quote')

  switch (role) {
    case 'title':
      return 'title-hero'
    case 'agenda':
      return 'agenda-bullets'
    case 'problem':
      return 'problem-evidence'
    case 'insight':
      return hasChart ? 'insight-chart' : 'insight-summary'
    case 'solution':
      return hasImage ? 'solution-visual' : 'solution-overview'
    case 'proof':
      return hasChart ? 'proof-chart' : 'proof-grid'
    case 'case-study':
      return hasQuote ? 'case-study-quote' : 'case-study-spotlight'
    case 'proposal':
      return 'proposal-commercial'
    case 'risk':
      return 'risk-mitigation'
    case 'timeline':
      return 'timeline-track'
    case 'pricing':
      return 'pricing-tiers'
    case 'next-step':
      return 'cta-decision'
    case 'closing':
      return 'closing-summary'
    case 'section-divider':
      return 'section-divider'
  }
}

export function inferVisualPriority(slide: Slide, role: SlideRole): SlideVisualPriority {
  const hasChart = slide.blocks.some((block) => block.type === 'chart-placeholder')
  const hasImage = slide.blocks.some((block) => block.type === 'visual-placeholder')
  const hasQuote = slide.blocks.some((block) => block.type === 'quote')
  const hasStat = slide.blocks.some((block) => block.type === 'stat')

  if (hasChart) {
    return 'chart'
  }
  if (role === 'case-study') {
    return 'proof'
  }
  if (role === 'proof') {
    return hasStat ? 'metric' : 'proof'
  }
  if (role === 'timeline') {
    return 'timeline'
  }
  if (hasStat) {
    return 'metric'
  }
  if (hasImage) {
    return 'image'
  }
  if (hasQuote) {
    return 'quote'
  }
  return 'text'
}

function makeTransition(
  type: SlideTransitionType,
  reason: string,
  durationMs: number,
): SlideTransition {
  const easing =
    type === 'zoom'
      ? 'cubic-bezier(0.22, 1, 0.36, 1)'
      : type === 'section-break'
        ? 'cubic-bezier(0.65, 0, 0.35, 1)'
        : 'cubic-bezier(0.4, 0, 0.2, 1)'

  return {
    id: createId('transition'),
    type,
    durationMs,
    easing,
    reason,
  }
}

/**
 * Decide subtle, professional transitions for each slide based on role flow.
 * Designed for editor PresentMode — no gimmicky animations.
 */
export function buildSlideTransitions(designIntents: SlideDesignIntent[]): SlideDesignIntent[] {
  return designIntents.map((intent, index) => {
    const previous = designIntents[index - 1]
    let transitionIn: SlideTransition

    if (intent.role === 'title' || intent.role === 'section-divider') {
      transitionIn = makeTransition('section-break', `${intent.role} opens a new section`, 320)
    } else if (previous?.role === 'problem' && intent.role === 'solution') {
      transitionIn = makeTransition('reveal', 'Problem → solution reveal', 320)
    } else if (
      previous?.role === 'proof' &&
      (intent.role === 'proposal' || intent.role === 'pricing')
    ) {
      transitionIn = makeTransition('push', 'Proof → proposal hand-off', 260)
    } else if (intent.role === 'next-step' || intent.role === 'closing') {
      transitionIn = makeTransition('zoom', 'Final CTA — subtle zoom emphasis', 320)
    } else if (intent.role === 'agenda') {
      transitionIn = makeTransition('fade', 'Agenda fade-in', 240)
    } else if (intent.role === 'case-study') {
      transitionIn = makeTransition('reveal', 'Case study reveal', 280)
    } else {
      transitionIn = makeTransition('fade', 'Default professional transition', 220)
    }

    const transitionOut: SlideTransition = makeTransition('fade', 'Exit fade', 180)

    return {
      ...intent,
      transitionIn,
      transitionOut,
    }
  })
}

/**
 * Apply theme styles to a slide's blocks without removing existing colors or rewriting structure.
 * - Title gets primaryColor (when no color set)
 * - Eyebrow / stat / quote get accentColor (when no color set)
 * - Body gets mutedTextColor (when no color set)
 * - fontFamily is filled in if missing
 * - Placeholder blocks (visual/chart/shape) are left alone (their visual styles are managed elsewhere)
 * Returns a new Slide; original block ids are preserved so editor refs stay stable.
 */
export function applyThemeToSlideBlocks(
  slide: Slide,
  theme: DeckThemeProfile,
  intent: SlideDesignIntent,
): Slide {
  // `intent` is accepted for API symmetry and future per-role styling rules.
  void intent
  return {
    ...slide,
    blocks: slide.blocks.map((block) => applyThemeToBlock(block, theme)),
  }
}

function applyThemeToBlock(block: SlideBlock, theme: DeckThemeProfile): SlideBlock {
  if (block.type === 'shape') {
    return block
  }
  if (block.type === 'visual-placeholder' || block.type === 'chart-placeholder') {
    return block
  }

  const existingTextStyle: Partial<SlideTextStyle> = block.textStyle ?? {}
  const inferredColor =
    existingTextStyle.color ?? defaultColorForBlockType(block.type, theme)
  const inferredFontFamily =
    typeof existingTextStyle.fontFamily === 'string' && existingTextStyle.fontFamily.trim()
      ? existingTextStyle.fontFamily
      : block.type === 'title'
        ? theme.headingFontFamily ?? theme.fontFamily
        : theme.fontFamily

  return {
    ...block,
    textStyle: {
      ...(existingTextStyle as SlideTextStyle),
      fontFamily: inferredFontFamily,
      color: inferredColor,
    } as SlideTextStyle,
  }
}

function defaultColorForBlockType(
  type: SlideBlock['type'],
  theme: DeckThemeProfile,
): string | undefined {
  switch (type) {
    case 'title':
      return theme.primaryColor
    case 'eyebrow':
    case 'stat':
      return theme.accentColor
    case 'quote':
      return theme.accentColor
    case 'body':
      return theme.mutedTextColor
    case 'bullet-list':
      return theme.textColor
    default:
      return theme.textColor
  }
}

export interface DeckDesignEngineInput {
  slides: Slide[]
  deckSetup: DeckSetup
  brandKit?: CompanyBrandKit
  companyBrain?: Pick<CompanyBrainWorkspaceSlice, 'brandKits' | 'activeOrganizationId'>
  intel?: DeckIntel
}

export interface DeckDesignEngineResult {
  slides: Slide[]
  theme: DeckThemeProfile
  visualDirection: DeckVisualDirection
  designIntents: SlideDesignIntent[]
}

/**
 * Top-level entry point: pick theme, build intents + transitions, and apply theme to blocks.
 * Returns a new slides array with `designIntent` attached and theme styles merged into block textStyles.
 *
 * Existing block content, layout, ids, and source traces are preserved.
 */
export function runDeckDesignEngine(input: DeckDesignEngineInput): DeckDesignEngineResult {
  const visualDirection = chooseThemeProfile({
    deckSetup: input.deckSetup,
    brandKit: input.brandKit,
    companyBrain: input.companyBrain,
    intel: input.intel ?? input.deckSetup.intel,
  })
  const theme = resolveDeckTheme({ visualDirection, brandKit: input.brandKit })

  const baseIntents: SlideDesignIntent[] = input.slides.map((slide, index) => {
    const role = inferSlideRole(slide, index, input.slides.length)
    return {
      slideId: slide.id,
      role,
      layoutIntent: inferLayoutIntent(role, slide),
      visualPriority: inferVisualPriority(slide, role),
    }
  })

  const designIntents = buildSlideTransitions(baseIntents)

  const slides = input.slides.map((slide, index) => {
    const intent = designIntents[index]
    if (!intent) {
      return slide
    }
    const themed = applyThemeToSlideBlocks(slide, theme, intent)
    return { ...themed, designIntent: intent }
  })

  return {
    slides,
    theme,
    visualDirection,
    designIntents,
  }
}
