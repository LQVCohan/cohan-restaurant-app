import { render, screen } from '@testing-library/react';
import IncidentActionButtons from './IncidentActionButtons';

test('shows action buttons when capability true', () => {
  render(<IncidentActionButtons item={{ canReview: true, canWaive: true }} onAction={() => {}} />);
  expect(screen.getByText('Review')).toBeInTheDocument();
  expect(screen.getByText('Waive')).toBeInTheDocument();
});

test('shows readonly for accountant', () => {
  render(<IncidentActionButtons isAccountant item={{ canReview: true }} onAction={() => {}} />);
  expect(screen.getByText('Bạn chỉ có quyền xem')).toBeInTheDocument();
});
