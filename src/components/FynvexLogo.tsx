import React from 'react';
import Svg, {Defs, LinearGradient, Stop, Polygon, Circle} from 'react-native-svg';

interface Props {
  size?: number;
}

// Portado literalmente do <svg class="logo-mark"> em prototipo/index.html —
// mesmo hexágono navy + ponto verde central, mesmo gradiente.
export function FynvexLogo({size = 72}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="logoGrad" x1="0" y1="0" x2="100" y2="100">
          <Stop offset="0" stopColor="#124B9A" />
          <Stop offset="1" stopColor="#00A3E4" />
        </LinearGradient>
      </Defs>
      <Polygon
        points="50,4 93,27 93,73 50,96 7,73 7,27"
        fill="#101d38"
        stroke="url(#logoGrad)"
        strokeWidth={4}
      />
      <Circle cx="50" cy="50" r={14} fill="#1ec86e" />
    </Svg>
  );
}
