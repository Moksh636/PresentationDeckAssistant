import type { CompanyKnowledgeItem } from '../types/models'
import type { UpsertKnowledgeItemInput } from './companyBrainMutations.ts'

export function reduceApproveKnowledgeFolderSuggestion(
  item: CompanyKnowledgeItem,
): UpsertKnowledgeItemInput | null {
  if (!item.suggestedFolderId) {
    return null
  }
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    sourceType: item.sourceType,
    tags: item.tags,
    folderId: item.suggestedFolderId,
    suggestedFolderId: null,
    ownerApprovedFolder: true,
    visibility: item.visibility,
    approvalStatus: item.approvalStatus,
    allowedDepartments: item.allowedDepartments,
    allowedRoleTitles: item.allowedRoleTitles,
    fileAssetId: item.fileAssetId,
  }
}

export function reduceRejectKnowledgeFolderSuggestion(
  item: CompanyKnowledgeItem,
): UpsertKnowledgeItemInput | null {
  if (!item.suggestedFolderId) {
    return null
  }
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    sourceType: item.sourceType,
    tags: item.tags,
    folderId: item.folderId,
    suggestedFolderId: null,
    ownerApprovedFolder: null,
    visibility: item.visibility,
    approvalStatus: item.approvalStatus,
    allowedDepartments: item.allowedDepartments,
    allowedRoleTitles: item.allowedRoleTitles,
    fileAssetId: item.fileAssetId,
  }
}
