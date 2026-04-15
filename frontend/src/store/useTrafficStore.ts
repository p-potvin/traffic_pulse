import { create } from 'zustand';

export interface TrafficIncident {
  geometry: {
    type: string;
    coordinates: number[][]; // LineString
  };
  properties: {
    id: string;
    magnitudeOfDelay: number;
    events: { description: string; code: number; iconCategory: number }[];
    startTime: string;
    endTime: string;
    from: string;
    to: string;
    length: number;
    delay: number;
    roadNumbers: string[];
  };
}

interface TrafficState {
  incidents: TrafficIncident[];
  totalInBounds: number;
  loading: boolean;
  selectedIncident: TrafficIncident | null;
  error: string | null;
  fetchTraffic: (bbox: [number, number, number, number], zoom: number) => Promise<void>;
  setSelectedIncident: (incident: TrafficIncident | null) => void;
}

export const useTrafficStore = create<TrafficState>((set) => ({
  incidents: [],
  totalInBounds: 0,
  loading: false,
  selectedIncident: null,
  error: null,

  fetchTraffic: async (bbox, zoom) => {
    set({ loading: true, error: null });
    try {
      const bboxStr = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
      const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/traffic?bbox=${bboxStr}&zoom=${zoom}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await res.json();
      set({ 
        incidents: data.incidents || [], 
        totalInBounds: data.totalInBounds || 0, 
        loading: false 
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setSelectedIncident: (incident) => set({ selectedIncident: incident })
}));
