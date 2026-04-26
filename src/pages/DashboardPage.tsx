import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ShareProjectModal } from '../components/collaboration/ShareProjectModal'
import { useWorkspace } from '../context/useWorkspace'
import {
  buildWorkspaceLibraryItems,
  filterWorkspaceLibraryItems,
  sortWorkspaceLibraryItems,
} from '../data/workspaceLibrary'
import type {
  WorkspaceLibraryItem,
  WorkspaceLibraryItemType,
  WorkspaceLibrarySection,
  WorkspaceSortKey,
  WorkspaceViewMode,
} from '../data/workspaceLibrary'
import { formatCountLabel, formatShortDate } from '../utils/formatters'

const workspaceSections: Array<{
  id: WorkspaceLibrarySection
  label: string
  helper: string
}> = [
  { id: 'my-drive', label: 'My Drive', helper: 'All active workspace items' },
  { id: 'shared', label: 'Shared with me', helper: 'Comment-enabled work' },
  { id: 'recent', label: 'Recent', helper: 'Latest deck activity' },
  { id: 'starred', label: 'Starred', helper: 'Pinned projects and decks' },
  { id: 'trash', label: 'Trash', helper: 'Deleted items pending removal' },
  { id: 'projects', label: 'Projects', helper: 'Folder-level organization' },
]

const sortOptions: Array<{ value: WorkspaceSortKey; label: string }> = [
  { value: 'updated-desc', label: 'Newest first' },
  { value: 'updated-asc', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'type-asc', label: 'Type' },
]

function getItemIcon(type: WorkspaceLibraryItemType) {
  if (type === 'project') {
    return 'Folder'
  }

  if (type === 'report') {
    return 'Report'
  }

  return 'Deck'
}

interface WorkspaceItemMenuProps {
  item: WorkspaceLibraryItem
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onRename: () => void
  onDuplicate: () => void
  onMove: () => void
  onToggleStar: () => void
  onTrash: () => void
  onRestore: () => void
  onDeletePermanently: () => void
}

function WorkspaceItemMenu({
  item,
  isOpen,
  onToggle,
  onClose,
  onRename,
  onDuplicate,
  onMove,
  onToggleStar,
  onTrash,
  onRestore,
  onDeletePermanently,
}: WorkspaceItemMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>()

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) {
      return
    }

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const popoverRect = popoverRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const edgePadding = 8
    const anchorGap = 8

    let left = triggerRect.right - popoverRect.width
    if (left < edgePadding) {
      left = edgePadding
    }
    if (left + popoverRect.width > viewportWidth - edgePadding) {
      left = Math.max(edgePadding, viewportWidth - popoverRect.width - edgePadding)
    }

    let top = triggerRect.bottom + anchorGap
    if (top + popoverRect.height > viewportHeight - edgePadding) {
      top = Math.max(edgePadding, triggerRect.top - popoverRect.height - anchorGap)
    }

    setPopoverPosition({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }
    updatePopoverPosition()
  }, [isOpen, updatePopoverPosition])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null
      if (!targetNode) {
        return
      }

      if (triggerRef.current?.contains(targetNode) || popoverRef.current?.contains(targetNode)) {
        return
      }

      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [isOpen, onClose, updatePopoverPosition])

  return (
    <div className="workspace-item-menu">
      <button
        type="button"
        ref={triggerRef}
        className="workspace-item-menu__trigger"
        aria-expanded={isOpen}
        aria-label={`Open actions for ${item.name}`}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        More
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={popoverRef}
              className="workspace-item-menu__popover"
              role="menu"
              style={
                popoverPosition
                  ? {
                      top: `${popoverPosition.top}px`,
                      left: `${popoverPosition.left}px`,
                    }
                  : {
                      top: '-9999px',
                      left: '-9999px',
                    }
              }
            >
              {item.isTrashed ? (
                <button type="button" role="menuitem" onClick={onRestore}>
                  Restore
                </button>
              ) : (
                <>
                  <button type="button" role="menuitem" onClick={onRename}>
                    Rename
                  </button>
                  <button type="button" role="menuitem" onClick={onDuplicate}>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.type === 'project'}
                    onClick={onMove}
                  >
                    Move
                  </button>
                  <button type="button" role="menuitem" onClick={onToggleStar}>
                    {item.isStarred ? 'Remove star' : 'Star'}
                  </button>
                  <button type="button" role="menuitem" onClick={onTrash}>
                    Trash
                  </button>
                </>
              )}
              <button
                type="button"
                role="menuitem"
                className="workspace-item-menu__danger"
                onClick={onDeletePermanently}
              >
                Delete permanently
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

