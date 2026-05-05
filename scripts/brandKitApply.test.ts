import assert from 'node:assert/strict'
import {
  resolveBrandGenerationContext,
  resolveBrandKitForDeckSetup,
  svgBrandGlyphDataUrl,
} from '../src/data/brandKitResolve.ts'
import { createSlidesFromDeck } from '../src/data/deckGenerator.ts'
import type { CompanyBrandKit, Deck, Organization } from '../src/types/models.ts'

const kit: CompanyBrandKit = {
  id: 'bk-test',
  organizationId: 'org-test',
  logoAssetId: undefined,
  primaryColor: '#112233',
  secondaryColor: '#445566',
  accentColor: '#ff00aa',
  fontFamily: 'Georgia',
  defaultDeckTone: 'Concise',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const orgAcme: Organization = {
  id: 'org-test',
  name: 'Acme Labs',
  slug: 'acme-labs',
  createdByUserId: 'user-test',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const companyBrain = {
  activeOrganizationId: 'org-test',
  brandKits: [kit],
  organizations: [orgAcme],
}

function minimalDeck(brandKitId?: string): Deck {
  return {
    id: 'deck-test',
    projectId: 'proj-test',
    title: 'Quarterly pitch',
    status: 'draft',
    updatedAt: '2026-01-02',
    slideIds: [],
    fileAssetIds: [],
    setup: {
      goal: 'Close the renewal',
      audience: 'Economic buyer',
      tone: 'Confident',
      presentationType: 'Renewal / expansion deck',
      requiredSections: ['Recap', 'Plan'],
      notes: '',
      webResearch: false,
      usePreviousDeckContext: false,
      shareSetupInputs: false,
      brandKitId,
    },
    collaboration: {
      isShared: false,
      access: 'comment-only',
      allowCollaboratorUploads: false,
    },
  }
}

assert.ok(svgBrandGlyphDataUrl('Acme Labs', '#112233').startsWith('data:image/svg+xml'))

const resolvedKit = resolveBrandKitForDeckSetup(minimalDeck('bk-test').setup, companyBrain)
assert.equal(resolvedKit?.id, 'bk-test')

assert.equal(
  resolveBrandKitForDeckSetup(minimalDeck('wrong').setup, companyBrain),
  undefined,
)

const brandCtx = resolveBrandGenerationContext(minimalDeck('bk-test').setup, companyBrain, [])
assert.ok(brandCtx)
assert.equal(brandCtx?.organizationName, 'Acme Labs')

const brandedSlides = createSlidesFromDeck(minimalDeck('bk-test'), [], brandCtx)
const firstSlideTitle = brandedSlides[0]?.blocks.find((b) => b.type === 'title')
assert.equal(firstSlideTitle?.textStyle?.color, kit.primaryColor)
assert.equal(firstSlideTitle?.textStyle?.fontFamily, kit.fontFamily)

const chartSlide = brandedSlides.find((s) =>
  s.blocks.some((b) => b.type === 'chart-placeholder'),
)
const chartBlock = chartSlide?.blocks.find((b) => b.type === 'chart-placeholder')
assert.ok(chartBlock?.visualStyle)
assert.equal(chartBlock?.visualStyle?.fillColor, kit.primaryColor)

const plainSlides = createSlidesFromDeck(minimalDeck(), [], undefined)
const plainTitle = plainSlides[0]?.blocks.find((b) => b.type === 'title')
assert.equal(plainTitle?.textStyle?.color, undefined)
