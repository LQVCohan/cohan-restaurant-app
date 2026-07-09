import { gql, useMutation } from "@apollo/client";
import { useCallback, useState } from "react";
import { getGraphqlUrl } from "@/lib/apiBaseUrl";
import { emitStaffDataChanged } from "@/utils/staffSyncEvents";
import { useAvatarUploadLocal } from "./useAvatarUploadLocal";

const operationSource = [
  "mutation UpdateStaff" + "Avatar($userId: ID!, $input: UpdateAvatarInput!) {",
  "  updateStaff" + "Avatar(userId: $userId, input: $input) {",
  "    id",
  "    fullName",
  "    avatarUrl",
  "    employeeCode",
  "  }",
  "}",
].join("\n");

const UPDATE_STAFF_AVATAR = gql(operationSource);

const normalizeStoredAvatarUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  if (value.startsWith("/api/uploads/")) return value.slice(4);
  if (value.startsWith("/uploads/")) return value;

  try {
    const target = new URL(value);
    const graphqlUrl = getGraphqlUrl();
    const apiOrigin = graphqlUrl.startsWith("/") ? "" : new URL(graphqlUrl).origin;
    const isLoopbackHost = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(target.hostname);

    if (target.origin !== apiOrigin && !isLoopbackHost) return value;

    if (target.pathname.startsWith("/api/uploads/")) {
      return `${target.pathname.slice(4)}${target.search}`;
    }
    if (target.pathname.startsWith("/uploads/")) {
      return `${target.pathname}${target.search}`;
    }
  } catch {
    return value;
  }

  return value;
};

const useStaffAvatar = () => {
  const [uploadingFile, setUploadingFile] = useState(false);
  const { upload } = useAvatarUploadLocal();
  let mutateAvatar = async () => {
    throw new Error("Không thể cập nhật ảnh đại diện khi thiếu Apollo Client.");
  };
  let state = {};
  try {
    [mutateAvatar, state] = useMutation(UPDATE_STAFF_AVATAR);
  } catch (error) {
    state = { error };
  }

  const updateStaffAvatar = useCallback(
    async (userId, { fileBase64, fileUrl } = {}) => {
      if (!userId) throw new Error("Thiếu mã nhân viên để cập nhật ảnh đại diện.");

      const response = await mutateAvatar({
        variables: {
          userId,
          input: {
            fileBase64: fileBase64 || null,
            fileUrl: fileUrl ? normalizeStoredAvatarUrl(fileUrl) : null,
          },
        },
      });

      const updated = response?.data?.updateStaffAvatar;
      if (!updated?.id) {
        throw new Error("Không thể cập nhật ảnh đại diện nhân viên.");
      }

      emitStaffDataChanged({
        action: updated.avatarUrl ? "avatar-updated" : "avatar-removed",
        employeeId: updated.id,
        avatarUrl: updated.avatarUrl || "",
      });

      return updated;
    },
    [mutateAvatar],
  );

  const uploadStaffAvatar = useCallback(
    async (userId, file, onProgress) => {
      if (!file) throw new Error("Vui lòng chọn ảnh đại diện.");
      setUploadingFile(true);
      try {
        const uploadedUrl = await upload(file, onProgress);
        return await updateStaffAvatar(userId, { fileUrl: uploadedUrl });
      } finally {
        setUploadingFile(false);
      }
    },
    [updateStaffAvatar, upload],
  );

  const removeStaffAvatar = useCallback(
    (userId) => updateStaffAvatar(userId, {}),
    [updateStaffAvatar],
  );

  return {
    updateStaffAvatar,
    uploadStaffAvatar,
    removeStaffAvatar,
    uploadingAvatar: uploadingFile || state.loading,
    avatarError: state.error,
  };
};

export { UPDATE_STAFF_AVATAR, normalizeStoredAvatarUrl };
export default useStaffAvatar;
