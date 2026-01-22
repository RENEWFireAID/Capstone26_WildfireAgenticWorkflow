export default function ChatItem({
  title,
  time,
}: {
  title: string;
  time: string;
}) {
  return (
    <div className="flex justify-between py-1 text-xs">
      <div className="max-w-[70%] text-slate-700">{title}</div>
      <div className="text-slate-400">{time}</div>
    </div>
  );
}
