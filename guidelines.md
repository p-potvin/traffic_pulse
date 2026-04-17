# Project Prompt & Outline: "Global Traffic Pulse"

## Agent Instructions

- Act as a Senior Full-Stack Developer. Your goal is to build a web application that visualizes real-time traffic hot spots on a 3D globe, ranks the top 10 worst traffic clusters, and features interactive fly-to animations. Follow the architectural outline below. You do not need to build persistent database storage.

## Phase 1: API Research & Cost Strategy (Critical Path)

- Before writing UI code, investigate and lock in the data providers.
- The Google Maps Reality Check: Verify the capabilities of the Google Maps Platform. Note that the JS API TrafficLayer is visual-only.
- Raw Data Provider Selection: To generate the "Top 10 Clusters" table, find an API that returns raw bounding-box traffic data (coordinates, delay times, lengths).
- Primary recommendations to investigate: TomTom Traffic Incidents API, HERE Traffic API, or Bing Maps Traffic. Determine which has the most generous free tier for bounding-box requests.
- Budget & Rate Limiting: Calculate the maximum bounding box size and the polling frequency allowed to stay entirely within the chosen provider's free tier.

## Phase 2: Tech Stack & Architecture

- Determine and initialize the optimal stack for a high-performance, stateless app.
- Frontend Framework: React (Vite) or Next.js.
- 3D Globe/Map Engine: Evaluate Mapbox GL JS (which has a native 3D globe projection and excellent fly-to animations) or CesiumJS. Note: Google Maps JS API now supports WebGL 3D globes, but matching it with third-party traffic data might be complex.
- Backend/Proxy: A lightweight Node.js/Express server or Next.js API routes. Constraint: The frontend must never make direct calls to the traffic APIs to prevent exposing private API keys.
- State Management: React Context or Zustand to manage the currently selected region, the active Top 10 list, and the selected cluster.

## Phase 3: Core Features Development

### 1. The Interactive Globe

- Render a 3D globe as the primary interface.
- Implement a search bar allowing users to enter a city, state, or country.
- Use a Geocoding API to convert the search input into bounding box coordinates.
- Cost-Control Logic: If the user's viewport or searched region exceeds the maximum allowed bounding box size (based on Phase 1 research), prompt the user to zoom in or automatically restrict the query to the center of         their screen.

### 2. Traffic Visualization Layer

- Overlay the visual traffic data onto the globe. Ensure the color scheme matches standard mental models (Green = Fast, Yellow = Moderate, Red/Dark Red = Severe).
- Note: If using Mapbox or TomTom, integrate their native traffic vector tile layers for performance.

### 3. The Top 10 Data Processing & Table

- Fetch raw traffic incidents for the current bounding box.
- Process the data into an array of "Clusters/Jams."
- Sort the array by severity (a calculated metric based on delay_time and jam_length).
- Table Columns:

  - Location/Street Name (Clickable link)
  - Expected Delay Duration (e.g., "+ 25 mins")
  - Average Speed inside the cluster
  - Distance/Length of the jam
  - Constraint Check: (Note to agent: "Number of people inside" is not generally available via public APIs; omit this unless a specific proxy metric is found).

### 4. Interactive Navigation & Modes

- Fly-To Animation: When a user clicks a row in the Top 10 table, trigger a smooth 3D camera flight to the exact coordinates of the traffic cluster, adjusting pitch and bearing to highlight the street.
- Local vs. Global Mode:

- Local Mode: Fetches data based on the user's current map viewport. Update the list via a "Refresh Area" button to avoid spamming the API on every pan/zoom.
- Global Mode: Because you cannot query the entire earth at once on a free tier, hardcode a background routine that cycles through 10-15 major global metropolises (e.g., LA, Tokyo, London, Mumbai), fetches their                 data, and aggregates a "Top 10 Global" list in memory.

## Phase 4: Final Polish

- Implement an in-memory cache (e.g., node-cache on the backend) that caches traffic responses for 3-5 minutes per region. If two users search "New York" simultaneously, only one API call is made.
- Ensure UI responsiveness, placing the globe in the background/main view and the data table as an overlay or sidebar.
