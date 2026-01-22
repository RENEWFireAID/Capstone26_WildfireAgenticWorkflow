export default function ToolButton({ label }: { label: string }) {
  return (
    <button className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 transition">
      {label}
    </button>
  );
}
