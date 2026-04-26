import { useState } from 'react'
import { getCommentThreadLabel, getRoleLabel } from '../../data/collaboration'
import type { Comment, FileContributorRole } from '../../types/models'
import { formatShortDate } from '../../utils/formatters'

interface CommentTargetOption {
  value: string
  label: string
}

interface EditorCommentsPanelProps {
  slideThreads: Comment[]
  deckThreads: Comment[]
  actorRole: FileContributorRole
  canCommentAsCollaborator: boolean
  targetOptions: CommentTargetOption[]
  selectedTarget: string
  selectedThreadId?: string
  onActorRoleChange: (role: FileContributorRole) => void
  onTargetChange: (value: string) => void
  onSelectThread: (thread: Comment) => void
  onResolveThread: (threadId: string) => void
  onSubmit: (input: { message: string; authorRole: FileContributorRole; target: string }) => void
}

export function EditorCommentsPanel({
  slideThreads,
  deckThreads,
  actorRole,
  canCommentAsCollaborator,
  targetOptions,
  selectedTarget,
  selectedThreadId,
  onActorRoleChange,
  onTargetChange,
  onSelectThread,
  onResolveThread,
  onSubmit,
}: EditorCommentsPanelProps) {
  const [draft, setDraft] = useState('')
  const resolvedActorRole =
    actorRole === 'collaborator' && !canCommentAsCollaborator ? 'owner' : actorRole

  return (
    <div className="editor-comments-panel">
      <div className="editor-comments-panel__controls">
        <div className="scope-toggle">
          <button
            type="button"
            className={resolvedActorRole === 'owner' ? 'is-active' : ''}
            onClick={() => onActorRoleChange('owner')}
          >
            Owner
          </button>
          <button
            type="button"
            className={resolvedActorRole === 'collaborator' ? 'is-active' : ''}
            disabled={!canCommentAsCollaborator}
            onClick={() => onActorRoleChange('collaborator')}
          >
            Collaborator
          </button>
        </div>

        <label className="field-group">
          <span className="field-label">Target</span>
          <select value={selectedTarget} onChange={(event) => onTargetChange(event.target.value)}>
            {targetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="editor-comment-list">
        <CommentSection
          title="Current slide comments"
          threads={slideThreads}
          emptyMessage="No comments on this slide."
          selectedThreadId={selectedThreadId}
          onSelectThread={onSelectThread}
          onResolveThread={onResolveThread}
        />
        <CommentSection
          title="Deck comments"
          threads={deckThreads}
          emptyMessage="No deck-level comments."
          selectedThreadId={selectedThreadId}
          onSelectThread={onSelectThread}
          onResolveThread={onResolveThread}
        />
      </div>

      <div className="editor-comment-composer">
        <textarea
          rows={3}
          value={draft}
          placeholder="Add a comment"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            const nextDraft = draft.trim()

            if (!nextDraft) {
              return
            }

            onSubmit({
              message: nextDraft,
              authorRole: resolvedActorRole,
              target: selectedTarget,
            })
            setDraft('')
          }}
        >
          Comment
        </button>
      </div>
    </div>
  )
}

function CommentSection({
  title,
  threads,
  emptyMessage,
  selectedThreadId,
  onSelectThread,
  onResolveThread,
}: {
  title: string
  threads: Comment[]
  emptyMessage: string
  selectedThreadId?: string
  onSelectThread: (thread: Comment) => void
  onResolveThread: (threadId: string) => void
}) {
  return (
    <section className="editor-comment-section">
      <div className="editor-comment-section__header">
        <h4>{title}</h4>
        <span>{threads.length}</span>
      </div>

      {threads.length === 0 ? (
        <p className="muted-copy">{emptyMessage}</p>
      ) : (
        threads.map((thread) => (
          <article
            key={thread.id}
            className={`editor-comment-card ${
              selectedThreadId === thread.id ? 'is-selected' : ''
            }`}
            onClick={() => onSelectThread(thread)}
          >
            <div className="editor-comment-card__header">
              <div>
                <span className="section-label">{getCommentThreadLabel(thread)}</span>
                <strong>{thread.resolved ? 'Resolved' : 'Open'}</strong>
              </div>
              <span>{formatShortDate(thread.updatedAt)}</span>
            </div>

            <div className="editor-comment-card__messages">
              {thread.messages.map((message) => (
                <div key={message.id} className="editor-comment-message">
                  <div className="editor-comment-message__meta">
                    <strong>{message.author}</strong>
                    <span>{getRoleLabel(message.authorRole)}</span>
                  </div>
                  <p>{message.message}</p>
                </div>
              ))}
            </div>

            {!thread.resolved ? (
              <button
                type="button"
                className="secondary-button"
                onClick={(event) => {
                  event.stopPropagation()
                  onResolveThread(thread.id)
                }}
              >
                Resolve
              </button>
            ) : null}
          </article>
        ))
      )}
    </section>
  )
}
