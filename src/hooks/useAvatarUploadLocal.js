// src/hooks/useAvatarUploadLocal.js
import { getGraphqlUrl, toApiAssetUrl } from "@/lib/apiBaseUrl";
import { getToken, setAuth } from "@/lib/authStorage";
import { refreshAccessTokenOnce } from "@/lib/authRefresh";

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

const stripGraphqlSuffix = (value = "") =>
  String(value || "").replace(/\/graphql\/?$/, "").replace(/\/$/, "");

const getUploadBaseUrl = () => {
  const graphqlUrl = getGraphqlUrl();
  const base = stripGraphqlSuffix(graphqlUrl);

  // Upload routes are mounted at backend root: /upload, /upload/sign,
  // /upload/complete. Do not route these through /api.
  if (!base || base === "/") return "";
  if (base === "/api" || base.endsWith("/api")) {
    return base.replace(/\/api$/, "");
  }
  return base;
};

const toUploadUrl = (pathname) => `${getUploadBaseUrl()}${pathname}`;
const normalizeUploadedUrl = (url) => toApiAssetUrl(url);

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
      throw new Error(err?.message || "Cannot create signed upload URL");
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
          reject(new Error(`Direct upload failed (status ${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error while uploading"));
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
      throw new Error(completeData?.message || "Upload completion failed");
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
            new Error(`Invalid server response (status ${status})`),
          );
        }

        if (status >= 200 && status < 300 && res?.ok && res?.url) {
          resolve(normalizeUploadedUrl(res.url));
        } else {
          reject(
            new Error(
              res?.error || res?.message || `Upload failed (status ${status})`,
            ),
          );
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    });
  };

  const upload = async (file, onProgress) => {
    if (!file) throw new Error("No file selected");

    if (import.meta.env.VITE_UPLOAD_MODE === "local") {
      return uploadViaLocalApi(file, onProgress);
    }

    try {
      return await uploadViaSignedUrl(file, onProgress);
    } catch (error) {
      console.warn(
        "Signed avatar upload failed; falling back to local upload.",
        error,
      );
      return uploadViaLocalApi(file, onProgress);
    }
  };

  return { upload };
}
