// src/components/Toast.jsx
import React from "react";

const BUS = "app:toast";

export function toast({
  title = "Thành công",
  message = "",
  type = "success", // success | info | warning | error
  duration = 2600,
} = {}) {
  window.dispatchEvent(
    new CustomEvent(BUS, {
      detail: { id: Date.now() + Math.random(), title, message, type, duration },
    })
  );
}

export function ToastHost() {
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    function onToast(e) {
      const t = e.detail;
      setItems((prev) => [...prev, t]);
      const timer = setTimeout(
        () => setItems((prev) => prev.filter((x) => x.id !== t.id)),
        t.duration || 2600
      );
      return () => clearTimeout(timer);
    }
    window.addEventListener(BUS, onToast);
    return () => window.removeEventListener(BUS, onToast);
  }, []);

  const color = {
    success: "bg-green-600",
    info: "bg-blue-600",
    warning: "bg-amber-500",
    error: "bg-red-600",
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-sm w-[92vw] sm:w-[380px] text-white shadow-lg rounded-lg overflow-hidden ${color[t.type] || color.success}`}
        >
          <div className="px-4 py-3 flex items-start gap-3">
            <div className="text-xl leading-none">✅</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.message ? (
                <div className="text-xs opacity-90 mt-0.5">{t.message}</div>
              ) : null}
            </div>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-white/80 hover:text-white"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
