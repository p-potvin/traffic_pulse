import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTrafficStore } from '../store/useTrafficStore';

// Access Mapbox Token from env
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function GlobeMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { fetchTraffic, incidents, selectedIncident, loading } = useTrafficStore();
  
  const [zoom, setZoom] = useState(3);
  const MIN_ZOOM_THRESHOLD = 6.0;

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: import.meta.env.VITE_MAPBOX_STYLE,
      center: [-74.0060, 40.7128], // Default to NYC
      zoom: 10,
      pitch: 45
    });

    // Add cinematic atmosphere
    map.current.on('style.load', () => {
      map.current?.setFog({
        color: 'rgb(20, 24, 34)', 
        'high-color': 'rgb(10, 20, 40)',
        'horizon-blend': 0.02,
        'space-color': 'rgb(0, 0, 5)',
        'star-intensity': 0.8
      });
    });

    const triggerFetch = () => {
        if (!map.current) return;
        const currentZoom = map.current.getZoom();
        setZoom(currentZoom);

        if (currentZoom >= MIN_ZOOM_THRESHOLD) {
            const bounds = map.current.getBounds();
            if (bounds) {
                // Fetch traffic for current bounding box
                fetchTraffic([
                    bounds.getWest(),
                    bounds.getSouth(),
                    bounds.getEast(),
                    bounds.getNorth()
                ], currentZoom);
            }
        }
    };

    // Load initial data
    map.current.on('load', triggerFetch);
    
    // Fetch data after moving (panning, zooming)
    map.current.on('moveend', triggerFetch);

    return () => map.current?.remove();
  }, [fetchTraffic]);

  // Handle rendering of incidents
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const sourceId = 'traffic-jams';
    const layerId = 'traffic-lines';

    // Remove existing layer if it exists to refresh
    if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
    }

    // Convert incidents to GeoJSON Features
    const features = incidents.map(inc => {
        // Handle TomTom geometry formatting (can be single array or array of arrays)
        let coords: number[][] = inc.geometry?.coordinates || [];
        if (coords.length > 0 && typeof (coords[0] as unknown as number[][])[0] !== 'number') {
           coords = (coords as unknown as number[][][]).flat();
        }

        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coords
            },
            properties: {
                id: inc.properties.id,
                delay: inc.properties.delay,
                magnitudeOfDelay: inc.properties.magnitudeOfDelay,
                description: inc.properties.events?.[0]?.description || 'Traffic'
            }
        };
    });

    map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: features as any
        }
    });

    // Add neon-like lines for traffic
    map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            // Color based on magnitude of delay (TomTom 0-4 scale)
            'line-color': [
                'match',
                ['get', 'magnitudeOfDelay'],
                4, '#ef4444', // Red - Major delay
                3, '#f97316', // Orange - Moderate
                2, '#eab308', // Yellow - Minor
                1, '#22c55e', // Green - Minimal
                '#a8a29e'     // Unknown
            ],
            'line-width': [
                'interpolate', ['linear'], ['zoom'],
                6, 2,
                12, 6,
                22, 12
            ],
            'line-opacity': 0.8
        }
    });

  }, [incidents]);

  // Handle Cinematic Fly-To for selected incident
  useEffect(() => {
    if (!map.current || !selectedIncident) return;

    let coords = selectedIncident.geometry?.coordinates || [];
    if (coords.length === 0) return;

    // Grab the first point in the jam to fly to
    let center = coords[0];
    if (typeof center[0] !== 'number') {
        center = center[0];
    }

    map.current.flyTo({
        center: center as [number, number],
        zoom: 15,
        pitch: 65,    // Tilt for 3D effect
        bearing: Math.floor(Math.random() * 90) - 45, // Slight random bearing for dynamic look
        duration: 3500, // 3.5 seconds
        essential: true,
        curve: 1.5
    });

  }, [selectedIncident]);

  return (
    <div className="relative h-screen w-full bg-black">
      <div ref={mapContainer} className="h-full w-full" />
      
      {/* Zoom Warning Overlay */}
      {zoom < MIN_ZOOM_THRESHOLD && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full border border-yellow-500/30 bg-black/80 px-6 py-3 font-mono text-sm text-yellow-400 backdrop-blur-md shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-opacity z-10 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          </span>
          Zoom in to scan traffic (Current Level: {zoom.toFixed(1)} | Target: {MIN_ZOOM_THRESHOLD.toFixed(1)}+)
        </div>
      )}

      {loading && zoom >= MIN_ZOOM_THRESHOLD && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full border border-blue-500/30 bg-black/80 px-6 py-3 font-mono text-sm text-blue-400 backdrop-blur-md z-10 flex items-center gap-3">
          <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Scanning Sector...
        </div>
      )}
    </div>
  );
}
