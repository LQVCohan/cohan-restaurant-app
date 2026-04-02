import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";

export const Q_CHAT_THREADS = gql`
  query ChatThreads($restaurantId: ID, $channel: ChatChannel, $limit: Int = 30) {
    chatThreads(restaurantId: $restaurantId, channel: $channel, limit: $limit) {
      id
      restaurantId
      participants
      channel
      subject
      targetRole
      status
      lastMessageAt
      lastMessagePreview
      unreadCount
      updatedAt
    }
  }
`;

export const Q_CHAT_THREAD = gql`
  query ChatThread($id: ID!) {
    chatThread(id: $id) {
      id
      restaurantId
      participants
      channel
      subject
      targetRole
      status
      unreadCount
      messages(limit: 200) {
        senderId
        senderRole
        senderName
        messageType
        content
        createdAt
      }
    }
  }
`;

export const M_OPEN_CHAT_THREAD = gql`
  mutation OpenChatThread($input: OpenChatThreadInput!) {
    openChatThread(input: $input) {
      id
      restaurantId
      participants
      channel
      subject
      targetRole
      status
      unreadCount
      lastMessageAt
      lastMessagePreview
    }
  }
`;

export const M_SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($input: SendChatMessageInput!) {
    sendChatMessage(input: $input) {
      id
      unreadCount
      lastMessageAt
      lastMessagePreview
      messages(limit: 200) {
        senderId
        senderRole
        senderName
        content
        createdAt
      }
    }
  }
`;

export const M_MARK_THREAD_READ = gql`
  mutation MarkChatThreadRead($threadId: ID!) {
    markChatThreadRead(threadId: $threadId)
  }
`;

export const Q_NOTIFICATIONS = gql`
  query Notifications($restaurantId: ID, $unreadOnly: Boolean = false, $limit: Int = 50) {
    notifications(restaurantId: $restaurantId, unreadOnly: $unreadOnly, limit: $limit) {
      id
      toUserId
      toRole
      restaurantId
      type
      payload
      readAt
      createdAt
    }
  }
`;

export const Q_UNREAD_NOTIFICATION_COUNT = gql`
  query UnreadNotificationCount($restaurantId: ID) {
    unreadNotificationCount(restaurantId: $restaurantId)
  }
`;

export const M_MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id)
  }
`;

export const M_MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead($restaurantId: ID) {
    markAllNotificationsRead(restaurantId: $restaurantId)
  }
`;

export default function useCommunication({ restaurantId = null } = {}) {
  const threadsQuery = useQuery(Q_CHAT_THREADS, {
    variables: { restaurantId, limit: 30 },
    fetchPolicy: "cache-and-network",
    pollInterval: 6000,
  });

  const notificationsQuery = useQuery(Q_NOTIFICATIONS, {
    variables: { restaurantId, limit: 50 },
    fetchPolicy: "cache-and-network",
    pollInterval: 8000,
  });

  const unreadCountQuery = useQuery(Q_UNREAD_NOTIFICATION_COUNT, {
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
    pollInterval: 8000,
  });

  const [loadThread, threadState] = useLazyQuery(Q_CHAT_THREAD, {
    fetchPolicy: "network-only",
  });

  const [openThreadMut, openThreadState] = useMutation(M_OPEN_CHAT_THREAD);
  const [sendMessageMut, sendMessageState] = useMutation(M_SEND_CHAT_MESSAGE);
  const [markThreadReadMut] = useMutation(M_MARK_THREAD_READ);
  const [markNotificationReadMut] = useMutation(M_MARK_NOTIFICATION_READ);
  const [markAllNotificationsReadMut] = useMutation(M_MARK_ALL_NOTIFICATIONS_READ);

  return {
    threads: threadsQuery.data?.chatThreads || [],
    threadsLoading: threadsQuery.loading,
    refetchThreads: threadsQuery.refetch,

    notifications: notificationsQuery.data?.notifications || [],
    notificationsLoading: notificationsQuery.loading,
    unreadCount: Number(unreadCountQuery.data?.unreadNotificationCount || 0),
    refetchNotifications: notificationsQuery.refetch,

    thread: threadState.data?.chatThread || null,
    loadThread,

    openThread: openThreadMut,
    openThreadState,
    sendMessage: sendMessageMut,
    sendMessageState,
    markThreadRead: markThreadReadMut,
    markNotificationRead: markNotificationReadMut,
    markAllNotificationsRead: markAllNotificationsReadMut,
  };
}
