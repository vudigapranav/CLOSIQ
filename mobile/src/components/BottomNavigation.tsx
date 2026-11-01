import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Sparkles, Shirt, User, CalendarDays, Camera } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';

/**
 * 'stylist' is still a screen (opened from the AI Stylist card on Today) but
 * no longer a tab — the user moved it into Today on 2026-11-01.
 */
export type NavTab = 'today' | 'collection' | 'planner' | 'stylist' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  /** The raised centre camera button — opens Shop Check. */
  onPressShopCheck: () => void;
}

type IconType = typeof Sparkles;

const TabButton: React.FC<{
  label: string;
  Icon: IconType;
  active: boolean;
  onPress: () => void;
}> = ({ label, Icon, active, onPress }) => (
  <TouchableOpacity
    style={styles.tabButton}
    activeOpacity={0.7}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${label} tab`}
    accessibilityState={{ selected: active }}
  >
    <View style={[styles.iconWrapper, active && styles.activeIconWrapper]}>
      <Icon size={20} color={active ? COLORS.primary : COLORS.textSecondary} />
    </View>
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
  </TouchableOpacity>
);

/** Today · Wardrobe · (camera) · Planner · Profile. */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onSelectTab, onPressShopCheck }) => {
  // The Stylist screen is reached from Today, so Today stays lit while it's open.
  const todayActive = activeTab === 'today' || activeTab === 'stylist';
  return (
    <View style={styles.dockContainer}>
      <View style={styles.dock}>
        <TabButton label="Today" Icon={Sparkles} active={todayActive} onPress={() => onSelectTab('today')} />
        <TabButton label="Wardrobe" Icon={Shirt} active={activeTab === 'collection'} onPress={() => onSelectTab('collection')} />

        {/* Raised centre button: scan a piece in a shop and see if it works with your wardrobe. */}
        <View style={styles.centerSlot}>
          <TouchableOpacity
            style={styles.cameraButton}
            activeOpacity={0.85}
            onPress={onPressShopCheck}
            accessibilityRole="button"
            accessibilityLabel="Shop Check — scan a garment to see if it works with your wardrobe"
          >
            <Camera size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.cameraLabel}>Shop Check</Text>
        </View>

        <TabButton label="Planner" Icon={CalendarDays} active={activeTab === 'planner'} onPress={() => onSelectTab('planner')} />
        <TabButton label="Profile" Icon={User} active={activeTab === 'profile'} onPress={() => onSelectTab('profile')} />
      </View>
    </View>
  );
};

const CAMERA_SIZE = 58;

const styles = StyleSheet.create({
  dockContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    // Room for the raised camera button above the dock.
    paddingTop: 22,
    backgroundColor: COLORS.bg
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 44
  },
  iconWrapper: {
    padding: 6,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeIconWrapper: {
    backgroundColor: COLORS.primaryAlpha
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2
  },
  activeTabLabel: {
    color: COLORS.primary,
    fontWeight: '700'
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4
  },
  cameraButton: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifted above the dock, with an ivory ring so it reads as its own button.
    marginTop: -(CAMERA_SIZE / 2 + 6),
    borderWidth: 4,
    borderColor: COLORS.bg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8
  },
  cameraLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 3
  }
});
