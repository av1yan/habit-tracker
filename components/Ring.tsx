// Circular progress ring (SVG), with centered label content.

import React from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '@/lib/theme'

export function Ring({
  size = 88,
  stroke = 7,
  pct,
  color = colors.accent,
  track = colors.track,
  children,
}: {
  size?: number
  stroke?: number
  pct: number
  color?: string
  track?: string
  children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (c * Math.max(0, Math.min(100, pct))) / 100
  const center = size / 2

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </View>
  )
}
