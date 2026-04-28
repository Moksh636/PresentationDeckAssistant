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
  onReopenThread: (threadId: string) => void
  onReplyThread: (thread: Comment, message: string, authorRole: FileContributorRole) => void
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
  onReopenThread,
  onReplyThread,
  onSubmit,
}: EditorCommentsPanelProps) {
  const [draft, setDraft] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
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
          onReopenThread={onReopenThread}
          onReplyThread={(thread, message) => onReplyThread(thread, message, resolvedActorRole)}
          replyDrafts={replyDrafts}
          onReplyDraftChange={(threadId, value) =>
            setReplyDrafts((current) => ({ ...current, [threadId]: value }))
          }
          onReplyDraftClear={(threadId) =>
            setReplyDrafts((current) => {
              const nextDrafts = { ...current }
              delete nextDrafts[threadId]
              return nextDrafts
            })
          }
        />
        <CommentSection
          title="Deck comments"
          threads={deckThreads}
          emptyMessage="No deck-level comments."
          selectedThreadId={selectedThreadId}
          onSelectThread={onSelectThread}
          onResolveThread={onResolveThread}
          onReopenThread={onReopenThread}
          onReplyThread={(thread, message) => onReplyThread(thread, message, resolvedActorRole)}
          replyDrafts={replyDrafts}
          onReplyDraftChange={(threadId, value) =>
            setReplyDrafts((current) => ({ ...current, [threadId]: value }))
          }
          onReplyDraftClear={(threadId) =>
            setReplyDrafts((current) => {
              const nextDrafts = { ...current }
              delete nextDrafts[threadId]
              return nextDrafts
            })
          }
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
  onReopenThread,
  onReplyThread,
  replyDrafts,
  onReplyDraftChange,
  onReplyDraftClear,
}: {
  title: string
  threads: Comment[]
  emptyMessage: string
  selectedThreadId?: string
  onSelectThread: (thread: Comment) => void
  onResolveThread: (threadId: string) => void
  onReopenThread: (threadId: string) => void
  onReplyThread: (thread: Comment, message: string) => void
  replyDrafts: Record<string, string>
  onReplyDraftChange: (threadId: string, value: string) => void
  onReplyDraftClear: (threadId: string) => void
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
              <>
                <div className="editor-comment-reply">
                  <textarea
                    rows={2}
                    value={replyDrafts[thread.id] ?? ''}
                    placeholder="Reply to thread"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onReplyDraftChange(thread.id, event.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      const nextReply = (replyDrafts[thread.id] ?? '').trim()

                      if (!nextReply) {
                        return
                      }

                      onReplyThread(thread, nextReply)
                      onReplyDraftClear(thread.id)
                    }}
                  >
                    Reply
                  </button>
                </div>
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
              </>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={(event) => {
                  event.stopPropagation()
                  onReopenThread(thread.id)
                }}
              >
                Reopen
              </button>
            )}
          </article>
        ))
      )}
    </section>
  )
}
