import { gql, useMutation } from "@apollo/client";

const REGISTER_MENU_AVAILABILITY_WATCH = gql`
  mutation RegisterMenuAvailabilityWatch($input: RegisterMenuAvailabilityWatchInput!) {
    registerMenuAvailabilityWatch(input: $input) {
      alreadyAvailable
      message
      watch {
        id
        restaurantId
        menuItemId
        servingKey
        desiredQuantity
        userId
        tableId
        tableCode
        source
        status
        expiresAt
      }
    }
  }
`;

const CANCEL_MENU_AVAILABILITY_WATCH = gql`
  mutation CancelMenuAvailabilityWatch($input: CancelMenuAvailabilityWatchInput!) {
    cancelMenuAvailabilityWatch(input: $input) {
      ok
      watch {
        id
        status
      }
    }
  }
`;

function extractGqlMessage(error, fallback) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    fallback
  );
}

export default function useMenuAvailabilityWatch() {
  const [registerMutation, registerState] = useMutation(
    REGISTER_MENU_AVAILABILITY_WATCH,
  );
  const [cancelMutation, cancelState] = useMutation(CANCEL_MENU_AVAILABILITY_WATCH);

  const registerWatch = async (input) => {
    try {
      const { data } = await registerMutation({ variables: { input } });
      return {
        success: true,
        data: data?.registerMenuAvailabilityWatch || null,
      };
    } catch (error) {
      return {
        success: false,
        message: extractGqlMessage(
          error,
          "Không thể đăng ký nhắc khi món có lại.",
        ),
      };
    }
  };

  const cancelWatch = async (watchId) => {
    try {
      const { data } = await cancelMutation({ variables: { input: { watchId } } });
      return {
        success: Boolean(data?.cancelMenuAvailabilityWatch?.ok),
        data: data?.cancelMenuAvailabilityWatch || null,
      };
    } catch (error) {
      return {
        success: false,
        message: extractGqlMessage(error, "Không thể hủy nhắc món."),
      };
    }
  };

  return {
    registerWatch,
    cancelWatch,
    registering: registerState.loading,
    cancelling: cancelState.loading,
  };
}
