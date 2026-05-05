import type {
  CompanyBrandKit,
  CompanyBrainWorkspaceSlice,
  DeckSetup,
  FileAsset,
  Organization,
  SlideImageAsset,
} from '../types/models.ts'

export interface DeckBrandGenerationContext {
  kit: CompanyBrandKit
  organizationName: string
  logoSlideImage?: SlideImageAsset
}

export function resolveBrandKitForDeckSetup(
  setup: DeckSetup,
  companyBrain: Pick<CompanyBrainWorkspaceSlice, 'brandKits' | 'activeOrganizationId'>,
): CompanyBrandKit | undefined {
  const kitId = setup.brandKitId?.trim()

  if (!kitId) {
    return undefined
  }

  const orgId = companyBrain.activeOrganizationId

  return companyBrain.brandKits.find((kit) => kit.id === kitId && kit.organizationId === orgId)
}

export function resolveBrandGenerationContext(
  setup: DeckSetup,
  companyBrain: Pick<CompanyBrainWorkspaceSlice, 'brandKits' | 'activeOrganizationId' | 'organizations'>,
  deckFileAssets: FileAsset[],
): DeckBrandGenerationContext | undefined {
  const kit = resolveBrandKitForDeckSetup(setup, companyBrain)

  if (!kit) {
    return undefined
  }

  const organizationName =
    companyBrain.organizations.find((org) => org.id === kit.organizationId)?.name ?? ''

  const logoSlideImage = resolveLogoSlideImageAsset(kit, deckFileAssets, organizationName)

  return {
    kit,
    organizationName,
    logoSlideImage,
  }
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Compact SVG badge used when no raster preview exists for the logo file asset. */
export function svgBrandGlyphDataUrl(label: string, fillHex: string): string {
  const safeFill = /^#[0-9a-f]{6}$/i.test(fillHex.trim()) ? fillHex.trim() : '#111827'
  const initials = escapeSvgText(
    label
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 3) || '?',
  )

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <rect width="200" height="80" rx="10" fill="${safeFill}"/>
  <text x="100" y="48" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="600">${initials}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function readInlinePreviewFromMetadata(asset: FileAsset): string | undefined {
  const meta = asset.extractedMetadata as Record<string, unknown> | undefined
  if (!meta) {
    return undefined
  }

  for (const key of ['previewDataUrl', 'imageDataUrl', 'logoDataUrl'] as const) {
    const value = meta[key]

    if (typeof value === 'string' && value.startsWith('data:')) {
      return value
    }
  }

  return undefined
}

export function resolveLogoSlideImageAsset(
  kit: CompanyBrandKit,
  deckFileAssets: FileAsset[],
  organizationName: string,
): SlideImageAsset | undefined {
  const logoId = kit.logoAssetId?.trim()

  if (!logoId) {
    return undefined
  }

  const asset = deckFileAssets.find((file) => file.id === logoId)

  if (!asset) {
    return undefined
  }

  const inline = readInlinePreviewFromMetadata(asset)

  if (inline) {
    return {
      name: asset.name,
      mimeType: 'image/*',
      sizeBytes: asset.sizeBytes,
      dataUrl: inline,
      fit: 'fit',
      altText: `${organizationName || asset.name} logo`,
    }
  }

  if (asset.kind === 'image') {
    return {
      name: asset.name,
      mimeType: 'image/svg+xml',
      sizeBytes: asset.sizeBytes,
      dataUrl: svgBrandGlyphDataUrl(organizationName || asset.name, kit.primaryColor),
      fit: 'fit',
      altText: `${organizationName || asset.name} logo`,
    }
  }

  return undefined
}

export function getActiveOrganizationBrandKit(
  companyBrain: Pick<CompanyBrainWorkspaceSlice, 'brandKits' | 'activeOrganizationId'>,
): CompanyBrandKit | undefined {
  const orgId = companyBrain.activeOrganizationId

  return companyBrain.brandKits.find((kit) => kit.organizationId === orgId)
}

export function organizationNameForBrand(
  organizationId: string,
  organizations: Organization[],
): string {
  return organizations.find((org) => org.id === organizationId)?.name ?? ''
}
