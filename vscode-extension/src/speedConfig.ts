/**
 * TypeByAman — Speed Configuration Helper
 * Author: Aman Kumar | github.com/Amankr0075
 */

export interface SpeedConfig {
  delay:        number;
  preset:       string;
  lineBreakDelay: number;
  startDelay:   number;
}

export const SPEED_PRESETS: Record<string, number> = {
  'Very Slow': 1000,
  'Slow':      250,
  'Normal':    50,
  'Fast':      20,
  'Very Fast': 5,
};

export function resolveDelay(preset: string, customDelay: number): number {
  if (preset === 'Custom') return Math.max(1, customDelay);
  return SPEED_PRESETS[preset] ?? customDelay;
}
