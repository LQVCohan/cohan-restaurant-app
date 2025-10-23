import { useCallback, useState } from "react";

export default function useToast() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((text, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [{ id, text, type }, ...t]);
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  return { toasts, push, remove, clear };
}
