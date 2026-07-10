// src/hooks/useAvatarUploadLocal.js
import { toApiAssetUrl, toBackendRootUrl } from "@/lib/apiBaseUrl";
import { getToken, setAuth } from "@/lib/authStorage";
import { refreshAccessTokenOnce } from "@/lib/authRefresh";
import { compressImageForUpload } from "@/utils/compressAvatar";

const getAuthHeader = async () => {
  let token = getToken();

  if (!token) {
    const payload = await refreshAccessTokenOnce();
    if (payload?.token) {
      setAuth({ token: payload.token });
      token = payload.token;
    }
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const toUploadUrl = (pathname) => toBackendRootUrl(pathname);
const normalizeUploadedUrl = (url) => toApiAssetUrl(url);

const prepareUploadFile = async (file) => {
  if (!file) throw new Error("Vui lòng chọn ảnh trước khi tải lên.");
  if (!String(file.type || "").startsWith("image/")) return file;

  return compressImageForUpload(file, {
    maxDimension: 1600,
    targetMaxBytes: 1800 * 1024,
    quality: 0.82,
  });
};

export function useAvatarUploadLocal() {
  const uploadViaSignedUrl = async (file, onProgress) => {
    const authHeader = await getAuthHeader();

    const signRes = await fetch(toUploadUrl("/upload/sign"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({
        mimeType: file.type,
        extension: file.name.split(".").pop()?.toLowerCase(),
        fileSize: file.size,
      }),
    });

    if (!signRes.ok) {
      const err = await signRes.json().catch(() => ({}));
      throw new Error(err?.message || "Không thể chuẩn bị tải ảnh lên.");
    }

    const signData = await signRes.json();

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(signData.method || "PUT", signData.uploadUrl);
      if (signData?.headers) {
        Object.entries(signData.headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
      }
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && typeof onProgress === "function") {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error("Không thể tải ảnh lên. Vui lòng thử lại."));
        }
      };
      xhr.onerror = () => reject(new Error("Kết nối bị gián đoạn khi tải ảnh lên."));
      xhr.send(file);
    });

    const completeRes = await fetch(toUploadUrl("/upload/complete"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ key: signData.key }),
    });
    const completeData = await completeRes.json().catch(() => ({}));

    if (!completeRes.ok || !completeData?.ok || !completeData?.url) {
      throw new Error(completeData?.message || "Ảnh đã tải lên nhưng chưa lưu được. Vui lòng thử lại.");
    }

    return normalizeUploadedUrl(completeData.url);
  };

  const uploadViaLocalApi = async (file, onProgress) => {
    const authHeader = await getAuthHeader();

    const form = new FormData();
    form.append("file", file, file.name);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", toUploadUrl("/upload"));
      xhr.withCredentials = true;

      Object.entries(authHeader).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && typeof onProgress === "function") {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onload = () => {
        const status = xhr.status;
        let res;
        try {
          res = JSON.parse(xhr.responseText);
        } catch {
          return reject(
            new Error("Hệ thống trả về phản hồi chưa hợp lệ. Vui lòng thử lại."),
          );
        }

        if (status >= 200 && status < 300 && res?.ok && res?.url) {
          resolve(normalizeUploadedUrl(res.url));
        } else {
          reject(
            new Error(
              res?.error || res?.message || "Không thể tải ảnh lên. Vui lòng thử lại.",
            ),
          );
        }
      };

      xhr.onerror = () => reject(new Error("Kết nối bị gián đoạn khi tải ảnh lên."));
      xhr.send(form);
    });
  };

  const upload = async (file, onProgress) => {
    const uploadFile = await prepareUploadFile(file);

    if (import.meta.env.VITE_UPLOAD_MODE === "local") {
      return uploadViaLocalApi(uploadFile, onProgress);
    }

    try {
      return await uploadViaSignedUrl(uploadFile);
    } catch (error) {
      console.warn(
        "Signed avatar upload failed; falling back to local upload.",
        error,
      );
      return uploadViaLocalApi(uploadFile, onProgress);
    }
  };

  return { upload };
}
