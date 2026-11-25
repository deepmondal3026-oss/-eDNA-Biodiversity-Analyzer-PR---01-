import React from 'react';

export function BrandLogoIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#123D2B" />
      {/* Botanical leaf silhouette */}
      <path
        d="M28.5 11.5C22.2 11.5 16.5 14.8 14.2 20.5C12.8 24 13.4 27.6 14.8 29.5C18.5 29.8 22.8 28.1 25.8 24.4C28.8 20.7 29.4 15.6 28.5 11.5Z"
        stroke="#75C943"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* DNA double-helix strands weaving through */}
      <path
        d="M11 12C15 15.5 23 15.5 27 19C23 22.5 15 22.5 11 26"
        stroke="#16A6A0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 26C15 22.5 23 22.5 27 26"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <line x1="15.5" y1="15.2" x2="22.5" y2="15.2" stroke="#FFFFFF" strokeWidth="1.25" strokeOpacity="0.65" />
      <line x1="15.5" y1="22.8" x2="22.5" y2="22.8" stroke="#FFFFFF" strokeWidth="1.25" strokeOpacity="0.65" />
    </svg>
  );
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#123D2B]/10 border border-[#123D2B]/15 text-[#123D2B] p-6 ${className}`}
      >
        <BrandLogoIcon className="w-10 h-10 mb-2 opacity-80" />
        <span className="text-xs font-medium text-center">{fallbackTitle || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
