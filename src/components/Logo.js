import React from 'react';

const Logo = ({ size = 40 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="8" fill="#121212" />
      
      {/* Waveforms representing acoustic diffusion */}
      <path
        d="M8 20C8 20 10 14 14 14C18 14 18 26 22 26C26 26 28 20 28 20"
        stroke="#4285f4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 20C8 20 11 17 14 17C17 17 17 23 22 23C25 23 28 20 28 20"
        stroke="#20c997"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* RPG letters */}
      <text
        x="20"
        y="32"
        fontFamily="Arial"
        fontSize="7"
        fontWeight="bold"
        fill="white"
        textAnchor="middle"
      >
        RPG
      </text>
      
      {/* 3D cube representing diffusor */}
      <path
        d="M32 10L36 12V18L32 20V10Z"
        fill="#7b53c1"
        stroke="#7b53c1"
        strokeWidth="0.5"
      />
      <path
        d="M28 12L32 10V20L28 18V12Z"
        fill="#5e3fa3"
        stroke="#5e3fa3"
        strokeWidth="0.5"
      />
      <path
        d="M28 18L32 20L36 18L32 16L28 18Z"
        fill="#4e339d"
        stroke="#4e339d"
        strokeWidth="0.5"
      />
    </svg>
  );
};

export default Logo; 