"use client";

import * as React from "react";

interface Toast {
  id: number;
  message: string;
}

const ToastContext = React.createContext<{ notify: (message: string) => void }>({
  notify: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const notify = React.useCallback((message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <p
            key={t.id}
            className="pointer-events-auto rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
