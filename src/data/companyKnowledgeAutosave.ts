/** Version bookkeeping for Knowledge Library cloud autosave (`knowledge_folders` + `company_knowledge_items` only). Mirrors `companyIdentityAutosave.ts`. */

export interface CompanyKnowledgeAutosaveState {
  dirtyVersion: number
  savedVersion: number
  suppressUntilVersion: number
}

export function createCompanyKnowledgeAutosaveState(): CompanyKnowledgeAutosaveState {
  return {
    dirtyVersion: 0,
    savedVersion: 0,
    suppressUntilVersion: 0,
  }
}

export function markCompanyKnowledgeDirty(state: CompanyKnowledgeAutosaveState): CompanyKnowledgeAutosaveState {
  return {
    ...state,
    dirtyVersion: state.dirtyVersion + 1,
  }
}

export function markCompanyKnowledgeSaved(
  state: CompanyKnowledgeAutosaveState,
  savedVersion = state.dirtyVersion,
): CompanyKnowledgeAutosaveState {
  return {
    ...state,
    savedVersion: Math.max(state.savedVersion, savedVersion),
  }
}

export function markCompanyKnowledgeLoaded(state: CompanyKnowledgeAutosaveState): CompanyKnowledgeAutosaveState {
  return {
    ...state,
    savedVersion: state.dirtyVersion,
    suppressUntilVersion: state.dirtyVersion,
  }
}

export function shouldAutosaveCompanyKnowledge(
  state: CompanyKnowledgeAutosaveState,
  canUseCloud: boolean,
): boolean {
  if (!canUseCloud) {
    return false
  }

  if (state.dirtyVersion <= state.savedVersion) {
    return false
  }

  return state.dirtyVersion > state.suppressUntilVersion
}
