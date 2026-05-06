export interface CompanyIdentityAutosaveState {
  dirtyVersion: number
  savedVersion: number
  suppressUntilVersion: number
}

export function createCompanyIdentityAutosaveState(): CompanyIdentityAutosaveState {
  return {
    dirtyVersion: 0,
    savedVersion: 0,
    suppressUntilVersion: 0,
  }
}

export function markCompanyIdentityDirty(
  state: CompanyIdentityAutosaveState,
): CompanyIdentityAutosaveState {
  return {
    ...state,
    dirtyVersion: state.dirtyVersion + 1,
  }
}

export function markCompanyIdentitySaved(
  state: CompanyIdentityAutosaveState,
  savedVersion = state.dirtyVersion,
): CompanyIdentityAutosaveState {
  return {
    ...state,
    savedVersion: Math.max(state.savedVersion, savedVersion),
  }
}

export function markCompanyIdentityLoaded(
  state: CompanyIdentityAutosaveState,
): CompanyIdentityAutosaveState {
  return {
    ...state,
    savedVersion: state.dirtyVersion,
    suppressUntilVersion: state.dirtyVersion,
  }
}

export function shouldAutosaveCompanyIdentity(
  state: CompanyIdentityAutosaveState,
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
