import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock, X } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { PlannerEvent, PLANNER_OCCASIONS } from '../types/planner';
import { formatLocalDate, formatLocalTime, formatEventDateLabel, formatEventTimeLabel, parseLocalDateTime } from '../services/plannerStorage';

export interface EventFormData {
  title: string;
  date: string;
  time: string;
  occasion: string;
  notes?: string;
}

interface AddEventModalProps {
  visible: boolean;
  /** Non-null puts the form in edit mode, pre-filled from this event. */
  initialEvent?: PlannerEvent | null;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
}

function defaultTimeObj(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  visible,
  initialEvent,
  onClose,
  onSubmit
}) => {
  const [title, setTitle] = useState('');
  const [dateObj, setDateObj] = useState<Date>(new Date());
  const [timeObj, setTimeObj] = useState<Date>(defaultTimeObj());
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>('College');
  const [customOccasion, setCustomOccasion] = useState('');
  const [showCustomOccasion, setShowCustomOccasion] = useState(false);
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Re-sync the form every time the modal opens, from either the event being
  // edited or a fresh-add default — mirrors EditProfileModal's pattern so
  // this never shows a previous session's stale draft.
  useEffect(() => {
    if (!visible) return;
    if (initialEvent) {
      setTitle(initialEvent.title);
      setDateObj(parseLocalDateTime(initialEvent.date, initialEvent.time));
      setTimeObj(parseLocalDateTime(initialEvent.date, initialEvent.time));
      const isPreset = PLANNER_OCCASIONS.includes(initialEvent.occasion);
      setSelectedOccasion(isPreset ? initialEvent.occasion : 'custom');
      setShowCustomOccasion(!isPreset);
      setCustomOccasion(isPreset ? '' : initialEvent.occasion);
      setNotes(initialEvent.notes || '');
    } else {
      setTitle('');
      setDateObj(new Date());
      setTimeObj(defaultTimeObj());
      setSelectedOccasion('College');
      setShowCustomOccasion(false);
      setCustomOccasion('');
      setNotes('');
    }
  }, [visible, initialEvent]);

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'set' && selected) setDateObj(selected);
    if (event.type === 'dismissed') setShowDatePicker(false);
  };

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowTimePicker(false);
    if (event.type === 'set' && selected) setTimeObj(selected);
    if (event.type === 'dismissed') setShowTimePicker(false);
  };

  const handleSelectOccasion = (occasion: string) => {
    setSelectedOccasion(occasion);
    setShowCustomOccasion(false);
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    const finalOccasion = showCustomOccasion ? customOccasion.trim() : (selectedOccasion || '');

    if (!trimmedTitle) {
      Alert.alert('Event Name Required', 'Give this event a name before saving.');
      return;
    }
    if (!finalOccasion) {
      Alert.alert('Occasion Required', 'Choose an occasion or enter a custom one.');
      return;
    }

    onSubmit({
      title: trimmedTitle,
      date: formatLocalDate(dateObj),
      time: formatLocalTime(timeObj),
      occasion: finalOccasion,
      notes: notes.trim() || undefined
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{initialEvent ? 'Edit Event' : 'Add Event'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <Text style={styles.label}>Event</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. College Presentation"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setShowTimePicker(false);
                  setShowDatePicker(true);
                }}
              >
                <CalendarDays size={15} color={COLORS.primary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.dateTimeLabel}>Date</Text>
                  <Text style={styles.dateTimeValue}>{formatEventDateLabel(formatLocalDate(dateObj))}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(true);
                }}
              >
                <Clock size={15} color={COLORS.primary} />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.dateTimeLabel}>Time</Text>
                  <Text style={styles.dateTimeValue}>{formatEventTimeLabel(formatLocalTime(timeObj))}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {showTimePicker && (
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={timeObj}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.label}>Occasion</Text>
            <View style={styles.chipWrap}>
              {PLANNER_OCCASIONS.map((occasion) => {
                const isSelected = !showCustomOccasion && selectedOccasion === occasion;
                return (
                  <TouchableOpacity
                    key={occasion}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => handleSelectOccasion(occasion)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{occasion}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.chip, showCustomOccasion && styles.chipSelected]}
                onPress={() => {
                  setShowCustomOccasion(true);
                  setSelectedOccasion('custom');
                }}
              >
                <Text style={[styles.chipText, showCustomOccasion && styles.chipTextSelected]}>Custom</Text>
              </TouchableOpacity>
            </View>

            {showCustomOccasion && (
              <TextInput
                style={styles.input}
                value={customOccasion}
                onChangeText={setCustomOccasion}
                placeholder="Enter a custom occasion"
                placeholderTextColor={COLORS.textMuted}
              />
            )}

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Important presentation, dress smart..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSubmit}>
            <Text style={styles.saveBtnText}>{initialEvent ? 'Save Changes' : 'Add Event'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  notesInput: {
    minHeight: 72
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  dateTimeLabel: {
    fontSize: 10.5,
    color: COLORS.textMuted
  },
  dateTimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 1
  },
  pickerCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 10,
    alignItems: 'center',
    overflow: 'hidden'
  },
  pickerDoneBtn: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  pickerDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  chipTextSelected: {
    color: '#FFFFFF'
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
