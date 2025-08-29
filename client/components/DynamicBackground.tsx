import React from 'react';
import { useTheme } from '../App';
import Silk from './Silk';

export const DynamicBackground: React.FC = () => {
  const { theme } = useTheme();

  // Dark color for light theme, light color for dark theme to ensure visibility and aesthetics
  const silkColor = theme === 'dark' ? '#7B7481' : '#334155';
  const noise = theme === 'dark' ? 1.5 : 1.0;
  const scale = 1.2;

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <Silk
        speed={5}
        scale={1}
        color={silkColor}
        noiseIntensity={1.5}
        rotation={0.05}
      />
    </div>
  );
};