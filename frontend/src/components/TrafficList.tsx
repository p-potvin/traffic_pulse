import React from 'react';
import { useTrafficStore } from '../store/useTrafficStore';
import { Activity, Clock, Navigation, AlertTriangle } from 'lucide-react';

export default function TrafficList() {
  const { incidents, loading, error, selectedIncident, setSelectedIncident, totalInBounds } = useTrafficStore();

  return (
    <div className="absolute top-6 bottom-6 right-6 w-96 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl z-20">
      
      {/* Header */}
      <div className="border-b border-white/10 p-6">
        <h2 className="flex items-center gap-3 font-mono text-xl font-bold tracking-tight text-white">
          <Activity className="h-6 w-6 text-red-500" />
          <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
            GLOBAL PULSE
          </span>
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Top 10 Severe Jams in Sector
          <span className="block text-xs text-zinc-500">(Total Jams Detected: {totalInBounds})</span>
        </p>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-red-400">
            <AlertTriangle className="mb-2 h-8 w-8" />
            <p className="text-sm">API Communication Error</p>
            <p className="text-xs text-red-500/70">{error}</p>
          </div>
        ) : loading && incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
            <div className="h-6 w-6 animate-pulse rounded-full bg-blue-500 mb-4"></div>
            Acquiring telemetry...
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
            <Navigation className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No significant traffic detected.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {incidents.map((inc, i) => {
              const delayMins = Math.round((inc.properties.delay || 0) / 60);
              const lengthKm = ((inc.properties.length || 0) / 1000).toFixed(1);
              const desc = inc.properties.events?.[0]?.description || 'Congestion';
              const isSelected = selectedIncident?.properties.id === inc.properties.id;

              return (
                <div
                  key={inc.properties.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-all duration-300
                    ${isSelected 
                      ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                      : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }
                  `}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold 
                      ${isSelected ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'}
                    `}>
                      {i + 1}
                    </span>
                    <span className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400">
                      <Clock className="h-3 w-3" /> +{delayMins}m
                    </span>
                  </div>

                  <h3 className="mb-2 font-mono text-sm font-semibold text-white line-clamp-2">
                    {desc}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <div>
                      <span className="block text-zinc-600">From</span>
                      <span className="truncate block">{inc.properties.from || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="block text-zinc-600">To</span>
                      <span className="truncate block">{inc.properties.to || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs font-medium text-zinc-500">{lengthKm} km jam</span>
                    <button className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                      Engage Fly-To →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
