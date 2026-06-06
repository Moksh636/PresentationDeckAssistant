import { useCallback, useState } from 'react'
import { RenameModal, type OpenRenameOptions } from './RenameModal'

export function useRenameModal() {
  const [request, setRequest] = useState<OpenRenameOptions | null>(null)

  const openRename = useCallback((options: OpenRenameOptions) => {
    setRequest(options)
  }, [])

  const closeRename = useCallback(() => {
    setRequest(null)
  }, [])

  const renameModal = request ? (
    <RenameModal
      isOpen
      title={request.title}
      initialValue={request.initialValue}
      inputLabel={request.inputLabel}
      saveLabel={request.saveLabel}
      onSave={(value) => {
        request.onSave(value)
        closeRename()
      }}
      onCancel={closeRename}
    />
  ) : null

  return { openRename, renameModal }
}
