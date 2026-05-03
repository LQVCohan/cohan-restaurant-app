import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import AppealReviewPanel from './AppealReviewPanel';

vi.mock('@/hooks/usePerformanceIncidentAppeals', () => ({
  usePerformanceIncidentAppeals: vi.fn(() => ({ data: { performanceIncidentAppeals: [{ id: 'a1', employeeId: 'e1', incidentId: 'i1', reason: 'x', status: 'accepted', scoreReversalStatus: 'pending' }] }, refetch: vi.fn() })),
  useReviewPerformanceIncidentAppeal: vi.fn(() => [vi.fn()]),
  useReverseScoreForAcceptedAppeal: vi.fn(() => [vi.fn()]),
}));

test('manager sees review and reversal actions', () => {
  render(<AppealReviewPanel restaurantId="r1" canReview isAccountant={false} />);
  expect(screen.getAllByText('accepted').length).toBeGreaterThan(0);
  expect(screen.getByText('Hoàn điểm')).toBeInTheDocument();
});

test('accountant does not see reversal action', () => {
  render(<AppealReviewPanel restaurantId="r1" canReview isAccountant />);
  expect(screen.queryByText('Hoàn điểm')).not.toBeInTheDocument();
});
