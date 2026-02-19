// src/hooks/useAvatarUploadLocal.js
const API_BASE = "http://localhost:4000";

export function useAvatarUploadLocal() {
  const uploadViaSignedUrl = async (file, onProgress) => {
    const signRes = await fetch(`${API_BASE}/upload/sign`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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

    const completeRes = await fetch(`${API_BASE}/upload/complete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: signData.key }),
    });
    const completeData = await completeRes.json().catch(() => ({}));

    if (!completeRes.ok || !completeData?.ok || !completeData?.url) {
      throw new Error(completeData?.message || "Upload completion failed");
    }

    return completeData.url;
  };

  const uploadViaLocalApi = async (file, onProgress) => {
    const form = new FormData();
    form.append("file", file, file.name);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/upload`);
      xhr.withCredentials = true;
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
          return reject(new Error(`Invalid server response (status ${status})`));
        }
        if (status >= 200 && status < 300 && res?.ok && res?.url) {
          resolve(res.url);
        } else {
          reject(
            new Error(
              res?.error || res?.message || `Upload failed (status ${status})`
            )
          );
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    });
  };

  const upload = async (file, onProgress) => {
    if (!file) throw new Error("No file selected");

    try {
      return await uploadViaSignedUrl(file, onProgress);
    } catch (error) {
      if (String(error?.message || "").includes("Cannot create signed upload URL")) {
        return uploadViaLocalApi(file, onProgress);
      }
      throw error;
    }
  };

  return { upload };
}
