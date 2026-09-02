import { generateHapticFeedback } from "@apps-in-toss/web-framework";

function fire(type: "success" | "tickWeak") {
  try {
    generateHapticFeedback({ type });
  } catch {
    /* no-op outside Toss WebView */
  }
}

export function useHaptic() {
  return {
    success: () => fire("success"),
    tickWeak: () => fire("tickWeak"),
  };
}
