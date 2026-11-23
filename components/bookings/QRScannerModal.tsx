'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { adminPost } from '@/lib/adminApiClient';
import { cn } from '@/utils/cn';
import type { EventBooking } from '@/types/bookings';
import AttendeeLegibilityCard from './AttendeeLegibilityCard';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Upload,
  Keyboard,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Volume2,
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckInSuccess?: (booking: EventBooking) => void;
}

type TabMode = 'camera' | 'upload' | 'manual';

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onCheckInSuccess,
}) => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabMode>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);

  // Manual code state
  const [manualCode, setManualCode] = useState('');

  // Scanned / Verified booking result
  const [verifiedBooking, setVerifiedBooking] = useState<EventBooking | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Refs for media stream & canvas decoding
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synthesize audio feedback
  const playBeep = useCallback((success = true) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  }, []);

  // Stop video stream cleanly
  const stopCamera = useCallback(() => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Verify pass by reference or ID
  const verifyPassCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      setIsVerifying(true);
      setLookupError(null);

      try {
        const res: any = await adminPost('/api/bookings/check-in', {
          reference: trimmed,
          bookingId: trimmed,
          verifyOnly: true,
        });

        if (res?.success && res?.data?.booking) {
          playBeep(true);
          setVerifiedBooking(res.data.booking);
        } else {
          playBeep(false);
          setLookupError(res?.error || 'Pass not found. Verify reservation reference code.');
        }
      } catch (err: any) {
        playBeep(false);
        setLookupError(err?.message || 'Error communicating with attendance registry.');
      } finally {
        setIsVerifying(false);
      }
    },
    [playBeep]
  );

  // Scanning loop
  const scanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          // Detected QR code!
          stopCamera();
          verifyPassCode(code.data);
          return;
        }
      }
    }

    animFrameId.current = requestAnimationFrame(scanLoop);
  }, [stopCamera, verifyPassCode]);

  // Start video stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported on this browser or context.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animFrameId.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Unable to activate camera stream: ' + (err.message || 'Unknown error'));
      }
    }
  }, [facingMode, scanLoop, stopCamera]);

  // Handle modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setVerifiedBooking(null);
      setLookupError(null);
      setManualCode('');
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera]);

  // Toggle front/back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Switch tabs
  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    if (tab === 'camera' && !verifiedBooking) {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Image file upload decoder
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          verifyPassCode(code.data);
        } else {
          playBeep(false);
          setLookupError('No valid Nirvaha QR code detected in this image. Try another image or enter reference manually.');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Perform atomic admission check-in
  const handleAdmit = async (booking: EventBooking) => {
    setIsAdmitting(true);
    try {
      const res: any = await adminPost('/api/bookings/check-in', {
        reference: booking.bookingReference,
        bookingId: booking.id,
        verifyOnly: false,
      });

      if (res?.success && res?.data?.booking) {
        playBeep(true);
        const updated = res.data.booking;
        setVerifiedBooking(updated);
        toast(res.message || `Admitted ${updated.userName}!`, 'success');
        onCheckInSuccess?.(updated);
      } else {
        playBeep(false);
        toast(res?.error || 'Admission check-in failed', 'error');
      }
    } catch (err: any) {
      playBeep(false);
      toast(err?.message || 'Check-in request failed', 'error');
    } finally {
      setIsAdmitting(false);
    }
  };

  // Reset to scan next pass
  const handleScanNext = () => {
    setVerifiedBooking(null);
    setLookupError(null);
    setManualCode('');
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Sanctuary Pass Scanner & Admission"
      className="max-w-2xl bg-[#0B100E] border-border/40 text-foreground"
    >
      <div className="space-y-4">
        {/* If a pass has been decoded and verified, show Legibility Card */}
        {verifiedBooking ? (
          <AttendeeLegibilityCard
            booking={verifiedBooking}
            onAdmit={handleAdmit}
            isAdmitting={isAdmitting}
            onScanNext={handleScanNext}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Mode Selector Tabs */}
            <div className="flex items-center gap-1 p-1 bg-secondary/20 rounded-xl border border-border/10">
              <button
                type="button"
                onClick={() => handleTabChange('camera')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
                  activeTab === 'camera'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Camera className="h-3.5 w-3.5" />
                Live Camera
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('upload')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
                  activeTab === 'upload'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Image Upload
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('manual')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
                  activeTab === 'manual'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Keyboard className="h-3.5 w-3.5" />
                Manual Code
              </button>
            </div>

            {/* Verification Loading Overlay */}
            {isVerifying && (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Verifying Guest Pass...</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Querying Nirvaha Sanctuary registry & capacity pool
                  </p>
                </div>
              </div>
            )}

            {/* Error Notification Banner */}
            {lookupError && !isVerifying && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold">Lookup Failed: </span>
                  {lookupError}
                </div>
                <button
                  type="button"
                  onClick={() => setLookupError(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* TAB 1: Live Camera Scanner */}
            {activeTab === 'camera' && !isVerifying && (
              <div className="space-y-3">
                <div className="relative aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden bg-black/80 border border-primary/30 flex items-center justify-center">
                  {cameraError ? (
                    <div className="p-6 text-center space-y-3 max-w-sm">
                      <CameraOff className="h-10 w-10 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">{cameraError}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={startCamera}
                        className="h-9 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry Camera
                      </Button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                        autoPlay
                      />

                      {/* Viewfinder Reticle Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-primary/40 rounded-2xl">
                          {/* Corner Reticles */}
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />

                          {/* Animated laser scan beam */}
                          <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse shadow-[0_0_8px_#6FBF8A]" />
                        </div>
                      </div>

                      {/* Camera Control Bar */}
                      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-black/60 text-primary border border-primary/20 backdrop-blur-sm">
                          Live Viewfinder Active
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleToggleFacingMode}
                          className="h-8 text-[11px] bg-black/60 hover:bg-black/80 backdrop-blur-sm border-border/20 text-foreground"
                        >
                          <SwitchCamera className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Center the attendee&apos;s digital or printed QR pass within the viewfinder frame.
                </p>
              </div>
            )}

            {/* TAB 2: Image / Screenshot Upload */}
            {activeTab === 'upload' && !isVerifying && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-border/40 hover:border-primary/50 rounded-2xl bg-secondary/10 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Upload Ticket Pass Image or Screenshot
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Drop a PNG, JPG, or screenshot of the visitor&apos;s reservation pass to scan and verify.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 h-9 text-xs border-primary/30"
                  >
                    Select Image File
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: Manual Code Entry */}
            {activeTab === 'manual' && !isVerifying && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-secondary/10 border border-border/20 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Booking Reference or Pass Identifier
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Type the unique human-readable reference printed on the attendee pass (e.g. NIR-EVT-XXXXXX).
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      verifyPassCode(manualCode);
                    }}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <Input
                      placeholder="e.g. NIR-EVT-7K2X9P"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      className="font-mono text-sm tracking-wider h-11 bg-black/40 border-primary/30 uppercase flex-1"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!manualCode.trim() || isVerifying}
                      className="h-11 px-5 text-xs font-semibold whitespace-nowrap"
                    >
                      <ShieldCheck className="h-4 w-4 mr-1.5" />
                      Verify Pass
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* Hidden Canvas for decoding video frames */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </Dialog>
  );
};

export default QRScannerModal;
