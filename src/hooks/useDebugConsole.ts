import { useEffect } from 'react'; 
export function useDebugConsole() { 
  useEffect(() => { 
    const originalOnError = window.onerror;
    window.onerror = (msg, url, line, col, error) => { 
      alert('Global Error: ' + msg); 
      if (originalOnError) return originalOnError(msg, url, line, col, error);
      return false;
    }; 
    
    const originalOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (e) => { 
      alert('Promise Error: ' + e.reason); 
      if (originalOnUnhandledRejection) return originalOnUnhandledRejection(e);
      return false;
    }; 
  }, []); 
}
