import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Laptop,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-[#123D2B] text-white border border-[#75C943]/40 rounded-xl px-4 py-3 shadow-lg flex items-start gap-3"
    >
      <WifiOff className="w-4 h-4 text-[#75C943] shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">
        <div className="font-semibold">Offline Mode — Cached Workspace Active</div>
        <div className="text-emerald-100/85">
          App interface is available offline. Dataset uploads and Gemini interpretations resume once reconnected.
        </div>
      </div>
    </div>
  );
}

interface PWAInstallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PWAInstallModal({ open, onClose }: PWAInstallModalProps) {
  const {
    canNativePrompt,
    isStandalone,
    justInstalled,
    isIOS,
    isAndroid,
    isEmbedded,
    triggerNativeInstall,
  } = usePWAInstall();
  const [installing, setInstalling] = useState(false);

  if (!open) return null;

  const handleInstallNow = async () => {
    setInstalling(true);
    try {
      await triggerNativeInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-xl">
        <div className="bg-[#123D2B] text-white px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="eDNA Biodiversity Explorer App Icon"
              className="w-12 h-12 rounded-xl border border-white/20 shrink-0 object-cover bg-[#123D2B]"
            />
            <div className="min-w-0">
              <h2 id="pwa-install-title" className="text-base font-bold truncate">
                Download eDNA Biodiversity Explorer
              </h2>
              <p className="text-xs text-emerald-200/90">
                Installable Desktop &amp; Mobile App (PWA)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download app modal"
            className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-[#172B22]">
          {isStandalone || justInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-[#16834A] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">App Installed</div>
                <p className="mt-0.5">
                  eDNA Biodiversity Explorer is installed as a standalone application on your device with offline shell
                  caching enabled.
                </p>
              </div>
            </div>
          ) : canNativePrompt ? (
            <div className="p-4 rounded-xl bg-[#F5F8F5] border border-[#16834A]/25 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Your browser supports one-click installation. Install eDNA Biodiversity Explorer directly to your
                desktop or home screen for instant launch in its own app window.
              </p>
              <button
                type="button"
                disabled={installing}
                onClick={() => void handleInstallNow()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] transition-colors disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                {installing ? 'Preparing App Package...' : 'Install App Now'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {isEmbedded && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <strong>Preview Frame Detected:</strong> Browsers allow app installation when opened directly in a
                  full browser tab. Open this app URL directly in Chrome, Edge, or Safari to trigger native
                  installation.
                </div>
              )}

              {isIOS ? (
                <div className="p-4 rounded-xl bg-[#F5F8F5] border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#123D2B]">
                    <Smartphone className="w-4 h-4 text-[#16834A]" />
                    <span>Install on iPhone or iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Tap the{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-[#172B22]">
                        <Share className="w-3.5 h-3.5" /> Share
                      </span>{' '}
                      button in Safari&apos;s toolbar.
                    </li>
                    <li>
                      Scroll down and select <strong>Add to Home Screen</strong>.
                    </li>
                    <li>
                      Tap <strong>Add</strong> to launch eDNAExplore directly from your home screen.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="p-4 rounded-xl bg-[#F5F8F5] border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#123D2B]">
                    <Smartphone className="w-4 h-4 text-[#16834A]" />
                    <span>Install on Android (Chrome / Edge)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Open the browser menu (<strong>⋮</strong>) in the top-right corner.
                    </li>
                    <li>
                      Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </li>
                    <li>Confirm to install the standalone application icon.</li>
                  </ol>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#F5F8F5] border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#123D2B]">
                    <Laptop className="w-4 h-4 text-[#16834A]" />
                    <span>Install on Windows, macOS, or Linux (Chrome / Edge)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Click the <strong>Install app</strong> icon on the right side of your browser address bar.
                    </li>
                    <li>
                      Or open the browser menu (<strong>⋮</strong>) → <strong>Save and share</strong> →{' '}
                      <strong>Install eDNA Biodiversity Explorer</strong>.
                    </li>
                    <li>Launch anytime from your Desktop, Dock, or Start Menu without browser tabs.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="font-semibold text-[#123D2B]">Standalone Window</div>
              <div className="text-slate-500 mt-0.5">Runs natively without browser clutter.</div>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="font-semibold text-[#123D2B]">Offline App Shell</div>
              <div className="text-slate-500 mt-0.5">Cached UI &amp; instant startup via service worker.</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-[#F5F8F5] border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">Manifest: /manifest.webmanifest</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-[#172B22] font-semibold hover:border-[#123D2B]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface PWAInstallButtonProps {
  variant?: 'hero' | 'sidebar' | 'card' | 'footer';
  className?: string;
}

export function PWAInstallButton({ variant = 'hero', className = '' }: PWAInstallButtonProps) {
  const { canNativePrompt, isStandalone, triggerNativeInstall } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = async () => {
    if (canNativePrompt) {
      const outcome = await triggerNativeInstall();
      if (outcome !== 'accepted') {
        setModalOpen(true);
      }
      return;
    }
    setModalOpen(true);
  };

  if (isStandalone && variant !== 'card') {
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleClick()}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-100 hover:bg-white/10 transition-colors ${className}`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Download App</span>
        </button>
        <PWAInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (variant === 'footer') {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleClick()}
          className={`hover:text-white transition-colors inline-flex items-center gap-1.5 ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </button>
        <PWAInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (variant === 'card') {
    return (
      <>
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/pwa-192x192.png"
              alt="App Icon"
              className="w-11 h-11 rounded-xl border border-slate-200 object-cover shrink-0"
            />
            <div>
              <h3 className="text-sm font-bold text-[#123D2B]">Desktop &amp; Mobile App Installation</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isStandalone
                  ? 'Running in installed standalone application mode with offline shell caching.'
                  : 'Download eDNA Biodiversity Explorer as an installable app for Desktop, iOS, or Android.'}
              </p>
            </div>
          </div>
          {!isStandalone && (
            <button
              type="button"
              onClick={() => void handleClick()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16834A] text-white text-xs font-semibold hover:bg-[#123D2B] transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download App</span>
            </button>
          )}
        </div>
        <PWAInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-[#123D2B] hover:border-[#123D2B] hover:bg-emerald-50/40 transition-colors whitespace-nowrap shrink-0 ${className}`}
      >
        <Download className="w-4 h-4 text-[#16834A]" />
        <span>Download App</span>
      </button>
      <PWAInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
