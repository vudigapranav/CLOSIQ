import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { CalendarDays, Plus, Clock, ChevronDown, ChevronUp, Shirt, AlertCircle, X, ArrowRight } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, WardrobeProfile, LayeringPreference, Outfit } from '../../../src/types/wardrobe';
import { loadUserWardrobe } from '../services/wardrobeStorage';
import { generateOutfitMobile, swapGarmentMobile, MobileOutfitResult } from '../services/outfitStylist';
import { recordRecentOutfit } from '../services/outfitHistoryStorage';
import { OutfitResultCard } from '../components/OutfitResultCard';
import { AddEventModal, EventFormData } from '../components/AddEventModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { PlannerEvent } from '../types/planner';
import { UserProfileData } from '../types/onboarding';
import { WeatherData } from '../types/weather';
import { fetchCurrentWeather } from '../services/weatherService';
import {
  buildUserStyleContext,
  buildWeatherContext,
  buildPlannerContext,
  buildRecentOutfitContext
} from '../services/personalizationContext';
import {
  loadPlannerEvents,
  addPlannerEvent,
  updatePlannerEvent,
  deletePlannerEvent,
  todayLocalDate,
  formatEventTimeLabel
} from '../services/plannerStorage';

interface PlannerScreenProps {
  profile: WardrobeProfile;
  layeringPreference?: LayeringPreference;
  userProfile?: UserProfileData | null;
  onUseForToday: (outfit: Outfit) => void;
  onNavigateToCollection?: () => void;
}

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  profile,
  layeringPreference = 'avoid',
  userProfile,
  onUseForToday,
  onNavigateToCollection
}) => {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [wardrobe, setWardrobe] = useState<GarmentItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PlannerEvent | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Outfit-planning sub-flow (triggered from EventDetailModal's "Plan an
  // Outfit"/"Change Outfit" action). Reuses generateOutfitMobile/
  // swapGarmentMobile exactly as Today/Stylist do — no second AI engine.
  const [planningEvent, setPlanningEvent] = useState<PlannerEvent | null>(null);
  const [outfitResult, setOutfitResult] = useState<{ mode: 'gemini' | 'fallback'; data: MobileOutfitResult } | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedGarmentForSwap, setSelectedGarmentForSwap] = useState<GarmentItem | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // See the identical note in TodayScreen.tsx: mirrors for runGenerate
  // (memoized, feeds OutfitResultCard) to read without being a useCallback
  // dependency, so weather resolving from null doesn't recreate the
  // callback and re-render the memoized card. savingRef is a pure
  // in-flight lock for handleSaveToEvent — never itself triggers a render.
  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);
  const savingRef = useRef(false);

  useEffect(() => {
    loadPlannerEvents().then(setEvents);
  }, []);

  // Reuses M14's shared weather service/cache — not a second weather
  // system. Only ever used as personalization context for an event dated
  // TODAY (see runGenerate below): the service only ever returns CURRENT
  // conditions, not a forecast, so attaching it to a future-dated event
  // would misrepresent tomorrow's weather as today's — omitted there
  // instead of sent misleadingly.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentWeather().then((res) => {
      if (!cancelled) setWeather(res.weather);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Events are device-level, not profile-scoped (see plannerStorage.ts) —
  // only the wardrobe used to plan an outfit needs to follow the active
  // Men/Women profile, same as every other screen's loadUserWardrobe call.
  useEffect(() => {
    loadUserWardrobe(profile).then(setWardrobe);
  }, [profile]);

  const today = todayLocalDate();

  const { todayEvents, upcomingEvents, pastEvents } = useMemo(() => {
    const sorted = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return {
      todayEvents: sorted.filter((e) => e.date === today),
      upcomingEvents: sorted.filter((e) => e.date > today),
      pastEvents: sorted.filter((e) => e.date < today).reverse()
    };
  }, [events, today]);

  const currentDateLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    []
  );

  const handleAddSubmit = async (data: EventFormData) => {
    const updated = await addPlannerEvent(data);
    setEvents(updated);
    setShowAddModal(false);
    if (updated[0]) setSelectedEvent(updated[0]);
  };

  const handleEditSubmit = async (data: EventFormData) => {
    if (!editingEvent) return;
    const updated = await updatePlannerEvent(editingEvent.id, data);
    setEvents(updated);
    setSelectedEvent(updated.find((e) => e.id === editingEvent.id) || null);
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (id: string) => {
    const updated = await deletePlannerEvent(id);
    setEvents(updated);
  };

  const handleEditFromDetail = (event: PlannerEvent) => {
    setSelectedEvent(null);
    setEditingEvent(event);
  };

  const handleStartPlanOutfit = (event: PlannerEvent) => {
    setSelectedEvent(null);
    setPlanningEvent(event);
    setOutfitResult(null);
    setPlanError(null);
  };

  const handleUseForToday = (event: PlannerEvent) => {
    if (!event.outfit) return;
    onUseForToday(event.outfit);
    setSelectedEvent(null);
  };

  const runGenerate = useCallback(
    async (excludeExtra: string[] = []) => {
      if (!planningEvent || wardrobe.length === 0 || planLoading || swapping) return;
      setPlanLoading(true);
      setPlanError(null);

      const prompt = `${planningEvent.occasion}: ${planningEvent.title}`;
      const recent = await buildRecentOutfitContext();
      const excludeIds = Array.from(new Set([...recent.excludeGarmentIds, ...excludeExtra]));

      // weatherService only ever returns CURRENT conditions (no forecast —
      // out of M14's scope), so only attach it when the event is actually
      // today; a future-dated event gets no weatherContext rather than a
      // misleading "today's weather" stand-in for a different day.
      const isEventToday = planningEvent.date === todayLocalDate();
      const currentUserProfile = userProfileRef.current;
      const personalization = {
        userProfileContext: buildUserStyleContext(profile, layeringPreference, currentUserProfile),
        weatherContext: isEventToday
          ? buildWeatherContext(weatherRef.current, currentUserProfile?.temperatureUnit || 'celsius')
          : undefined,
        plannerContext: buildPlannerContext(planningEvent),
        recentOutfitContext: recent.context
      };

      const res = await generateOutfitMobile(prompt, wardrobe, layeringPreference, excludeIds, personalization);

      setPlanLoading(false);
      if (res.ok && res.data && res.data.garmentIds.length > 0) {
        setOutfitResult({ mode: res.mode, data: res.data });
        await recordRecentOutfit(res.data.garmentIds);
      } else {
        setPlanError(res.error || 'CLOSIQ couldn’t build a look right now. Try again.');
      }
    },
    [planningEvent, wardrobe, layeringPreference, profile, planLoading, swapping]
  );

  const resolvedGarments: GarmentItem[] = useMemo(
    () =>
      outfitResult
        ? outfitResult.data.garmentIds
            .map((id) => wardrobe.find((item) => item.id === id))
            .filter((item): item is GarmentItem => Boolean(item))
        : [],
    [outfitResult, wardrobe]
  );

  const handleRegenerate = useCallback(() => {
    if (!outfitResult) return;
    runGenerate(outfitResult.data.garmentIds);
  }, [outfitResult, runGenerate]);

  const handleSaveToEvent = useCallback(async () => {
    if (!planningEvent || !outfitResult || resolvedGarments.length === 0 || savingRef.current) return;
    savingRef.current = true;

    try {
      const newOutfit: Outfit = {
        id: `outfit-planner-${Date.now()}`,
        title: outfitResult.data.title,
        occasion: planningEvent.occasion,
        vibe: outfitResult.data.vibe,
        formalityLabel: 'Smart Casual',
        temperature: 72,
        items: resolvedGarments,
        styleScore: outfitResult.data.styleScore,
        explanation: {
          summary: outfitResult.data.explanation.summary,
          colorHarmony: outfitResult.data.explanation.colorHarmony || 'Balanced tones',
          silhouette: 'Proportional fit',
          weatherSuitability: 'Suitable for the planned occasion',
          versatilityNote: 'High pairing versatility'
        },
        saved: true,
        dateCreated: new Date().toISOString()
      };

      const updatedEvents = await updatePlannerEvent(planningEvent.id, { outfit: newOutfit });
      setEvents(updatedEvents);
      await recordRecentOutfit(resolvedGarments.map((i) => i.id));

      const refreshed = updatedEvents.find((e) => e.id === planningEvent.id) || null;
      setPlanningEvent(null);
      setOutfitResult(null);
      setSelectedEvent(refreshed);
    } finally {
      savingRef.current = false;
    }
  }, [planningEvent, outfitResult, resolvedGarments]);

  const handleSwapGarment = async (garment: GarmentItem) => {
    if (!outfitResult || swapping || planLoading) return;
    setSelectedGarmentForSwap(null);
    setSwapping(true);

    const prompt = planningEvent ? `${planningEvent.occasion}: ${planningEvent.title}` : 'Planned Outfit';
    const res = await swapGarmentMobile(outfitResult.data.garmentIds, garment.id, garment.category, prompt, wardrobe);

    setSwapping(false);
    if (res.ok && res.data && res.data.replacementGarmentId) {
      const updatedIds = outfitResult.data.garmentIds.map((id) => (id === garment.id ? res.data.replacementGarmentId : id));
      setOutfitResult({
        mode: res.mode,
        data: {
          ...outfitResult.data,
          title: res.data.outfitTitle || outfitResult.data.title,
          garmentIds: updatedIds,
          explanation: { ...outfitResult.data.explanation, summary: res.data.whyItWorks }
        }
      });
    } else {
      Alert.alert('Swap Error', 'Unable to swap garment. Please try again.');
    }
  };

  const renderEventRow = (event: PlannerEvent) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventRow}
      activeOpacity={0.8}
      onPress={() => setSelectedEvent(event)}
    >
      <View style={styles.eventTimeCol}>
        <Clock size={12} color={COLORS.primary} />
        <Text style={styles.eventTimeText}>{formatEventTimeLabel(event.time)}</Text>
      </View>
      <View style={styles.eventDivider} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.eventSubtitle}>
          {event.occasion}{event.outfit ? ' • Outfit planned' : ''}
        </Text>
      </View>
      {event.outfit && <View style={styles.outfitDot} />}
    </TouchableOpacity>
  );

  const hasAnyEvents = events.length > 0;
  const hasUpcomingOrToday = todayEvents.length > 0 || upcomingEvents.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Planner</Text>
          <Text style={styles.screenSubtitle}>{currentDateLabel}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => setShowAddModal(true)}>
          <Plus size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {!hasAnyEvents ? (
        <View style={styles.emptyCard}>
          <CalendarDays size={32} color={COLORS.primary} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>Nothing planned yet.</Text>
          <Text style={styles.emptyBody}>Add an event and CLOSIQ can help you plan the look.</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddModal(true)}>
            <Plus size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddBtnText}>Add Event</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {!hasUpcomingOrToday && (
            <View style={styles.noUpcomingBox}>
              <Text style={styles.noUpcomingText}>No upcoming events.</Text>
            </View>
          )}

          {todayEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today</Text>
              <View style={styles.eventList}>{todayEvents.map(renderEventRow)}</View>
            </View>
          )}

          {upcomingEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              <View style={styles.eventList}>{upcomingEvents.map(renderEventRow)}</View>
            </View>
          )}

          {pastEvents.length > 0 && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.pastToggle} activeOpacity={0.7} onPress={() => setShowPast((v) => !v)}>
                <Text style={styles.pastToggleText}>Past Events ({pastEvents.length})</Text>
                {showPast ? <ChevronUp size={16} color={COLORS.textSecondary} /> : <ChevronDown size={16} color={COLORS.textSecondary} />}
              </TouchableOpacity>
              {showPast && <View style={styles.eventList}>{pastEvents.map(renderEventRow)}</View>}
            </View>
          )}
        </>
      )}

      {/* Add / Edit Event Form */}
      <AddEventModal
        visible={showAddModal || Boolean(editingEvent)}
        initialEvent={editingEvent}
        onClose={() => {
          setShowAddModal(false);
          setEditingEvent(null);
        }}
        onSubmit={editingEvent ? handleEditSubmit : handleAddSubmit}
      />

      {/* Event Detail Sheet */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteEvent}
        onPlanOutfit={handleStartPlanOutfit}
        onUseForToday={handleUseForToday}
      />

      {/* Plan-an-Outfit Full Screen Flow */}
      <Modal
        visible={Boolean(planningEvent)}
        animationType="slide"
        onRequestClose={() => setPlanningEvent(null)}
      >
        <ScrollView style={styles.planContainer} contentContainerStyle={styles.planScrollContent}>
          <View style={styles.planHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planHeaderTitle}>{planningEvent?.title}</Text>
              <Text style={styles.planHeaderSubtitle}>{planningEvent?.occasion}</Text>
            </View>
            <TouchableOpacity onPress={() => setPlanningEvent(null)} accessibilityLabel="Close">
              <X size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {wardrobe.length === 0 ? (
            <View style={styles.emptyCard}>
              <Shirt size={32} color={COLORS.primary} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Wardrobe Required</Text>
              <Text style={styles.emptyBody}>
                Add items to your wardrobe first so CLOSIQ can plan an outfit for this event.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => {
                  setPlanningEvent(null);
                  onNavigateToCollection?.();
                }}
              >
                <Text style={styles.emptyAddBtnText}>Add Items</Text>
                <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {!outfitResult && !planLoading && !swapping && !planError && (
                <View style={styles.generatePrompt}>
                  <Text style={styles.generatePromptText}>
                    CLOSIQ will style a look from your wardrobe for this event.
                  </Text>
                  <TouchableOpacity style={styles.generateBtn} activeOpacity={0.85} onPress={() => runGenerate()}>
                    <Text style={styles.generateBtnText}>Generate Outfit</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(planLoading || swapping) && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingTitle}>{swapping ? 'Finding a better match...' : 'Building your look...'}</Text>
                  <Text style={styles.loadingSubtitle}>Styling pieces from your cataloged wardrobe</Text>
                </View>
              )}

              {planError && !planLoading && !swapping && (
                <>
                  <View style={styles.errorBox}>
                    <AlertCircle size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
                    <Text style={styles.errorText}>{planError}</Text>
                  </View>
                  <TouchableOpacity style={styles.generateBtn} activeOpacity={0.85} onPress={() => runGenerate()}>
                    <Text style={styles.generateBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </>
              )}

              {outfitResult && !planLoading && !swapping && (
                <OutfitResultCard
                  mode={outfitResult.mode}
                  title={outfitResult.data.title}
                  vibe={outfitResult.data.vibe}
                  styleScore={outfitResult.data.styleScore}
                  garments={resolvedGarments}
                  explanation={outfitResult.data.explanation}
                  isSaved={false}
                  onSelectGarmentForSwap={setSelectedGarmentForSwap}
                  onRegenerate={handleRegenerate}
                  onSave={handleSaveToEvent}
                />
              )}
            </>
          )}
        </ScrollView>

        {/* Swap Piece Sheet */}
        <Modal
          visible={Boolean(selectedGarmentForSwap)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedGarmentForSwap(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              {selectedGarmentForSwap && (
                <>
                  <Text style={styles.modalCategory}>{selectedGarmentForSwap.category.toUpperCase()}</Text>
                  <Text style={styles.modalTitle}>{selectedGarmentForSwap.name}</Text>
                  <Text style={styles.modalSubtitle}>{selectedGarmentForSwap.color} • {selectedGarmentForSwap.fabric}</Text>
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSelectedGarmentForSwap(null)}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalSwapBtn} onPress={() => handleSwapGarment(selectedGarmentForSwap)}>
                      <Text style={styles.modalSwapText}>Swap This Piece</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  generatePrompt: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20
  },
  generatePromptText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 16
  },
  generateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center'
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.pill
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  noUpcomingBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 20
  },
  noUpcomingText: {
    fontSize: 13,
    color: COLORS.textSecondary
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10
  },
  eventList: {
    gap: 8
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  eventTimeCol: {
    alignItems: 'center',
    width: 52,
    gap: 3
  },
  eventTimeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary
  },
  eventDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
    marginHorizontal: 12
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  eventSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  outfitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginLeft: 8
  },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10
  },
  pastToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  planContainer: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  planScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  planHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  planHeaderSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  loadingSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 14,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    marginBottom: 20
  },
  errorText: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    flex: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 2
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  modalSwapBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  modalSwapText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
