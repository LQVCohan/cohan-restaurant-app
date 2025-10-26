import React, { useState, useEffect } from 'react'
import { Users, Plus, Minus, Calculator, DollarSign } from 'lucide-react'
import { usePOS } from '../../../../context/PosContext'
import { formatPrice } from '../../../../utils/formatters'
import Modal from '../../../common/Modal'
import Button from '../../../common/Button'
import Input from '../../../common/Input'
import toast from 'react-hot-toast'
import './SplitBillModal.scss'

export default function SplitBillModal({ isOpen, open, onClose, tableCode }) {
  const visible = isOpen ?? open
  const { state, dispatch } = usePOS()
  const [splitMethod, setSplitMethod] = useState('equal')
  const [numberOfPeople, setNumberOfPeople] = useState(2)
  const [customAmounts, setCustomAmounts] = useState([])
  const [itemAssignments, setItemAssignments] = useState({})
  const [people, setPeople] = useState([])
  const [showPaymentOptions, setShowPaymentOptions] = useState(false)

  const currentTable = state.tables?.[tableCode]
  const currentOrder = currentTable?.currentOrder || { items: [], total: 0 }

  useEffect(() => { if (visible && currentOrder.items.length > 0) initializeSplit() }, [visible, currentOrder])

  const initializeSplit = () => {
    const initialPeople = Array.from({ length: numberOfPeople }, (_, index) => ({ id: index + 1, name: `Người ${index + 1}`, amount: 0, items: [], paymentMethod: 'cash' }))
    setPeople(initialPeople)
    const equalAmount = Math.round(currentOrder.total / numberOfPeople)
    setCustomAmounts(Array(numberOfPeople).fill(equalAmount))
    const assignments = {}
    currentOrder.items.forEach(item => { assignments[item.id] = Array(numberOfPeople).fill(false) })
    setItemAssignments(assignments)
    calculateSplit()
  }

  const calculateSplit = () => {
    let updatedPeople = [...people]
    switch (splitMethod) {
      case 'equal': {
        const equalAmount = Math.round(currentOrder.total / numberOfPeople)
        updatedPeople = updatedPeople.map(p => ({ ...p, amount: equalAmount, items: [...currentOrder.items] }))
        break
      }
      case 'custom': {
        updatedPeople = updatedPeople.map((p, i) => ({ ...p, amount: customAmounts[i] || 0, items: [...currentOrder.items] }))
        break
      }
      case 'items': {
        updatedPeople = updatedPeople.map((p, idx) => {
          const assigned = currentOrder.items.filter(it => itemAssignments[it.id] && itemAssignments[it.id][idx])
          const totalAmount = assigned.reduce((s, it) => s + (it.total || 0), 0)
          return { ...p, amount: totalAmount, items: assigned }
        })
        break
      }
    }
    setPeople(updatedPeople)
  }

  useEffect(() => { if (people.length > 0) calculateSplit() }, [splitMethod, numberOfPeople, customAmounts, itemAssignments])

  const handleNumberOfPeopleChange = (newNumber) => {
    const validNumber = Math.max(2, Math.min(10, newNumber))
    setNumberOfPeople(validNumber)
    const newCustom = [...customAmounts]
    const newPeople = [...people]
    if (validNumber > customAmounts.length) {
      const equalAmount = Math.round(currentOrder.total / validNumber)
      for (let i = customAmounts.length; i < validNumber; i++) { newCustom.push(equalAmount); newPeople.push({ id: i+1, name: `Người ${i+1}`, amount: 0, items: [], paymentMethod: 'cash' }) }
    } else { newCustom.splice(validNumber); newPeople.splice(validNumber) }
    setCustomAmounts(newCustom); setPeople(newPeople)
    const newAssignments = { ...itemAssignments }
    Object.keys(newAssignments).forEach(itemId => {
      if (validNumber > newAssignments[itemId].length) for (let i = newAssignments[itemId].length; i < validNumber; i++) newAssignments[itemId].push(false)
      else newAssignments[itemId].splice(validNumber)
    })
    setItemAssignments(newAssignments)
  }

  const handleCustomAmountChange = (index, amount) => { const newAmounts = [...customAmounts]; newAmounts[index] = parseFloat(amount) || 0; setCustomAmounts(newAmounts) }
  const handleItemAssignment = (itemId, personIndex) => { const na = { ...itemAssignments }; na[itemId][personIndex] = !na[itemId][personIndex]; setItemAssignments(na) }
  const handlePersonNameChange = (index, name) => { const np = [...people]; np[index].name = name; setPeople(np) }
  const handlePaymentMethodChange = (index, method) => { const np = [...people]; np[index].paymentMethod = method; setPeople(np) }
  const getTotalAssigned = () => people.reduce((s, p) => s + (p.amount || 0), 0)
  const getRemainingAmount = () => currentOrder.total - getTotalAssigned()
  const isValidSplit = () => Math.abs(currentOrder.total - getTotalAssigned()) < 1000

  const handleProcessSplit = () => {
    if (!isValidSplit()) { toast.error('Tổng tiền chia không khớp với hóa đơn!'); return }
    const splitBills = people.map(person => ({ id: `${tableCode}-${person.id}-${Date.now()}`, tableCode, personName: person.name, items: person.items, total: person.amount, paymentMethod: person.paymentMethod, createdAt: new Date(), status: 'pending' }))
    dispatch({ type: 'SPLIT_BILL', payload: { tableCode, splitBills } })
    toast.success(`Đã chia hóa đơn thành ${people.length} phần!`)
    setShowPaymentOptions(true)
  }

  const handlePayBill = (billIndex) => {
    const bill = people[billIndex]
    dispatch({ type: 'PROCESS_SPLIT_PAYMENT', payload: { tableCode, billId: `${tableCode}-${bill.id}`, amount: bill.amount, paymentMethod: bill.paymentMethod } })
    toast.success(`Đã thanh toán cho ${bill.name}: ${formatPrice(bill.amount)}`)
    const np = [...people]; np[billIndex].status = 'paid'; setPeople(np)
  }

  const handleFinishSplit = () => {
    const unpaid = people.filter(p => p.status !== 'paid')
    if (unpaid.length > 0 && !window.confirm(`Còn ${unpaid.length} hóa đơn chưa thanh toán. Bạn có muốn tiếp tục?`)) return
    onClose?.(); toast.success('Hoàn thành chia hóa đơn!')
  }

  if (!visible) return null
  if (!currentOrder.items.length) return (
    <Modal isOpen={visible} onClose={onClose} title="Chia hóa đơn" size="md">
      <div className="split-bill-modal"><div className="empty-order"><Calculator size={48} /><h3>Không có đơn hàng</h3><p>Bàn {tableCode} chưa có đơn hàng để chia.</p><Button variant="primary" onClick={onClose}>Đóng</Button></div></div>
    </Modal>
  )

  return (
    <Modal isOpen={visible} onClose={onClose} title={`Chia hóa đơn - Bàn ${tableCode}`} size="xl">
      <div className="split-bill-modal">
        {!showPaymentOptions ? (
          <>
            <div className="order-summary">
              <div className="summary-header"><h3>Thông tin hóa đơn</h3><div className="total-amount">{formatPrice(currentOrder.total)}</div></div>
              <div className="order-items">{currentOrder.items.map(item => (<div key={item.id} className="order-item"><span className="item-name">{item.name}</span><span className="item-quantity">x{item.quantity}</span><span className="item-price">{formatPrice(item.total)}</span></div>))}</div>
            </div>

            <div className="split-methods">
              <h3>Phương thức chia</h3>
              <div className="method-options">
                <label className={`method-option ${splitMethod === 'equal' ? 'active' : ''}`}><input type="radio" value="equal" checked={splitMethod==='equal'} onChange={(e) => setSplitMethod(e.target.value)} /><div className="option-content"><Users size={20} /><div><div className="option-title">Chia đều</div><div className="option-description">Chia đều cho tất cả mọi người</div></div></div></label>
                <label className={`method-option ${splitMethod === 'custom' ? 'active' : ''}`}><input type="radio" value="custom" checked={splitMethod==='custom'} onChange={(e) => setSplitMethod(e.target.value)} /><div className="option-content"><Calculator size={20} /><div><div className="option-title">Tùy chỉnh</div><div className="option-description">Nhập số tiền cho từng người</div></div></div></label>
                <label className={`method-option ${splitMethod === 'items' ? 'active' : ''}`}><input type="radio" value="items" checked={splitMethod==='items'} onChange={(e) => setSplitMethod(e.target.value)} /><div className="option-content"><DollarSign size={20} /><div><div className="option-title">Theo món</div><div className="option-description">Phân chia theo từng món ăn</div></div></div></label>
              </div>
            </div>

            <div className="people-selector">
              <h3>Số người</h3>
              <div className="people-controls">
                <button className="people-btn" onClick={() => handleNumberOfPeopleChange(numberOfPeople - 1)} disabled={numberOfPeople <= 2}><Minus size={16} /></button>
                <span className="people-count">{numberOfPeople} người</span>
                <button className="people-btn" onClick={() => handleNumberOfPeopleChange(numberOfPeople + 1)} disabled={numberOfPeople >= 10}><Plus size={16} /></button>
              </div>
            </div>

            <div className="split-configuration">{/* custom / items UI simplified for brevity */}
              {splitMethod === 'custom' && (<div className="custom-amounts"><h3>Nhập số tiền cho từng người</h3><div className="amounts-grid">{people.map((p, idx) => (<div key={p.id} className="amount-input"><Input label={`${p.name}:`} type="number" value={customAmounts[idx]||0} onChange={(e)=>handleCustomAmountChange(idx,e.target.value)} /></div>))}</div></div>)}
              {splitMethod === 'items' && (<div className="item-assignments"><h3>Phân chia theo món</h3><div className="assignments-table"><div className="table-header"><div className="item-column">Món ăn</div>{people.map(person=> (<div key={person.id} className="person-column"><input type="text" value={person.name} onChange={e=>handlePersonNameChange(person.id-1,e.target.value)} className="person-name-input"/></div>))}</div>{currentOrder.items.map(item => (<div key={item.id} className="assignment-row"><div className="item-info"><div className="item-name">{item.name}</div><div className="item-price">{formatPrice(item.total)}</div></div>{people.map((person, personIndex)=> (<div key={person.id} className="assignment-cell"><input type="checkbox" checked={itemAssignments[item.id]?.[personIndex]||false} onChange={()=>handleItemAssignment(item.id, personIndex)} /></div>))}</div>))}</div></div>)}
            </div>

            <div className="split-summary"><h3>Tóm tắt chia hóa đơn</h3><div className="summary-grid">{people.map((person, index)=> (<div key={person.id} className="person-summary"><div className="person-header"><span className="person-name">{person.name}</span><span className="person-amount">{formatPrice(person.amount)}</span></div>{splitMethod==='items' && (<div className="person-items">{person.items.map(it=> (<div key={it.id} className="person-item">{it.name} x{it.quantity}</div>))}</div>)}</div>))}</div><div className="summary-totals"><div className="total-row"><span>Tổng đã chia:</span><span>{formatPrice(getTotalAssigned())}</span></div><div className="total-row"><span>Tổng hóa đơn:</span><span>{formatPrice(currentOrder.total)}</span></div><div className={`total-row ${getRemainingAmount() !== 0 ? 'error' : 'success'}`}><span>Chênh lệch:</span><span>{formatPrice(getRemainingAmount())}</span></div></div></div>

            <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button variant="primary" onClick={handleProcessSplit} disabled={!isValidSplit()}>Chia hóa đơn</Button></div>
          </>
        ) : (
          <div className="payment-options">
            <h3>Thanh toán từng phần</h3>
            <div className="payment-grid">{people.map((person,index)=>(<div key={person.id} className={`payment-card ${person.status==='paid'?'paid':''}`}><div className="payment-header"><span className="person-name">{person.name}</span><span className="person-amount">{formatPrice(person.amount)}</span>{person.status==='paid' && (<span className="paid">✓</span>)}</div>{person.status!=='paid' && (<div className="payment-controls"><select value={person.paymentMethod} onChange={e=>handlePaymentMethodChange(index,e.target.value)} className="payment-method-select"><option value="cash">Tiền mặt</option><option value="card">Thẻ</option><option value="transfer">Chuyển khoản</option><option value="ewallet">Ví điện tử</option></select><Button variant="success" size="sm" onClick={()=>handlePayBill(index)}>Thanh toán</Button></div>)}</div>))}</div>

            <div className="payment-actions"><Button variant="secondary" onClick={()=>setShowPaymentOptions(false)}>Quay lại</Button><Button variant="primary" onClick={handleFinishSplit}>Hoàn thành</Button></div>
          </div>
        )}
      </div>
    </Modal>
  )

