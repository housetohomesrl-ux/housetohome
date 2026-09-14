import clsx from "clsx";

export interface TabItem {
  id: string;
  label: string;
  badge?: React.ReactNode;
}

export function Tabs({
  items,
  activeId,
  onChange,
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto px-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={clsx(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              activeId === item.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
            )}
          >
            {item.label}
            {item.badge}
          </button>
        ))}
      </nav>
    </div>
  );
}
