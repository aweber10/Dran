import type { MemberColor } from './types';

export const MEMBER_COLORS: Record<MemberColor, string> = {
  teal: '#1e7a8c',
  brown: '#8a6242',
  green: '#4a7c3f',
  purple: '#7b4b94',
  rose: '#b83f65',
  ochre: '#806000',
  blue: '#3f6598',
  red: '#97463f'
};

export function memberColor(key: MemberColor | string): string {
  return MEMBER_COLORS[key as MemberColor] ?? '#69705f';
}
