import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import IncidentActionModal from './IncidentActionModal';

test('apply mode requires confirm and shows payroll warning', async () => {
  const onSubmit = vi.fn();
  render(<IncidentActionModal mode="apply" incident={{ proposedScoreDelta: -5 }} onClose={() => {}} onSubmit={onSubmit} />);
  expect(screen.getByText(/Không ảnh hưởng payroll/i)).toBeInTheDocument();
  expect(screen.getByText('Xác nhận')).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Tôi xác nhận áp điểm/i));
  expect(screen.getByText('Xác nhận')).not.toBeDisabled();
});

test('eligible mode blocks positive proposed delta', async () => {
  const onSubmit = vi.fn();
  render(<IncidentActionModal mode="eligible" incident={{ proposedScoreDelta: 1 }} onClose={() => {}} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByText('Xác nhận'));
  expect(await screen.findByText(/không được > 0/)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
