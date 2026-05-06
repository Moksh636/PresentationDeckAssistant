import type { KnowledgeFolder } from '../types/models'

export interface KnowledgeFolderTreeNode {
  folder: KnowledgeFolder
  children: KnowledgeFolderTreeNode[]
}

/**
 * Returns a safe parent id for `folderId`: drops self-links, unknown parents, and cycles.
 */
export function normalizeKnowledgeFolderParent(
  folderId: string | undefined,
  parentFolderId: string | undefined,
  foldersById: Map<string, KnowledgeFolder>,
): string | undefined {
  if (!parentFolderId?.trim()) {
    return undefined
  }
  const parent = parentFolderId.trim()
  if (folderId && parent === folderId) {
    return undefined
  }
  const parentRow = foldersById.get(parent)
  if (!parentRow) {
    return undefined
  }
  if (!folderId) {
    return parent
  }
  const seen = new Set<string>()
  let walker: string | undefined = parent
  let depth = 0
  while (walker && depth < 64) {
    if (walker === folderId) {
      return undefined
    }
    if (seen.has(walker)) {
      return undefined
    }
    seen.add(walker)
    walker = foldersById.get(walker)?.parentFolderId
    depth++
  }
  return parent
}

export function buildKnowledgeFolderTree(folders: KnowledgeFolder[]): KnowledgeFolderTreeNode[] {
  const byParent = new Map<string | undefined, KnowledgeFolder[]>()
  for (const f of folders) {
    const p = f.parentFolderId
    const list = byParent.get(p) ?? []
    list.push(f)
    byParent.set(p, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  function walk(parentId: string | undefined): KnowledgeFolderTreeNode[] {
    const rows = byParent.get(parentId) ?? []
    return rows.map((folder) => ({
      folder,
      children: walk(folder.id),
    }))
  }

  return walk(undefined)
}

/** Indent label for flat selects (no drag-drop tree UI). */
export function flattenFolderTreeForSelect(nodes: KnowledgeFolderTreeNode[], depth = 0): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  const pad = depth === 0 ? '' : `${'— '.repeat(depth)}`
  for (const n of nodes) {
    out.push({ id: n.folder.id, label: `${pad}${n.folder.name}` })
    out.push(...flattenFolderTreeForSelect(n.children, depth + 1))
  }
  return out
}
