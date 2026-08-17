import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Sparkles, Shirt, User, Wand2, CalendarDays } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';

export type NavTab = 'today' | 'collection' | 'planner' | 'stylist' | 'profile';

interface BottomNavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab
}) => {
  return (
    <View style={styles.dockContainer}>
      <View style={styles.dock}>
        {/* Today Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => onSelectTab('today')}
          accessibilityRole="button"
          accessibilityLabel="Today tab"
        >
          <View style={[styles.iconWrapper, activeTab === 'today' && styles.activeIconWrapper]}>
            <Sparkles
              size={20}
              color={activeTab === 'today' ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'today' && styles.activeTabLabel]}>
            Today
          </Text>
        </TouchableOpacity>

        {/* Wardrobe Collection Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => onSelectTab('collection')}
          accessibilityRole="button"
          accessibilityLabel="Wardrobe collection tab"
        >
          <View style={[styles.iconWrapper, activeTab === 'collection' && styles.activeIconWrapper]}>
            <Shirt
              size={20}
              color={activeTab === 'collection' ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'collection' && styles.activeTabLabel]}>
            Wardrobe
          </Text>
        </TouchableOpacity>

        {/* Planner Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => onSelectTab('planner')}
          accessibilityRole="button"
          accessibilityLabel="Planner tab"
        >
          <View style={[styles.iconWrapper, activeTab === 'planner' && styles.activeIconWrapper]}>
            <CalendarDays
              size={20}
              color={activeTab === 'planner' ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'planner' && styles.activeTabLabel]}>
            Planner
          </Text>
        </TouchableOpacity>

        {/* AI Stylist Hero Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => onSelectTab('stylist')}
          accessibilityRole="button"
          accessibilityLabel="AI Stylist tab"
        >
          <View
            style={[
              styles.iconWrapper,
              styles.heroIconWrapper,
              activeTab === 'stylist' && styles.activeHeroIconWrapper
            ]}
          >
            <Wand2
              size={20}
              color={COLORS.primary}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              styles.heroTabLabel,
              activeTab === 'stylist' && styles.activeTabLabel
            ]}
          >
            Stylist
          </Text>
        </TouchableOpacity>

        {/* Profile Tab */}
        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => onSelectTab('profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile tab"
        >
          <View style={[styles.iconWrapper, activeTab === 'profile' && styles.activeIconWrapper]}>
            <User
              size={20}
              color={activeTab === 'profile' ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.activeTabLabel]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 6,
    backgroundColor: COLORS.bg
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  heroIconWrapper: {
    backgroundColor: COLORS.primaryAlpha
  },
  activeHeroIconWrapper: {
    backgroundColor: COLORS.primaryAlphaDark
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
  heroTabLabel: {
    color: COLORS.primary,
    fontWeight: '600'
  }
});
