import type { SlideImageAsset } from '../types/models.ts'

export type ImageFitMode = NonNullable<SlideImageAsset['fit']>

export function getNormalizedImageAsset(asset: SlideImageAsset): SlideImageAsset {
  const fit: ImageFitMode = asset.fit === 'fit' ? 'fit' : 'fill'
  const altText = asset.altText?.trim() || asset.name

  return {
    ...asset,
    fit,
    altText,
  }
}
