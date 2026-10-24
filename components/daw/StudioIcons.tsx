// components/daw/StudioIcons.tsx
import React from "react";

export function PlayIcon({ className = "w-4 h-4 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon({ className = "w-4 h-4 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

export function StopIcon({ className = "w-3.5 h-3.5 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}

export function RewindIcon({ className = "w-4 h-4 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  );
}

export function LoopIcon({ className = "w-4 h-4 stroke-current fill-none" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function MicIcon({ className = "w-5 h-5 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

export function PianoIcon({ className = "w-5 h-5 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 11h-1V5h1v9zm-3 0h-1V5h1v9z" />
    </svg>
  );
}

export function GuitarIcon({ className = "w-5 h-5 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 2.2a1 1 0 0 0-1.4 0l-2.1 2.1 2.4 2.4 2.1-2.1a1 1 0 0 0 0-1.4l-1-1ZM17.8 5.7l-2.4-2.4-2.1 2.1 1.2 1.2-2.1 2.1a5 5 0 0 0-5.7 1.1 5 5 0 0 0-1.1 5.7l-2.2 2.2a2.2 2.2 0 0 0 3.1 3.1l2.2-2.2a5 5 0 0 0 5.7-1.1 5 5 0 0 0 1.1-5.7l2.1-2.1 1.2 1.2 2.1-2.1-2.4-2.4-2.1 2.1-1.2-1.2 2.6-2.6ZM9.1 12.5a1 1 0 1 1 1.4 1.4 1 1 0 0 1-1.4-1.4Z" />
      <path d="m8.9 15.1 7.2-7.2m-5.7 8.7 7.2-7.2" fill="none" stroke="currentColor" strokeWidth=".65" strokeLinecap="round" />
    </svg>
  );
}

export function BassIcon({ className = "w-5 h-5 fill-current" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 2.7a1 1 0 0 0-1.4 0l-2 2 2.7 2.7 2-2a1 1 0 0 0 0-1.4L22 2.7ZM18 6.4l-2.7-2.7-2.2 2.2 1.4 1.4-2.2 2.2a5.4 5.4 0 0 0-5.9 1.2 5.1 5.1 0 0 0-1.2 5.9l-2.3 2.3a2.3 2.3 0 0 0 3.2 3.2l2.3-2.3a5.1 5.1 0 0 0 5.9-1.2 5.4 5.4 0 0 0 1.2-5.9l2.2-2.2 1.4 1.4 2.2-2.2L18.6 7l-2.2 2.2L15 7.8 18 4.8l2.7 2.7L18 10.2Z" />
      <path d="m7.1 15.1 9.5-9.5m-8 11 9.5-9.5m-8 11 9.5-9.5m-8 11 9.5-9.5" fill="none" stroke="currentColor" strokeWidth=".55" strokeLinecap="round" />
    </svg>
  );
}

export function DrumIcon({ className = "w-5 h-5 stroke-current fill-none" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="8" rx="8" ry="4" />
      <path d="M4 8v8c0 2.21 3.58 4 8 4s8-1.79 8-4V8" />
    </svg>
  );
}

export function BellIcon({ className = "w-4 h-4 stroke-current fill-none" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}
