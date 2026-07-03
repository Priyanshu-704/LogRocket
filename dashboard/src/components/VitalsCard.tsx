import React from 'react';

interface VitalsCardProps {
  name: 'FCP' | 'LCP' | 'CLS' | 'FID';
  value: number;
}

export const VitalsCard: React.FC<VitalsCardProps> = ({ name, value }) => {
  // Determine standard metric parameters
  let status: 'good' | 'average' | 'poor' = 'good';
  let formattedValue = '';
  let label = '';

  switch (name) {
    case 'FCP':
      label = 'First Contentful Paint';
      formattedValue = `${(value / 1000).toFixed(2)}s`;
      if (value > 3000) status = 'poor';
      else if (value > 1800) status = 'average';
      break;

    case 'LCP':
      label = 'Largest Contentful Paint';
      formattedValue = `${(value / 1000).toFixed(2)}s`;
      if (value > 4000) status = 'poor';
      else if (value > 2500) status = 'average';
      break;

    case 'CLS':
      label = 'Cumulative Layout Shift';
      formattedValue = value.toFixed(3);
      if (value > 0.25) status = 'poor';
      else if (value > 0.1) status = 'average';
      break;

    case 'FID':
      label = 'First Input Delay';
      formattedValue = `${value.toFixed(0)}ms`;
      if (value > 300) status = 'poor';
      else if (value > 100) status = 'average';
      break;
  }

  const statusColors = {
    good: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      pill: 'bg-emerald-500',
      message: 'Good'
    },
    average: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      pill: 'bg-amber-500',
      message: 'Needs Improvement'
    },
    poor: {
      text: 'text-rose-500',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      pill: 'bg-rose-500',
      message: 'Poor'
    }
  };

  const currentTheme = statusColors[status];

  return (
    <div className={`p-5 rounded-xl border bg-dark-900/60 ${currentTheme.border} backdrop-blur-sm flex flex-col justify-between h-40`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-dark-400">{name}</span>
          <h4 className="text-sm font-medium text-dark-200 mt-0.5">{label}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${currentTheme.text} ${currentTheme.bg}`}>
          {currentTheme.message}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span className="text-3xl font-extrabold tracking-tight text-white">{formattedValue}</span>
        {/* Simple mini bar visual */}
        <div className="w-24 h-1.5 bg-dark-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${currentTheme.pill}`}
            style={{ 
              width: status === 'good' ? '90%' : status === 'average' ? '50%' : '20%' 
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default VitalsCard;
