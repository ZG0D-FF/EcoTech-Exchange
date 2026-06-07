export default async function handler(req, res) {
  // Add CORS headers so the frontend can query it if necessary
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const RENDER_API_KEY = process.env.RENDER_API_KEY;
  const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
  const BACKEND_URL = process.env.VITE_API_URL || 'https://ecotech-hr.onrender.com';

  let isBuilding = false;
  let isOffline = false;

  // 1. PING RENDER API (The Ultimate Source of Truth)
  // This detects "Zero-Downtime Deployments" before the server even shuts off!
  if (RENDER_API_KEY && RENDER_SERVICE_ID) {
    try {
      const renderRes = await fetch(`https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys?limit=1`, {
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      if (renderRes.ok) {
        const data = await renderRes.json();
        if (data && data.length > 0) {
          const status = data[0].deploy.status;
          // Render deploy statuses: created, build_in_progress, update_in_progress, live, build_failed, canceled, deactivated
          if (['created', 'build_in_progress', 'update_in_progress'].includes(status)) {
            isBuilding = true;
          }
        }
      } else {
        console.warn("Render API Ping failed. Status:", renderRes.status);
      }
    } catch (e) {
      console.error("Render API Network Error:", e);
    }
  }

  // 2. PING BACKEND HEARTBEAT (Detects Cold Starts / Sleeps)
  // If Render isn't building, we double check if the server went to sleep.
  if (!isBuilding) {
    try {
      // 3 second timeout for cold starts so Vercel function doesn't hang
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const healthRes = await fetch(`${BACKEND_URL}/hr/health`, { 
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      clearTimeout(timeoutId);
      
      if (!healthRes.ok) {
        isOffline = true;
      }
    } catch (e) {
      // AbortError or Network Error means it's asleep / offline
      isOffline = true;
    }
  }

  // 3. RETURN UNIFIED STATUS
  if (isBuilding) {
    return res.status(200).json({ status: 'building' });
  } else if (isOffline) {
    return res.status(200).json({ status: 'offline' });
  } else {
    return res.status(200).json({ status: 'online' });
  }
}
