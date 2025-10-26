import React, { useState } from 'react'
import { Link } from 'lucide-react'
import { useTables } from '../../../../hooks/useTables'
import Modal from '../../../common/Modal'
import Button from '../../../common/Button'
import toast from 'react-hot-toast'
import './MergeTableModal.scss'

export default function MergeTableModal({ isOpen, open, onClose, sourceTableCode }) {
  const visible = isOpen ?? open
  const { tables, mergeTable, findTableByCode } = useTables()
  const [selectedTargetTable, setSelectedTargetTable] = useState('')

  const sourceTable = findTableByCode(sourceTableCode)
  const availableTables = Object.values(tables).flat().filter(table => table.code !== sourceTableCode && (table.status === 'available' || table.status === 'occupied'))

  const handleMerge = () => {
    if (!selectedTargetTable) { toast.error('Vui lòng chọn bàn đích!'); return }
    mergeTable(sourceTableCode, selectedTargetTable)
    onClose?.()
  }

  const handleClose = () => { setSelectedTargetTable(''); onClose?.() }
  if (!visible || !sourceTable) return null

  return (
    <Modal isOpen={visible} onClose={handleClose} title={`Gộp bàn ${sourceTableCode}`} size="md">
      <div className="merge-table-modal">
        <div className="source-table-info">
          <h4>Bàn nguồn:</h4>
          <div className="table-card"><div className="table-code">{sourceTable.code}</div><div className="table-details"><span>{sourceTable.capacity} chỗ</span>{sourceTable.customerName && <span>{sourceTable.customerName}</span>}</div></div>
        </div>

        <div className="target-table-selection">
          <h4>Chọn bàn đích:</h4>
          <div className="tables-grid">
            {availableTables.map(table => (
              <div key={table.code} className={`table-option ${selectedTargetTable === table.code ? 'selected' : ''}`} onClick={() => setSelectedTargetTable(table.code)}>
                <div className="table-code">{table.code}</div>
                <div className="table-details"><span>{table.capacity} chỗ</span><span className={`status status--${table.status}`}>{table.status === 'available' ? 'Trống' : 'Có khách'}</span></div>
                {table.customerName && <div className="customer-name">{table.customerName}</div>}
              </div>
            ))}
          </div>
        </div>

        {selectedTargetTable && (
          <div className="merge-preview">
            <h4>Kết quả sau khi gộp:</h4>
            <div className="preview-info"><Link size={16} /><span>Bàn {selectedTargetTable} sẽ có {sourceTable.capacity + (findTableByCode(selectedTargetTable)?.capacity || 0)} chỗ ngồi</span></div>
          </div>
        )}

        <div className="modal-actions">
          <Button variant="secondary" onClick={handleClose}>Hủy</Button>
          <Button variant="primary" onClick={handleMerge} disabled={!selectedTargetTable}><Link size={16}/> Gộp bàn</Button>
        </div>
      </div>
    </Modal>
  )

