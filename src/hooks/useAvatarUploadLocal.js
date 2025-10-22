// src/hooks/useAvatarUploadLocal.js
export function useAvatarUploadLocal() {
  const upload = async (file, onProgress) => {
    if (!file) throw new Error("No file selected");

    const url = "http://localhost:4000/upload";

    const form = new FormData();
    form.append("file", file, file.name);

    const uploadedUrl = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true; // nếu server dùng cookie auth; nếu dùng Bearer token thì bỏ
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
            new Error(`Invalid server response (status ${status})`)
          );
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

    // chỉ trả về URL; mutation updateUser sẽ được gọi ở trang Profile khi user bấm "Lưu"
    return uploadedUrl;
  };

  return { upload };
}
