import type {
  CollaborationSettings,
  Comment,
  Deck,
  DeckSetup,
  FileContributorRole,
  SetupFieldKey,
} from '../types/models'
import { COLLABORATOR_USER_ID, OWNER_USER_ID } from './sourceIngestion'

export const OWNER_USER_NAME = 'Mina Patel'
export const COLLABORATOR_USER_NAME = 'Avery Chen'

export function createDefaultCollaborationSettings(
  shareSetupInputs = false,
): CollaborationSettings {
  return {
    isShared: false,
    access: 'comment-only',
    allowCollaboratorUploads: shareSetupInputs,
  }
}

export function createSharedCollaborationSettings(
  shareSetupInputs: boolean,
  previous?: CollaborationSettings,
): CollaborationSettings {
  return {
    isShared: true,
    access: 'comment-only',
    allowCollaboratorUploads:
      previous?.allowCollaboratorUploads ?? shareSetupInputs,
  }
}

export function getMockActor(role: FileContributorRole) {
  return role === 'collaborator'
    ? {
        role,
        userId: COLLABORATOR_USER_ID,
        name: COLLABORATOR_USER_NAME,
      }
    : {
        role,
        userId: OWNER_USER_ID,
        name: OWNER_USER_NAME,
      }
}

export function getActorByUserId(userId: string) {
  if (userId === COLLABORATOR_USER_ID) {
    return getMockActor('collaborator')
  }

  if (userId === OWNER_USER_ID) {
    return getMockActor('owner')
  }

  return undefined
}

export function getRoleLabel(role: FileContributorRole) {
  return role === 'owner' ? 'Owner' : 'Collaborator'
}

export function getSetupFieldLabel(field: SetupFieldKey) {
  const labels: Record<SetupFieldKey, string> = {
    goal: 'Presentation goal',
    audience: 'Audience',
    tone: 'Tone / style',
    presentationType: 'Presentation type',
    requiredSections: 'Required sections',
    notes: 'Notes / context',
    webResearch: 'Web research',
    usePreviousDeckContext: 'Use previous deck context',
    shareSetupInputs: 'Share setup inputs',
  }

  return labels[field]
}

export function getCommentThreadLabel(thread: Comment) {
  if (thread.blockId) {
    return 'Block comment'
  }

  if (thread.slideId) {
    return 'Slide comment'
  }

  if (thread.inputFieldKey) {
    return getSetupFieldLabel(thread.inputFieldKey)
  }

  return 'General deck comment'
}

export function getCommentTargetKey(input: {
  deckId: string
  slideId?: string
  blockId?: string
  inputFieldKey?: SetupFieldKey
}) {
  return [
    input.deckId,
    input.slideId ?? 'deck',
    input.blockId ?? 'slide',
    input.inputFieldKey ?? 'general',
  ].join('|')
}

export function canCollaboratorUpload(deck: Deck) {
  return deck.collaboration.isShared && deck.collaboration.allowCollaboratorUploads
}

export function canCollaboratorCommentOnSetup(deck: Deck) {
  return deck.collaboration.isShared && deck.setup.shareSetupInputs
}

export function getSetupFieldValueSummary(setup: DeckSetup, key: SetupFieldKey) {
  const value = setup[key]

  if (Array.isArray(value)) {
    return value.join(', ') || 'No value set'
  }

  if (typeof value === 'boolean') {
    return value ? 'Enabled' : 'Disabled'
  }

  return value || 'No value set'
}
