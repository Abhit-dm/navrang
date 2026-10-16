import React from 'react';

export default function TyreIcon({ className, title = 'Motorcycle tyre', showMonogram = false }) {
  const treadAngles = Array.from({ length: 36 }, (_, index) => index * 10);
  const spokeAngles = Array.from({ length: 10 }, (_, index) => index * 36);
  return (
    <svg className={className} viewBox="0 0 240 240" role="img" aria-label={title}>
      <circle cx="120" cy="120" r="114" fill="#090b0e" stroke="#4a5056" strokeWidth="2" />
      <circle cx="120" cy="120" r="108" fill="none" stroke="#272c31" strokeWidth="3" />
      {treadAngles.map((angle) => (
        <path key={angle} d="M114 7 L120 5 L126 22 L120 25 Z" fill="#343a40" transform={`rotate(${angle} 120 120)`} />
      ))}
      <circle cx="120" cy="120" r="100" fill="none" stroke="#050607" strokeWidth="4" />
      <circle cx="120" cy="120" r="91" fill="#171b1f" stroke="#555c63" strokeWidth="2" />
      <circle cx="120" cy="120" r="79" fill="#282e34" stroke="#899097" strokeWidth="3" />
      {spokeAngles.map((angle) => (
        <path key={angle} d="M116 53 L120 48 L124 53 L132 91 L126 98 L114 98 L108 91 Z" fill="#b6bdc3" stroke="#4b5259" strokeWidth="2" transform={`rotate(${angle} 120 120)`} />
      ))}
      <circle cx="120" cy="120" r="43" fill="#181c20" stroke="#70777e" strokeWidth="3" />
      <circle cx="120" cy="120" r="34" fill="#292f35" stroke="#080a0c" strokeWidth="3" />
      {spokeAngles.slice(0, 5).map((angle) => (
        <circle key={angle} cx="120" cy="91" r="3" fill="#090b0e" transform={`rotate(${angle * 2} 120 120)`} />
      ))}
      <circle cx="120" cy="120" r="24" fill="#080a0c" stroke="#4a5056" strokeWidth="2" />
      {showMonogram ? (
        <g textAnchor="middle" dominantBaseline="central" fontFamily="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" fontSize="27" fontWeight="900" fontStyle="italic">
          <text x="108" y="120" fill="#dc2626">N</text>
          <text x="132" y="120" fill="#ffffff">T</text>
        </g>
      ) : (
        <circle cx="120" cy="120" r="10" fill="#b6bdc3" stroke="#4b5259" strokeWidth="2" />
      )}
    </svg>
  );
}
