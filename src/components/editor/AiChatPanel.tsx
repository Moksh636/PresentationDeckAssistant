import { useState } from 'react'
import type { AiEditPlan, AiEditScope } from '../../data/aiEditor'
import type { AiProposalBlockDiff } from '../../data/aiProposalReview'

export type AiChatMessageStatus = 'pending' | 'accepted' | 'rejected' | 'applied'

export interface AiChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  kind?: 'message' | 'proposal'
  status?: AiChatMessageStatus
  plan?: AiEditPlan
  diffs?: AiProposalBlockDiff[]
}

interface AiChatPanelProps {
  scope: AiEditScope
  askBeforeApplying: boolean
  hasPendingProposal: boolean
  onScopeChange: (scope: AiEditScope) => void
  onAskBeforeApplyingChange: (value: boolean) => void
  onAcceptProposal: (messageId: string) => void
  onRejectProposal: (messageId: string) => void
  versionLabels: string[]
  messages: AiChatMessage[]
  contextChips: string[]
  onSendMessage: (message: string) => void
}

function getStatusLabel(status: AiChatMessageStatus) {
  switch (status) {
    case 'accepted':
      return 'Accepted and applied'
    case 'rejected':
      return 'Rejected'
    case 'applied':
      return 'Applied'
    default:
      return 'Awaiting review'
  }
}

export function AiChatPanel({
  scope,
  askBeforeApplying,
  hasPendingProposal,
  onScopeChange,
  onAskBeforeApplyingChange,
  onAcceptProposal,
  onRejectProposal,
  versionLabels,
  messages,
  contextChips,
  onSendMessage,
}: AiChatPanelProps) {
  const [draft, setDraft] = useState('')
  const promptChips = [
    'Shorten this slide',
    'Make this more executive',
    'Improve title',
    'Add speaker notes',
    'Make more persuasive',
  ]

  return (
    <aside className="chat-panel">
      <div className="scope-toggle">
        <button
          type="button"
          className={scope === 'slide' ? 'is-active' : ''}
          onClick={() => onScopeChange('slide')}
        >
          Edit this slide
        </button>
        <button
          type="button"
          className={scope === 'deck' ? 'is-active' : ''}
          onClick={() => onScopeChange('deck')}
        >
          Edit whole deck
        </button>
      </div>

      <div className="chat-panel__setting">
        <div className="chat-panel__setting-copy">
          <span className="section-label">Apply mode</span>
          <strong>Ask before applying edits</strong>
          <p>Keep review on by default so the proposed change is visible before JSON updates.</p>
        </div>

        <label className="inline-toggle" aria-label="Ask before applying edits">
          <input
            type="checkbox"
            checked={askBeforeApplying}
            onChange={(event) => onAskBeforeApplyingChange(event.target.checked)}
          />
          <span className="inline-toggle__track" />
        </label>
      </div>

      <div className="chat-panel__versions">
        <span className="section-label">Versions</span>
        <div className="version-stack">
          {versionLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="chat-context-chips" aria-label="AI context">
        {contextChips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>

      <div className="chat-thread">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-bubble chat-bubble--${message.role} ${
              message.kind === 'proposal' ? 'chat-bubble--proposal' : ''
            }`}
          >
            <div className="chat-bubble__header">
              <span>{message.role === 'assistant' ? 'AI' : 'You'}</span>
              {message.status ? (
                <strong className={`chat-status chat-status--${message.status}`}>
                  {getStatusLabel(message.status)}
                </strong>
              ) : null}
            </div>
            <p>{message.content}</p>

            {message.kind === 'proposal' && message.plan ? (
              <div className="chat-proposal">
                <div className="chat-proposal__meta">
                  <span>{message.plan.scope === 'slide' ? 'Current slide' : 'Whole deck'}</span>
                  <span>{message.plan.affectedSlides} slide(s)</span>
                  <span>{message.plan.affectedBlocks} block(s)</span>
                </div>

                {(message.diffs?.length ?? 0) > 0 ? (
                  <div className="chat-proposal__examples chat-proposal__examples--diffs">
                    {message.diffs?.slice(0, 3).map((diff) => (
                      <div key={`${message.id}-${diff.slideId}-${diff.blockId}`} className="chat-proposal__example">
                        <strong>{diff.slideTitle}</strong>
                        <p>
                          <span>Before:</span> {diff.before}
                        </p>
                        <p>
                          <span>After:</span> {diff.after}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : message.plan.examples.length > 0 ? (
                  <div className="chat-proposal__examples">
                    {message.plan.examples.slice(0, 2).map((example, index) => (
                      <div key={`${message.id}-example-${index + 1}`} className="chat-proposal__example">
                        <strong>Example {index + 1}</strong>
                        <p>
                          <span>Before:</span> {example.before}
                        </p>
                        <p>
                          <span>After:</span> {example.after}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {message.status === 'pending' ? (
                  <div className="chat-proposal__actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onAcceptProposal(message.id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onRejectProposal(message.id)}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="chat-composer">
        <div className="chat-prompt-chips" aria-label="Prompt suggestions">
          {promptChips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={hasPendingProposal}
              onClick={() => {
                onSendMessage(chip)
                setDraft('')
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <textarea
          rows={4}
          value={draft}
          placeholder="Ask for a rewrite, tighter summary, more formal tone, or a deck-wide revision."
          onChange={(event) => setDraft(event.target.value)}
        />
        <p className="chat-composer__hint">
          {hasPendingProposal
            ? 'Resolve the current proposal before sending another request.'
            : 'Mock AI edits update the same structured slide blocks used by the editor.'}
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={hasPendingProposal}
          onClick={() => {
            const nextDraft = draft.trim()

            if (!nextDraft || hasPendingProposal) {
              return
            }

            onSendMessage(nextDraft)
            setDraft('')
          }}
        >
          Send
        </button>
      </div>
    </aside>
  )
}
