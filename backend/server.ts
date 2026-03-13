import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import NodeCache from 'node-cache';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Cache API responses for 300 seconds (5 minutes) to stay well within free tier limits
const cache = new NodeCache({ stdTTL: 300 });

// Ensure you replace this in your .env file
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || 'REPLACE_ME';

app.get('/api/traffic', async (req, res) => {
    try {
        const { bbox, zoom } = req.query;
        if (!bbox) {
            return res.status(400).json({ error: 'bbox parameter is required (minLon,minLat,maxLon,maxLat)' });
        }

        const cacheKey = `traffic_${bbox}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            console.log(`[Cache Hit] Bbox: ${bbox}`);
            return res.json(cachedData);
        }

        console.log(`[API Call] Fetching data for Bbox: ${bbox} at Zoom: ${zoom}`);

        // We use TomTom Incident Details V5
        // It provides exact coordinate geometries and delay/length metadata.
        const url = `https://api.tomtom.com/traffic/services/5/incidentDetails`;
        const params = {
            key: TOMTOM_API_KEY,
            bbox: bbox,
            fields: '{incidents{geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers}}}',
            language: 'en-US'
        };

        const response = await axios.get(url, { params });
        let incidents = response.data.incidents || [];

        // Filter out non-traffic jams if needed (e.g., iconCategory 6 = traffic jam, but let's keep all for now to see what we get)
        
        // Process data into "Top 10 Worst Clusters" based on delay duration
        incidents.sort((a: any, b: any) => {
            const delayA = a.properties.delay || 0;
            const delayB = b.properties.delay || 0;
            return delayB - delayA; // descending order
        });

        const top10 = incidents.slice(0, 10);

        const result = {
            totalInBounds: incidents.length,
            incidents: top10
        };

        // Store the parsed Top 10 result in cache
        cache.set(cacheKey, result);

        res.json(result);
    } catch (error: any) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch traffic data from provider.' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Traffic Pulse Backend running on port ${PORT}`);
});
