export default function TermItem({
  term,
  desc,
}: {
  term: string;
  desc: string;
}) {
  return (
    <div className="text-xs">
      <div className="font-medium text-slate-800">{term}</div>
      <div className="text-slate-500">{desc}</div>
    </div>
  );
}
