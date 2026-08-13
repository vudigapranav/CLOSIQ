import { UserProfile } from '../types/wardrobe';

export const INITIAL_PROFILE: UserProfile = {
  name: 'Pranav',
  styleArchetype: 'Elevated Architectural Minimalist',
  archetypeDescription: 'Your wardrobe leans on timeless tailoring, muted earthy neutrals, and rich tactile textures like Mongolian cashmere, Mulberry silk, and heavy wool twill.',
  dominantPalette: [
    { name: 'Camel & Sand', hex: '#C29B70', percentage: 28 },
    { name: 'Forest Emerald', hex: '#0D3B2E', percentage: 22 },
    { name: 'Ivory & Cream', hex: '#FAF5EE', percentage: 20 },
    { name: 'Charcoal & Espresso', hex: '#2C3238', percentage: 18 },
    { name: 'Raw Indigo', hex: '#1B263B', percentage: 12 }
  ],
  versatilityScore: 94,
  totalItemsCount: 14,
  formalityBias: 4,
  isDarkMode: false
};