interface WorkspaceItemCardProps {
  item: WorkspaceLibraryItem
  viewMode: WorkspaceViewMode
  isMenuOpen: boolean
  onOpen: () => void
  onMenuToggle: () => void
  onMenuClose: () => void
  onRename: () => void
  onDuplicate: () => void
  onMove: () => void
  onToggleStar: () => void
  onTrash: () => void
  onRestore: () => void
  onDeletePermanently: () => void
}

function WorkspaceItemCard({
  item,
  viewMode,
  isMenuOpen,
  onOpen,
  onMenuToggle,
  onMenuClose,
  onRename,
  onDuplicate,
  onMove,
  onToggleStar,
  onTrash,
  onRestore,
  onDeletePermanently,
}: WorkspaceItemCardProps) {
  return (
    <article
      className={`workspace-item workspace-item--${viewMode} ${
        item.isTrashed ? 'workspace-item--trashed' : ''
      }`}
    >
      <button type="button" className="workspace-item__open" onClick={onOpen}>
        <span className="workspace-item__icon" aria-hidden="true">
          {getItemIcon(item.type)}
        </span>
        <span className="workspace-item__body">
          <span className="workspace-item__eyebrow">
            {item.typeLabel}
            {item.parentName ? ` / ${item.parentName}` : ''}
          </span>
          <strong>{item.name}</strong>
          <span>{item.description}</span>
        </span>
      </button>

      <div className="workspace-item__meta">
        <span>{item.owner}</span>
        <span>{formatShortDate(item.updatedAt)}</span>
        <span>{item.countLabel}</span>
      </div>

      <div className="workspace-item__badges">
        {item.isStarred ? <span className="workspace-badge workspace-badge--star">Starred</span> : null}
        {item.badges.map((badge) => (
          <span key={badge} className="workspace-badge">
            {badge}
          </span>
        ))}
      </div>

      <WorkspaceItemMenu
        item={item}
        isOpen={isMenuOpen}
        onToggle={onMenuToggle}
        onClose={onMenuClose}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onMove={onMove}
        onToggleStar={onToggleStar}
        onTrash={onTrash}
        onRestore={onRestore}
        onDeletePermanently={onDeletePermanently}
      />
    </article>
  )
}

interface MoveWorkspaceItemDialogProps {
  item: WorkspaceLibraryItem
  projects: Array<{ id: string; name: string; trashedAt?: string }>
  decks: Array<{ id: string; title: string; trashedAt?: string }>
  targetId: string
  onTargetChange: (targetId: string) => void
  onCancel: () => void
  onMove: () => void
}

