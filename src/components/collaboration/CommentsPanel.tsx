import { useState } from 'react'
import { getCommentThreadLabel, getRoleLabel } from '../../data/collaboration'
import type { Comment, FileContributorRole } from '../../types/models'
import { formatShortDate } from '../../utils/formatters'

interface CommentTargetOption {
  value: string
  label: string
}

interface CommentsPanelProps {
  title: string
  description: string
  threads: Comment[]
  actorRole: FileContributorRole
  canCommentAsCollaborator: boolean
  targetOptions: CommentTargetOption[]
  selectedTarget: string
  onActorRoleChange: (role: FileContributorRole) => void
  onTargetChange: (value: string) => void
  onSubmit: (input: { message: string; authorRole: FileContributorRole; target: string }) => void
}

export function CommentsPanel({
  title,
  description,
  threads,
  actorRole,
  canCommentAsCollaborator,
  targetOptions,
  selectedTarget,
  onActorRoleChange,
  onTargetChange,
  onSubmit,
}: CommentsPanelProps) {
  const [draft, setDraft] = useState('')
  const resolvedActorRole =
    actorRole === 'collaborator' && !canCommentAsCollaborator ? 'owner' : actorRole

  return (
    <section className="panel-card comments-panel">
      <div className="comments-panel__header">
        <div>
          <span className="section-label">Comments</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="comments-panel__controls">
        <div className="field-group">
          <span className="field-label">Comment as</span>
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
        </div>

        <label className="field-group">
          <span className="field-label">Comment target</span>
          <select value={selectedTarget} onChange={(event) => onTargetChange(event.target.value)}>
            {targetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!canCommentAsCollaborator ? (
        <p className="context-note">
          <strong>Collaboration note</strong>
          Comment-only access is still disabled for collaborators on this surface.
        </p>
      ) : null}

      <div className="comments-thread-list">
        {threads.length === 0 ? (
          <p className="muted-copy">No comments on this target yet.</p>
        ) : (
          threads.map((thread) => (
            <article key={thread.id} className="comment-thread">
              <div className="comment-thread__header">
                <div>
                  <span className="section-label">{getCommentThreadLabel(thread)}</span>
                  <strong>{thread.resolved ? 'Resolved thread' : 'Open thread'}</strong>
                </div>
                <span className="card-pill">Updated {formatShortDate(thread.updatedAt)}</span>
              </div>

              <div className="comment-thread__messages">
                {thread.messages.map((message) => (
                  <div key={message.id} className="comment-thread__message">
                    <div className="comment-thread__meta">
                      <strong>{message.author}</strong>
                      <span>
                        {getRoleLabel(message.authorRole)} | {message.authorUserId}
                      </span>
                    </div>
                    <p>{message.message}</p>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="comments-composer">
        <label className="field-group">
          <span className="field-label">New comment</span>
          <textarea
            rows={4}
            value={draft}
            placeholder="Leave targeted feedback for this slide or setup input."
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>

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
          Add comment
        </button>
      </div>
    </section>
  )
}
