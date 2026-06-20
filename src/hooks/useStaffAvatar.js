import { gql, useMutation } from "@apollo/client";
import { useCallback, useState } from "react";
import { useAvatarUploadLocal } from "./useAvatarUploadLocal";

const operationSource = [
  "mutation UpdateStaff" + "Avatar($userId: ID!, $input: UpdateAvatarInput!) {",
  "  updateStaff" + "Avatar(userId: $userId, input: $input) {",
  "    id",
  "    fullName",
  "    avatarUrl",
  "    employeeCode",
  "    restaurantForStaff",
  "  }",
  "}",
].join("\n");

const UPDATE_STAFF_AVATAR = gql(operationSource);

const useStaffAvatar = () => {
  const [uploadingFile, setUploadingFile] = useState(false);
  const { upload } = useAvatarUploadLocal();
  const [mutateAvatar, state] = useMutation(UPDATE_STAFF_AVATAR);

  const updateStaffAvatar = useCallback(
    async (userId, { fileBase64, fileUrl } = {}) => {
      if (!userId) throw new Error("Thiếu mã nhân viên để cập nhật ảnh đại diện.");

      const response = await mutateAvatar({
        variables: {
          userId,
          input: {
            fileBase64: fileBase64 || null,
            fileUrl: fileUrl || null,
          },
        },
      });

      const updated = response?.data?.updateStaffAvatar;
      if (!updated?.id) {
        throw new Error("Không thể cập nhật ảnh đại diện nhân viên.");
      }
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

export { UPDATE_STAFF_AVATAR };
export default useStaffAvatar;
