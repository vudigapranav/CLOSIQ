import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { BodyType } from '../types/onboarding';
import { BodyTypeIllustration } from './BodyTypeIllustration';

interface BodyTypeOptionCardProps {
  value: BodyType;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}

/** Shared between onboarding and Profile's Edit Profile modal so the two
 *  never drift into two different visual languages for the same choice. */
export const BodyTypeOptionCard: React.FC<BodyTypeOptionCardProps> = ({
  value,
  label,
  description,
  selected,
  onPress
}) => {
  const tint = selected ? COLORS.primary : COLORS.textSecondary;
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.illustrationBox}>
        {value === 'prefer_not_to_say' ? (
          <User size={26} color={tint} />
        ) : (
          <BodyTypeIllustration type={value} color={tint} size={36} />
        )}
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha
  },
  illustrationBox: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2
  },
  labelSelected: {
    color: COLORS.primary
  },
  description: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center'
  }
});
