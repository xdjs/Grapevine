import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // More comprehensive mobile detection
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent.toLowerCase();
      
      // Check multiple indicators
      const isMobileByWidth = width <= 768;
      const isMobileByUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isMobileByTouch = 'ontouchstart' in window;
      const isMobileByOrientation = window.orientation !== undefined;
      
      const isMobileDevice = isMobileByWidth || isMobileByUserAgent || isMobileByTouch || isMobileByOrientation;
      
      console.log('📱 [Mobile Detection] Checking device:', {
        width,
        height,
        userAgent: userAgent.substring(0, 50) + '...',
        isMobileByWidth,
        isMobileByUserAgent,
        isMobileByTouch,
        isMobileByOrientation,
        finalResult: isMobileDevice
      });
      
      setIsMobile(isMobileDevice);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    window.addEventListener('orientationchange', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
      window.removeEventListener('orientationchange', checkIsMobile);
    };
  }, []);

  return isMobile;
}

export function useViewportHeight() {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
}
