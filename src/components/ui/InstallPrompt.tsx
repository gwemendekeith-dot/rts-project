import React, { useState, useEffect } from 'react';
import { Download, X, Wifi, WifiOff } from 'lucide-react';

// ─── Offline status banner ─────────────────────────────────────────────────────
export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-amber-950 text-xs font-bold px-4 py-2 shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You're offline — drafts are saved locally. Reads will use cached data.</span>
    </div>
  );
};

// ─── Online-restored toast ─────────────────────────────────────────────────────
export const ReconnectedToast: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleOnline = () => {
      setShow(true);
      timer = setTimeout(() => setShow(false), 4000);
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl animate-fade-in">
      <Wifi className="w-4 h-4" />
      <span>Back online — data will sync automatically.</span>
    </div>
  );
};

// ─── PWA Install Prompt ────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa-install-dismissed') === '1';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-[100] max-w-xs w-full">
      <div className="bg-slate-900 border border-rafiki-500/40 rounded-2xl p-4 shadow-2xl shadow-black/40 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-rafiki-500/10 p-1.5 rounded-lg">
              <Download className="w-4 h-4 text-rafiki-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Install Rafiki Ops</p>
              <p className="text-[10px] text-slate-400 leading-tight">Works offline on your phone</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Install CTA */}
        <button
          onClick={handleInstall}
          className="w-full bg-rafiki-500 hover:bg-rafiki-600 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-lg shadow-rafiki-500/30 flex items-center justify-center space-x-2"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Add to Home Screen</span>
        </button>
      </div>
    </div>
  );
};
