import { render, screen } from '@testing-library/react';
import IncidentActionButtons from './IncidentActionButtons';

test('shows all action buttons based on capability flags', () => {
  render(<IncidentActionButtons item={{ canReview: true, canWaive: true, canMarkEligible: true, canApplyScore: true }} onAction={() => {}} />);
  expect(screen.getByText('Review')).toBeInTheDocument();
  expect(screen.getByText('Waive')).toBeInTheDocument();
  expect(screen.getByText('Mark eligible')).toBeInTheDocument();
  expect(screen.getByText('Apply score')).toBeInTheDocument();
});

test('hides actions when no capability', () => {
  render(<IncidentActionButtons item={{ canReview: false, canWaive: false }} onAction={() => {}} />);
  expect(screen.getByText('Bạn chỉ có quyền xem')).toBeInTheDocument();
});

test('shows readonly for accountant', () => {
  render(<IncidentActionButtons isAccountant item={{ canReview: true }} onAction={() => {}} />);
  expect(screen.getByText('Bạn chỉ có quyền xem')).toBeInTheDocument();
});
