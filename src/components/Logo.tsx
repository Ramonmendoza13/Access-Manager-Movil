import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

/**
 * Access Manager — Apex Portal Monogram
 * Native vector SVG component for the mobile application.
 * Freestanding architectural gateway arch forming the letter "A" with optical scan beam.
 */
export default function Logo({ size = 32 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Defs>
        <LinearGradient id="am-m-left" x1={3} y1={28} x2={16} y2={2.5} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#0284C7" />
          <Stop offset="100%" stopColor="#38BDF8" />
        </LinearGradient>
        <LinearGradient id="am-m-right" x1={29} y1={28} x2={16} y2={2.5} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#0369A1" />
          <Stop offset="100%" stopColor="#7DD3FC" />
        </LinearGradient>
        <LinearGradient id="am-m-beam" x1={6} y1={18.5} x2={26} y2={18.5} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#38BDF8" />
          <Stop offset="50%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#38BDF8" />
        </LinearGradient>
      </Defs>
      {/* Left Architectural Pillar */}
      <Path d="M16 2.5L3 28H10.5L16 16.5V2.5Z" fill="url(#am-m-left)" />
      {/* Right Architectural Pillar */}
      <Path d="M16 2.5L29 28H21.5L16 16.5V2.5Z" fill="url(#am-m-right)" />
      {/* High-Precision Optical Access Beam */}
      <Path d="M7 21L9.8 15.5H22.2L25 21H7Z" fill="url(#am-m-beam)" />
    </Svg>
  );
}
