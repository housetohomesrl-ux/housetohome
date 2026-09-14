import clsx from "clsx";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("px-5 py-4", className)}>{children}</div>;
}
