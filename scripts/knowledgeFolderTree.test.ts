import assert from 'node:assert/strict'
import {
  buildKnowledgeFolderTree,
  flattenFolderTreeForSelect,
  normalizeKnowledgeFolderParent,
} from '../src/data/knowledgeFolderTree.ts'
import type { KnowledgeFolder } from '../src/types/models.ts'

const org = 'org-1'

function folder(partial: Omit<KnowledgeFolder, 'organizationId' | 'createdAt' | 'updatedAt'> & Partial<KnowledgeFolder>): KnowledgeFolder {
  return {
    organizationId: org,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...partial,
  }
}

const root = folder({ id: 'root', name: 'Alpha' })
const child = folder({ id: 'child', name: 'Beta', parentFolderId: 'root' })
const badCycle = folder({ id: 'loop', name: 'Loop', parentFolderId: 'self' })

assert.equal(normalizeKnowledgeFolderParent('root', 'root', new Map([[root.id, root]])), undefined)
assert.equal(normalizeKnowledgeFolderParent(undefined, 'root', new Map([[root.id, root]])), 'root')

const map = new Map([root, child, badCycle].map((f) => [f.id, f]))
assert.equal(normalizeKnowledgeFolderParent('child', 'missing', map), undefined)
assert.equal(normalizeKnowledgeFolderParent('child', 'child', map), undefined)

const tree = buildKnowledgeFolderTree([child, root])
assert.equal(tree.length, 1)
assert.equal(tree[0].folder.id, 'root')
assert.equal(tree[0].children.length, 1)
assert.equal(tree[0].children[0].folder.id, 'child')

const flat = flattenFolderTreeForSelect(tree)
assert.ok(flat.some((r) => r.id === 'child' && r.label.includes('Beta')))
