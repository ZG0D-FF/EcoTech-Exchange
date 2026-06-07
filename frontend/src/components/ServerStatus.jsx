import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle2 } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ServerStatus() {
  const [status, setStatus] = useState('online'); // 'online', 'offline', 'recovering'
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    let interval;
    
    const checkPulse = async () => {
      try {
        // 1. Query the Vercel Watchdog (Bypass PWA cache)
        let res = await fetch(`/api/status?t=${Date.now()}`, { cache: 'no-store' });
        
        // Local Dev Fallback: If Vercel API is 404, fallback to pinging the Python backend directly
        if (res.status === 404) {
           res = await fetch(`${BASE_URL}/hr/health?t=${Date.now()}`, { cache: 'no-store' });
           if (!res.ok) throw new Error("Backend offline");
           handleOnlineTransition();
           return;
        }

        const data = await res.json();
        
        // 2. Process the unified state
        if (data.status === 'building' || data.status === 'offline') {
           setStatus('offline');
        } else {
           handleOnlineTransition();
        }

      } catch (err) {
        setStatus('offline');
      }
    };

    const handleOnlineTransition = () => {
      if (status === 'offline') {
        setStatus('recovering');
        setShowRecovered(true);
        setTimeout(() => {
          setShowRecovered(false);
          setStatus('online');
        }, 4000);
      } else {
        setStatus('online');
      }
    };

    // Ping every 15 seconds
    interval = setInterval(checkPulse, 15000);
    // Delay initial check slightly so it doesn't block main page load
    setTimeout(checkPulse, 2000);

    return () => clearInterval(interval);
  }, [status]);

  return (
    <>
      {/* 🛑 GLOBAL MUTATION LOCK: Invisible shield over the app when offline! */}
      {status === 'offline' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9998,
          cursor: 'wait',
          backgroundColor: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(1px)'
        }} />
      )}

      <AnimatePresence>
        {(status === 'offline' || showRecovered) && (
          <motion.div
            initial={{ y: -100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -100, opacity: 0, x: '-50%' }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 24px',
              borderRadius: '50px',
              background: status === 'offline' ? 'rgba(210, 153, 34, 0.95)' : 'rgba(35, 134, 54, 0.95)',
              color: '#ffffff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${status === 'offline' ? '#e3b341' : '#2ea043'}`,
              fontWeight: 600,
              fontSize: '0.95rem'
            }}
          >
            {status === 'offline' ? (
              <>
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Activity size={20} />
                </motion.div>
                Render server is currently deploying or waking up. Please wait...
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                Server Successfully Deployed & Online!
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
