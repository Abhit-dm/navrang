import React from 'react';

// Original vector illustration, used instead of stock photos so there are no image-rights concerns.
export default function TyreIcon({ className, title = 'Tyre' }) {
  const bolts = [0, 72, 144, 216, 288];
  return (
    <svg className={className} viewBox="0 0 200 200" role="img" aria-label={title}>
      <circle cx="100" cy="100" r="96" fill="#0b0f19" stroke="#374151" strokeWidth="2" />
      {Array.from({ length: 24 }).map((_, i) => (
        <rect key={i} x="96" y="6" width="8" height="14" rx="2" fill="#1f2937" transform={`rotate(${i * 15} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="72" fill="#111827" stroke="#4b5563" strokeWidth="2" />
      <circle cx="100" cy="100" r="54" fill="#d1d5db" />
      <circle cx="100" cy="100" r="46" fill="#9ca3af" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M100 100 L92 58 Q100 52 108 58 Z" fill="#e5e7eb" transform={`rotate(${a} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="16" fill="#dc2626" />
      {bolts.map((a) => (
        <circle key={a} cx="100" cy="82" r="3" fill="#111827" transform={`rotate(${a} 100 100)`} />
      ))}
    </svg>
  );
}
