import { useCallback } from "react";

export default function useAvailabilityPolicyUpdate({
  effectiveRestaurantId,
  schedulingPolicy,
  updateSchedulingPolicy,
  refetchManagerWindows,
  refetchManagerSubmissions,
  stripTypenameDeep,
  showNotification,
  getGraphQLErrorMessage,
}) {
  return useCallback(
    async (draftInput) => {
      if (!effectiveRestaurantId) return;
      try {
        const basePolicy = stripTypenameDeep(schedulingPolicy || {});
        const nextInput = {
          ...basePolicy,
          availabilityRegistrationPolicy: {
            ...(basePolicy.availabilityRegistrationPolicy || {}),
            availabilityRegistrationMode:
              draftInput.availabilityRegistrationMode,
            availabilityOpenDayOffset: Number(
              draftInput.availabilityOpenDayOffset,
            ),
            availabilityOpenTime: draftInput.availabilityOpenTime,
            availabilityCloseDayOffset: Number(
              draftInput.availabilityCloseDayOffset,
            ),
            availabilityCloseTime: draftInput.availabilityCloseTime,
            lateChangeRequiresApproval:
              draftInput.lateChangeRequiresApproval !== false,
          },
        };
        await updateSchedulingPolicy({
          variables: {
            restaurantId: effectiveRestaurantId,
            input: nextInput,
          },
        });
        await refetchManagerWindows?.();
        await refetchManagerSubmissions?.();
        showNotification(
          "Đã cập nhật chế độ đăng ký lịch nhân viên.",
          "success",
        );
      } catch (error) {
        showNotification(
          getGraphQLErrorMessage(
            error,
            "Không thể cập nhật chính sách đăng ký lịch.",
          ),
          "error",
        );
      }
    },
    [
      effectiveRestaurantId,
      getGraphQLErrorMessage,
      refetchManagerSubmissions,
      refetchManagerWindows,
      schedulingPolicy,
      showNotification,
      stripTypenameDeep,
      updateSchedulingPolicy,
    ],
  );
}
