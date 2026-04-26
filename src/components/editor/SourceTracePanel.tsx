import { buildSourceTraceItems } from '../../data/sourceTrace'
import type { Slide } from '../../types/models'
import { formatConfidence } from '../../utils/formatters'

interface SourceTracePanelProps {
  slide: Slide
  selectedBlockId?: string
  onSelectBlock: (blockId: string) => void
  onClearSelectedBlock: () => void
}

export function SourceTracePanel({
  slide,
  selectedBlockId,
  onSelectBlock,
  onClearSelectedBlock,
}: SourceTracePanelProps) {
  const selectedBlock = slide.blocks.find((block) => block.id === selectedBlockId)
  const traceItems = buildSourceTraceItems(slide, selectedBlockId)

  return (
    <section className="panel-card trace-panel">
      <div className="trace-panel__header">
        <div>
          <span className="section-label">Source trace</span>
          <h3>{selectedBlock ? 'Selected block sources' : 'Slide sources'}</h3>
          <p>
            {selectedBlock
              ? 'Trace for the currently selected block. Use slide sources to inspect broader provenance.'
              : 'Select a block to inspect block-level provenance or use these slide-level traces to jump back into content.'}
          </p>
        </div>

        {selectedBlock ? (
          <button type="button" className="ghost-button" onClick={onClearSelectedBlock}>
            Show slide sources
          </button>
        ) : null}
      </div>

      {traceItems.length === 0 ? (
        <p className="muted-copy">
          {selectedBlock
            ? 'This block does not have source trace data yet.'
            : 'This slide does not have source trace data yet.'}
        </p>
      ) : (
        <div className="trace-list">
          {traceItems.map((item) => {
            const content = (
              <>
                <div className="trace-item__header">
                  <div>
                    <strong>{item.trace.fileName}</strong>
                    <div className="trace-item__meta">
                      <span
                        className={`trace-source-badge trace-source-badge--${item.trace.sourceType}`}
                      >
                        {item.sourceTypeLabel}
                      </span>
                      <span>{formatConfidence(item.trace.confidence)}</span>
                      {item.relatedBlockLabel ? <span>{item.relatedBlockLabel}</span> : null}
                    </div>
                  </div>
                </div>

                <p className="trace-item__snippet">{item.trace.extractedSnippet}</p>

                <div className="trace-item__footer">
                  <span>Added by {item.addedByLabel}</span>
                  {item.relatedBlockId ? <span>Click to highlight block</span> : null}
                </div>
              </>
            )

            if (item.relatedBlockId) {
              return (
                <button
                  key={item.key}
                  type="button"
                  className="trace-item trace-item--interactive"
                  onClick={() => onSelectBlock(item.relatedBlockId!)}
                >
                  {content}
                </button>
              )
            }

            return (
              <article key={item.key} className="trace-item">
                {content}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
