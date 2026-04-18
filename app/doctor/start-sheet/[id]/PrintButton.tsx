"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      style={{ boxShadow: "0 0 16px rgba(16,185,129,0.25)" }}
    >
      Print Patient Handout
    </button>
  );
}
