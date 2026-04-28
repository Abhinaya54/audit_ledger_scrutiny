import type { ReactNode } from 'react';

type Variant = 'blue' | 'green' | 'red' | 'amber' | 'purple';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  variant?: Variant;
}

const VARIANT_STYLES: Record<Variant, { border: string; iconBg: string; value: string }> = {
  blue:   { border: 'border-teal-100',   iconBg: 'bg-teal-50 text-[#0F766E]',    value: 'text-[#134E4A]'  },
  green:  { border: 'border-green-100',  iconBg: 'bg-green-50 text-[#10B981]',   value: 'text-green-800'  },
  red:    { border: 'border-red-100',    iconBg: 'bg-red-50 text-[#EF4444]',     value: 'text-red-800'    },
  amber:  { border: 'border-amber-100',  iconBg: 'bg-amber-50 text-amber-600',   value: 'text-amber-800'  },
  purple: { border: 'border-purple-100', iconBg: 'bg-purple-50 text-purple-600', value: 'text-purple-800' },
};

export default function MetricCard({ label, value, subtitle, icon, variant = 'blue' }: MetricCardProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <div className={`bg-white rounded-2xl border ${s.border} p-5 shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-none">{label}</p>
        {icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
            {icon}
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold leading-tight ${s.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1.5 font-medium">{subtitle}</p>}
    </div>
  );
}