function MoveWorkspaceItemDialog({
  item,
  projects,
  decks,
  targetId,
  onTargetChange,
  onCancel,
  onMove,
}: MoveWorkspaceItemDialogProps) {
  const targets =
    item.type === 'deck'
      ? projects
          .filter((project) => !project.trashedAt && project.id !== item.projectId)
          .map((project) => ({ id: project.id, label: project.name }))
      : decks
          .filter((deck) => !deck.trashedAt && deck.id !== item.deckId)
          .map((deck) => ({ id: deck.id, label: deck.title }))

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card modal-card--compact" role="dialog" aria-modal="true">
        <div className="modal-card__header">
          <div>
            <span className="section-label">Move</span>
            <h3>{item.name}</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onCancel}>
            Close
          </button>
        </div>

        <label className="form-field">
          <span>{item.type === 'deck' ? 'Move to project' : 'Move to deck'}</span>
          <select value={targetId} onChange={(event) => onTargetChange(event.target.value)}>
            <option value="">Select destination</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-card__footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" disabled={!targetId} onClick={onMove}>
            Move item
          </button>
        </div>
      </section>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const {
    workspace,
    createPresentation,
    setActiveDeck,
    updateProjectCollaboration,
    renameWorkspaceItem,
    duplicateWorkspaceItem,
    moveWorkspaceItem,
    toggleWorkspaceItemStarred,
    trashWorkspaceItem,
    restoreWorkspaceItem,
    deleteWorkspaceItemPermanently,
  } = useWorkspace()
  const [selectedSection, setSelectedSection] = useState<WorkspaceLibrarySection>('my-drive')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<WorkspaceSortKey>('updated-desc')
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('grid')
  const [openMenuKey, setOpenMenuKey] = useState<string>()
  const [shareProjectId, setShareProjectId] = useState<string>()
  const [activeProjectId, setActiveProjectId] = useState<string>()
  const [moveItem, setMoveItem] = useState<WorkspaceLibraryItem>()
  const [moveTargetId, setMoveTargetId] = useState('')

  const libraryItems = useMemo(() => buildWorkspaceLibraryItems(workspace), [workspace])
  const sectionCounts = useMemo(
    () =>
      workspaceSections.reduce<Record<WorkspaceLibrarySection, number>>((counts, section) => {
        counts[section.id] = filterWorkspaceLibraryItems(libraryItems, {
          section: section.id,
          searchQuery: '',
        }).length
        return counts
      }, {} as Record<WorkspaceLibrarySection, number>),
    [libraryItems],
  )
  const selectedProject = workspace.projects.find((project) => project.id === shareProjectId)
  const projectDecks = useMemo(
    () => workspace.decks.filter((deck) => deck.projectId === selectedProject?.id),
    [selectedProject?.id, workspace.decks],
  )
  const projectShareSettings = {
    isShared: projectDecks.length > 0 && projectDecks.every((deck) => deck.collaboration.isShared),
    shareSetupInputs:
      projectDecks.length > 0 && projectDecks.every((deck) => deck.setup.shareSetupInputs),
    allowCollaboratorUploads:
      projectDecks.length > 0 &&
      projectDecks.every((deck) => deck.collaboration.allowCollaboratorUploads),
  }
  const currentSection = workspaceSections.find((section) => section.id === selectedSection)
  const visibleItems = useMemo(() => {
    const sectionItems = filterWorkspaceLibraryItems(libraryItems, {
      section: selectedSection,
      searchQuery,
    })
    const projectFilteredItems = activeProjectId
      ? sectionItems.filter((item) => item.projectId === activeProjectId)
      : sectionItems

    return sortWorkspaceLibraryItems(projectFilteredItems, sortKey)
  }, [activeProjectId, libraryItems, searchQuery, selectedSection, sortKey])
  const activeProject = workspace.projects.find((project) => project.id === activeProjectId)

  const handleCreatePresentation = () => {
    const nextDeckId = createPresentation(activeProjectId)

    if (nextDeckId) {
      navigate('/build')
    }
  }

  const handleOpenItem = (item: WorkspaceLibraryItem) => {
    if (item.type === 'project') {
      setActiveProjectId(item.id)
      setSelectedSection('my-drive')
      setSearchQuery('')
      return
    }

    if (item.type === 'deck') {
      setActiveDeck(item.id)
      navigate('/edit')
    }

    if (item.type === 'report' && item.deckId) {
      setActiveDeck(item.deckId)
      navigate('/edit')
    }
  }

  const handleRename = (item: WorkspaceLibraryItem) => {
    const nextName = window.prompt(`Rename ${item.typeLabel}`, item.name)

    if (nextName?.trim()) {
      renameWorkspaceItem(item.type, item.id, nextName)
    }

    setOpenMenuKey(undefined)
  }

  const handleDuplicate = (item: WorkspaceLibraryItem) => {
    const nextId = duplicateWorkspaceItem(item.type, item.id)

    if (item.type === 'deck' && nextId) {
      setActiveDeck(nextId)
    }

    setOpenMenuKey(undefined)
  }

  const handleMove = (item: WorkspaceLibraryItem) => {
    const defaultTarget =
      item.type === 'deck'
        ? workspace.projects.find((project) => !project.trashedAt && project.id !== item.projectId)
            ?.id
        : workspace.decks.find((deck) => !deck.trashedAt && deck.id !== item.deckId)?.id

    setMoveTargetId(defaultTarget ?? '')
    setMoveItem(item)
    setOpenMenuKey(undefined)
  }

  const handleTrash = (item: WorkspaceLibraryItem) => {
    if (window.confirm(`Move "${item.name}" to Trash?`)) {
      trashWorkspaceItem(item.type, item.id)
    }

    setOpenMenuKey(undefined)
  }

  const handleDeletePermanently = (item: WorkspaceLibraryItem) => {
    if (window.confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) {
      deleteWorkspaceItemPermanently(item.type, item.id)
    }

    setOpenMenuKey(undefined)
  }

  const handleRestore = (item: WorkspaceLibraryItem) => {
    restoreWorkspaceItem(item.type, item.id)
    setOpenMenuKey(undefined)
  }

  const handleShareActiveProject = () => {
    if (activeProjectId) {
      setShareProjectId(activeProjectId)
      return
    }

    setShareProjectId(workspace.projects[0]?.id)
  }

  return (
    <section className="page page--workspace">
      <div className="workspace-dashboard">
        <aside className="workspace-drive-sidebar" aria-label="Workspace sections">
          <div className="workspace-drive-sidebar__header">
            <span className="section-label">Workspace</span>
            <h2>Deck Drive</h2>
          </div>

          <button type="button" className="primary-button primary-button--full" onClick={handleCreatePresentation}>
            New Deck
          </button>

          <nav className="workspace-drive-sidebar__nav">
            {workspaceSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={selectedSection === section.id ? 'is-active' : ''}
                onClick={() => {
                  setSelectedSection(section.id)
                  setActiveProjectId(undefined)
                }}
              >
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.helper}</small>
                </span>
                <em>{sectionCounts[section.id] ?? 0}</em>
              </button>
            ))}
          </nav>

          <div className="workspace-drive-sidebar__summary">
            <span>{formatCountLabel(workspace.projects.length, 'project')}</span>
            <span>{formatCountLabel(workspace.decks.length, 'deck')}</span>
            <span>
              {formatCountLabel(
                workspace.fileAssets.filter((asset) => asset.kind === 'report').length,
                'report',
              )}
            </span>
          </div>
        </aside>

        <div className="workspace-main">
          <header className="workspace-toolbar">
            <div>
              <span className="section-label">{activeProject ? 'Project folder' : 'Workspace'}</span>
              <h2>{activeProject?.name ?? currentSection?.label ?? 'My Drive'}</h2>
              <p>
                {activeProject?.summary ??
                  currentSection?.helper ??
                  'Search, sort, and manage presentation work.'}
              </p>
            </div>

            <div className="workspace-toolbar__controls">
              <label className="workspace-search">
                <span>Search</span>
                <input
                  type="search"
                  value={searchQuery}
                  placeholder="Search projects, decks, reports"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>

              <label className="workspace-sort">
                <span>Sort</span>
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as WorkspaceSortKey)}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="workspace-view-toggle" aria-label="View mode">
                <button
                  type="button"
                  className={viewMode === 'grid' ? 'is-active' : ''}
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? 'is-active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
              </div>

              <button type="button" className="primary-button" onClick={handleCreatePresentation}>
                New Deck
              </button>
            </div>
          </header>

          <div className="workspace-quick-actions">
            {activeProject ? (
              <button type="button" className="secondary-button" onClick={() => setActiveProjectId(undefined)}>
                All workspace items
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={handleShareActiveProject}>
              Share project
            </button>
            <span>
              Showing {formatCountLabel(visibleItems.length, 'item')} in{' '}
              {activeProject?.name ?? currentSection?.label}
            </span>
          </div>

          {visibleItems.length > 0 ? (
            <div className={`workspace-items workspace-items--${viewMode}`}>
              {visibleItems.map((item) => {
                const menuKey = `${item.type}:${item.id}`

                return (
                  <WorkspaceItemCard
                    key={menuKey}
                    item={item}
                    viewMode={viewMode}
                    isMenuOpen={openMenuKey === menuKey}
                    onOpen={() => handleOpenItem(item)}
                    onMenuToggle={() =>
                      setOpenMenuKey((current) => (current === menuKey ? undefined : menuKey))
                    }
                    onMenuClose={() => setOpenMenuKey(undefined)}
                    onRename={() => handleRename(item)}
                    onDuplicate={() => handleDuplicate(item)}
                    onMove={() => handleMove(item)}
                    onToggleStar={() => {
                      toggleWorkspaceItemStarred(item.type, item.id)
                      setOpenMenuKey(undefined)
                    }}
                    onTrash={() => handleTrash(item)}
                    onRestore={() => handleRestore(item)}
                    onDeletePermanently={() => handleDeletePermanently(item)}
                  />
                )
              })}
            </div>
          ) : (
            <article className="workspace-empty-state">
              <span className="section-label">No items</span>
              <h3>No matching workspace items</h3>
              <p>
                Try a different section, clear the search, or create a new deck from the current
                project.
              </p>
              <button type="button" className="primary-button" onClick={handleCreatePresentation}>
                New Deck
              </button>
            </article>
          )}
        </div>
      </div>

      {selectedProject ? (
        <ShareProjectModal
          isOpen={Boolean(selectedProject)}
          title={`Share ${selectedProject.name}`}
          description="Apply comment-only collaboration settings across every deck in this project."
          initialSettings={projectShareSettings}
          onClose={() => setShareProjectId(undefined)}
          onSave={(settings) => updateProjectCollaboration(selectedProject.id, settings)}
        />
      ) : null}

      {moveItem ? (
        <MoveWorkspaceItemDialog
          item={moveItem}
          projects={workspace.projects}
          decks={workspace.decks}
          targetId={moveTargetId}
          onTargetChange={setMoveTargetId}
          onCancel={() => setMoveItem(undefined)}
          onMove={() => {
            moveWorkspaceItem(moveItem.type, moveItem.id, moveTargetId)
            setMoveItem(undefined)
          }}
        />
      ) : null}
    </section>
  )
}
