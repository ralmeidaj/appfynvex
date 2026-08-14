import React from 'react';
import Svg, {Rect} from 'react-native-svg';

// Porta de prototipo/js/qrcode-mock.js — SVG decorativo e determinístico
// (mesma entrada -> mesma saída), NÃO é um QR code/código de barras real ou
// escaneável. RF-PAG-03: o app não gera os códigos em si (pix_payload/
// linha_digitável vêm do backend); isto só desenha a representação visual
// a partir do valor recebido.
function qrHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeLcg(seed: number) {
  let state = seed || 1;
  return function rand(): number {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export function MockQrCode({value, size = 180}: {value: string; size?: number}) {
  const GRID = 25;
  const cell = size / GRID;
  const rand = makeLcg(qrHash(value || 'fynvex'));

  const isEye = (r: number, c: number) => {
    const inTL = r < 7 && c < 7;
    const inTR = r < 7 && c >= GRID - 7;
    const inBL = r >= GRID - 7 && c < 7;
    return inTL || inTR || inBL;
  };
  const eyePattern = (r: number, c: number, baseR: number, baseC: number) => {
    const rr = r - baseR;
    const cc = c - baseC;
    if (rr < 0 || rr > 6 || cc < 0 || cc > 6) {
      return false;
    }
    const border = rr === 0 || rr === 6 || cc === 0 || cc === 6;
    const inner = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
    return border || inner;
  };

  const rects: React.ReactNode[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      let on: boolean;
      if (isEye(r, c)) {
        if (r < 7 && c < 7) {
          on = eyePattern(r, c, 0, 0);
        } else if (r < 7 && c >= GRID - 7) {
          on = eyePattern(r, c, 0, GRID - 7);
        } else {
          on = eyePattern(r, c, GRID - 7, 0);
        }
      } else {
        on = rand() > 0.55;
      }
      if (on) {
        rects.push(<Rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#111827" />);
      }
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#ffffff" />
      {rects}
    </Svg>
  );
}

export function MockBarcode({value, width = 280, height = 90}: {value: string; width?: number; height?: number}) {
  const rand = makeLcg(qrHash(value || 'fynvex'));
  const barsCount = 55;
  const availableWidth = width - 8;
  const slot = availableWidth / barsCount;

  const bars: React.ReactNode[] = [];
  let x = 4;
  for (let i = 0; i < barsCount; i++) {
    const barWidth = 1 + Math.floor(rand() * 2.4);
    if (rand() > 0.32) {
      bars.push(<Rect key={i} x={x} y={6} width={barWidth} height={height - 16} fill="#111827" />);
    }
    x += slot;
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
      {bars}
    </Svg>
  );
}
