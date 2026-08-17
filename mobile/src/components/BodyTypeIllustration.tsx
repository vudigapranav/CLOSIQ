import React from 'react';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { BodyType } from '../types/onboarding';

/**
 * Deliberately simple, abstract, schematic silhouettes — not anatomical
 * illustrations. Differentiated primarily by torso width/taper, enough to
 * recognize at a glance without needing body-type vocabulary. "Prefer not
 * to say" intentionally has no silhouette at all (see BodyTypeOptionCard).
 */
const TORSO_POINTS: Record<Exclude<BodyType, 'prefer_not_to_say'>, string> = {
  slim: '15,18 25,18 24,50 16,50',
  athletic: '10,18 30,18 24,36 27,50 13,50 16,36',
  average: '13,18 27,18 27,50 13,50',
  broad: '8,18 32,18 30,50 10,50'
};

interface BodyTypeIllustrationProps {
  type: Exclude<BodyType, 'prefer_not_to_say'>;
  color: string;
  size?: number;
}

export const BodyTypeIllustration: React.FC<BodyTypeIllustrationProps> = ({ type, color, size = 40 }) => (
  <Svg width={size} height={size * 1.5} viewBox="0 0 40 60">
    <Circle cx={20} cy={9} r={7} fill={color} />
    <Polygon points={TORSO_POINTS[type]} fill={color} />
  </Svg>
);
