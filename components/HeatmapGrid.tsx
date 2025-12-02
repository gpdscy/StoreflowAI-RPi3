import React, { useMemo } from 'react';
import { StoreZone } from '../types';

interface HeatmapGridProps {
  distribution: Record<StoreZone, number>;
}

const HeatmapGrid: React.FC<HeatmapGridProps> = ({ distribution }) => {
  const maxVal = useMemo(() => {
    // Explicitly cast to number[] because Object.values can sometimes be inferred as unknown[]
    const vals = Object.values(distribution) as number[];
    return Math.max(...vals, 1); // Avoid div by zero
  }, [distribution]);

  const zones: StoreZone[] = [
    StoreZone.TOP_LEFT, StoreZone.TOP_CENTER, StoreZone.TOP_RIGHT,
    StoreZone.MID_LEFT, StoreZone.MID_CENTER, StoreZone.MID_RIGHT,
    StoreZone.BOTTOM_LEFT, StoreZone.BOTTOM_CENTER, StoreZone.BOTTOM_RIGHT
  ];

  const getColor = (value: number) => {
    const intensity = value / maxVal;
    // Interpolate from transparent/blue to red
    // Low: rgba(59, 130, 246, 0.1) -> High: rgba(239, 68, 68, 0.8)
    if (intensity === 0) return 'rgba(30, 41, 59, 0.5)'; // Slate-800
    
    if (intensity < 0.3) return `rgba(59, 130, 246, ${0.2 + intensity})`; // Blueish
    if (intensity < 0.6) return `rgba(234, 179, 8, ${0.2 + intensity})`; // Yellowish
    return `rgba(239, 68, 68, ${0.3 + intensity})`; // Reddish
  };

  return (
    <div className="aspect-video w-full grid grid-cols-3 grid-rows-3 gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
      {zones.map((zone) => {
        const count = distribution[zone] || 0;
        return (
          <div
            key={zone}
            className="relative flex items-center justify-center rounded transition-colors duration-500"
            style={{ backgroundColor: getColor(count) }}
          >
            <span className="text-xs font-semibold text-white drop-shadow-md z-10">
              {count > 0 ? count : ''}
            </span>
            {/* Tooltip-ish label for the zone */}
            <span className="absolute bottom-1 right-1 text-[8px] text-slate-300 opacity-50 uppercase">
              {zone.replace('-', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default HeatmapGrid;