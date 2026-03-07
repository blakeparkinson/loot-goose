import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/Colors';
import { HuntDifficulty, QuickPreset } from '@/lib/types';
import { generateHunt } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { fetchWeather, WeatherInfo } from '@/lib/weather';

const DIFFICULTIES: { key: HuntDifficulty; label: string; emoji: string; color: string }[] = [
  { key: 'easy', label: 'Chill', emoji: '🌿', color: Colors.green },
  { key: 'medium', label: 'Honky', emoji: '🪿', color: Colors.gold },
  { key: 'hard', label: 'Feral', emoji: '🔥', color: Colors.red },
];

const PROMPT_SUGGESTIONS = [
  'Dog-friendly things',
  'Things that are surprisingly old',
  'Street art and murals',
  'Hidden gems only locals know',
  'Things starting with the letter B',
  'Weird or funny signs',
  'Nature you can touch',
];

const LOADING_MESSAGES = [
  'Honking at the AI...',
  'Ruffling feathers...',
  'Waddling through ideas...',
  'Stealing bread for inspiration...',
  'Almost there...',
];

const MIN_STOPS = 3;
const MAX_STOPS = 25;

const QUICK_PRESETS: QuickPreset[] = [
  {
    title: '20-Minute Wander',
    subtitle: 'Tight route, easy pace, good for a quick break.',
    prompt: 'Find small neighborhood details worth noticing on a short walk',
    difficulty: 'easy',
    stopCount: 4,
    suggestions: ['Hidden gems only locals know', 'Nature you can touch'],
  },
  {
    title: 'Date Night',
    subtitle: 'Cute stops, conversation starters, low chaos.',
    prompt: 'Find charming, flirty, memorable places for a fun date-night stroll',
    difficulty: 'medium',
    stopCount: 5,
    suggestions: ['Street art and murals', 'Things that are surprisingly old'],
  },
  {
    title: 'Neighborhood Chaos',
    subtitle: 'Weird signs, odd details, and good goose energy.',
    prompt: 'Find weird signs, funny details, and evidence that humans are deeply strange',
    difficulty: 'medium',
    stopCount: 6,
    suggestions: ['Weird or funny signs', 'Things starting with the letter B'],
  },
  {
    title: 'Coffee Crawl',
    subtitle: 'Good for solo walks or caffeinated side quests.',
    prompt: 'Build a walk that mixes coffee spots, cozy corners, and local character',
    difficulty: 'easy',
    stopCount: 5,
    suggestions: ['Dog-friendly things', 'Hidden gems only locals know'],
  },
];

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    presetTitle?: string;
    presetPrompt?: string;
    presetDifficulty?: HuntDifficulty;
    presetStopCount?: string;
    presetSuggestions?: string;
    presetLocation?: string;
    presetSubtitle?: string;
    challengeBadge?: string;
  }>();
  const saveHunt = useAppStore((s) => s.saveHunt);

  const [location, setLocation] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<HuntDifficulty>('medium');
  const [stopCount, setStopCount] = useState(6);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [activePresetTitle, setActivePresetTitle] = useState<string | null>(null);

  const routePreset = useMemo<QuickPreset | null>(() => {
    if (!params.presetPrompt) return null;
    return {
      title: params.presetTitle ?? 'Quick Start',
      subtitle: params.presetSubtitle,
      prompt: params.presetPrompt,
      difficulty: params.presetDifficulty ?? 'medium',
      stopCount: Number(params.presetStopCount ?? 6),
      suggestions: params.presetSuggestions ? params.presetSuggestions.split('|').filter(Boolean) : [],
      location: params.presetLocation,
    };
  }, [
    params.presetDifficulty,
    params.presetLocation,
    params.presetPrompt,
    params.presetStopCount,
    params.presetSubtitle,
    params.presetSuggestions,
    params.presetTitle,
  ]);

  useEffect(() => {
    if (!routePreset) return;
    setPrompt(routePreset.prompt);
    setDifficulty(routePreset.difficulty);
    setStopCount(Math.min(MAX_STOPS, Math.max(MIN_STOPS, routePreset.stopCount)));
    setSelectedSuggestions(routePreset.suggestions ?? []);
    setActivePresetTitle(routePreset.title);
    if (routePreset.location) {
      setLocation((current) => current.trim() || routePreset.location || '');
    }
  }, [routePreset]);

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location optional', 'You can still type a neighborhood or city manually.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const [geo, info] = await Promise.all([
        Location.reverseGeocodeAsync({ latitude, longitude }).then((rows) => rows[0]),
        fetchWeather({ latitude, longitude }),
      ]);

      if (geo) {
        const parts = [geo.district || geo.street, geo.city, geo.region].filter(Boolean);
        setLocation(parts.join(', '));
      }
      setWeather(info);
    } finally {
      setIsLocating(false);
    }
  };

  const canGenerate = location.trim().length > 2 && prompt.trim().length > 2;

  const adjustStops = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStopCount((prev) => Math.min(MAX_STOPS, Math.max(MIN_STOPS, prev + delta)));
  };

  const applyPreset = (preset: QuickPreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrompt(preset.prompt);
    setDifficulty(preset.difficulty);
    setStopCount(Math.min(MAX_STOPS, Math.max(MIN_STOPS, preset.stopCount)));
    setSelectedSuggestions(preset.suggestions ?? []);
    setActivePresetTitle(preset.title);
    if (preset.location) {
      setLocation((current) => current.trim() || preset.location || '');
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);
    setLoadingMsg(LOADING_MESSAGES[0]);

    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 3000);

    try {
      const fullPrompt = [prompt.trim(), ...selectedSuggestions].filter(Boolean).join(', ');
      const hunt = await generateHunt({
        location: location.trim(),
        prompt: fullPrompt,
        difficulty,
        count: stopCount,
        weather: weather?.context,
      });
      await saveHunt(hunt);
      router.replace(`/hunt/${hunt.id}`);
    } catch (e: any) {
      Alert.alert('Generation Failed', e.message || 'Could not generate the hunt. Try again.', [
        { text: 'OK' },
      ]);
    } finally {
      clearInterval(msgInterval);
      setIsGenerating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Weather chip */}
        {weather && (
          <View style={styles.weatherChip}>
            <Text style={styles.weatherEmoji}>{weather.emoji}</Text>
            <Text style={styles.weatherLabel}>{weather.label}</Text>
            <Text style={styles.weatherNote}>· hunt will adapt</Text>
          </View>
        )}

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Where are you?</Text>
          <View style={styles.locationInputRow}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              placeholder={isLocating ? 'Detecting location...' : 'e.g. Central Park, NYC'}
              placeholderTextColor={Colors.textMuted}
              value={location}
              onChangeText={setLocation}
              returnKeyType="next"
              editable={!isGenerating}
            />
            {isLocating && <ActivityIndicator style={styles.locationSpinner} size="small" color={Colors.textMuted} />}
          </View>
          <TouchableOpacity
            style={[styles.locateBtn, isLocating && { opacity: 0.7 }]}
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
            activeOpacity={0.8}
          >
            <FontAwesome name="location-arrow" size={13} color={Colors.blue} />
            <Text style={styles.locateBtnText}>{isLocating ? 'Finding you...' : 'Use current location'}</Text>
          </TouchableOpacity>
          <Text style={styles.locationNote}>Manual entry works too. GPS just helps with weather and nearby routing.</Text>
        </View>

        {/* Prompt */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Quick Presets</Text>
            {params.challengeBadge && (
              <View style={styles.challengeBadge}>
                <Text style={styles.challengeBadgeText}>{params.challengeBadge}</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {(routePreset ? [routePreset, ...QUICK_PRESETS.filter((preset) => preset.title !== routePreset.title)] : QUICK_PRESETS).map((preset) => {
              const isActive = activePresetTitle === preset.title;
              return (
                <TouchableOpacity
                  key={preset.title}
                  style={[styles.presetCard, isActive && styles.presetCardActive]}
                  onPress={() => applyPreset(preset)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetTitle, isActive && styles.presetTitleActive]}>{preset.title}</Text>
                  <Text style={styles.presetSubtitle} numberOfLines={2}>{preset.subtitle}</Text>
                  <View style={styles.presetMetaRow}>
                    <Text style={styles.presetMeta}>{preset.stopCount} stops</Text>
                    <Text style={styles.presetMeta}>·</Text>
                    <Text style={styles.presetMeta}>{preset.difficulty}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>What's the theme?</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="e.g. Find things a dog would love"
            placeholderTextColor={Colors.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
            {PROMPT_SUGGESTIONS.map((s) => {
              const active = selectedSuggestions.includes(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestion, active && styles.suggestionActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedSuggestions((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    );
                  }}
                >
                  <Text style={[styles.suggestionText, active && styles.suggestionTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Number of stops */}
        <View style={styles.section}>
          <Text style={styles.label}>Number of stops</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperBtn, stopCount <= MIN_STOPS && styles.stepperBtnDisabled]}
              onPress={() => adjustStops(-1)}
              disabled={stopCount <= MIN_STOPS}
            >
              <FontAwesome name="minus" size={16} color={stopCount <= MIN_STOPS ? Colors.textMuted : Colors.text} />
            </TouchableOpacity>
            <View style={styles.stepperValue}>
              <Text style={styles.stepperNumber}>{stopCount}</Text>
              <Text style={styles.stepperUnit}>stops</Text>
            </View>
            <TouchableOpacity
              style={[styles.stepperBtn, stopCount >= MAX_STOPS && styles.stepperBtnDisabled]}
              onPress={() => adjustStops(1)}
              disabled={stopCount >= MAX_STOPS}
            >
              <FontAwesome name="plus" size={16} color={stopCount >= MAX_STOPS ? Colors.textMuted : Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Difficulty */}
        <View style={styles.section}>
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.diffRow}>
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d.key;
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.diffCard, selected && { borderColor: d.color, backgroundColor: `${d.color}15` }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDifficulty(d.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.diffEmoji}>{d.emoji}</Text>
                  <Text style={[styles.diffLabel, selected && { color: d.color }]}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Generate */}
        <TouchableOpacity
          style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate || isGenerating}
          activeOpacity={0.85}
        >
          {isGenerating ? (
            <>
              <ActivityIndicator color="#000" size="small" />
              <Text style={styles.generateBtnText}>{loadingMsg}</Text>
            </>
          ) : (
            <>
              <Image source={require('@/assets/icon.png')} style={styles.generateBtnIcon} />
              <Text style={styles.generateBtnText}>Generate Hunt</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },

  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  weatherEmoji: { fontSize: 16 },
  weatherLabel: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  weatherNote: { fontSize: 12, color: Colors.textMuted },

  section: { marginBottom: 28 },
  label: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },

  locationInputRow: { position: 'relative' },
  locationInput: { paddingRight: 44 },
  locationSpinner: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  locateBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.blueLight,
    borderWidth: 1,
    borderColor: `${Colors.blue}35`,
  },
  locateBtnText: { fontSize: 13, fontWeight: '700', color: Colors.blue },
  locationNote: { marginTop: 8, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  input: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 16, fontSize: 16, color: Colors.text,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  presetRow: { gap: 10, paddingRight: 4 },
  presetCard: {
    width: 180,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetCardActive: {
    borderColor: Colors.gold,
    backgroundColor: `${Colors.gold}10`,
  },
  presetTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  presetTitleActive: { color: Colors.gold },
  presetSubtitle: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  presetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presetMeta: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'capitalize' },
  challengeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.purpleLight,
    borderWidth: 1,
    borderColor: `${Colors.purple}35`,
  },
  challengeBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.purple, textTransform: 'uppercase' },
  suggestions: { gap: 8, paddingTop: 10, paddingRight: 4 },
  suggestion: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border,
  },
  suggestionActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  suggestionText: { fontSize: 13, color: Colors.textSecondary },
  suggestionTextActive: { color: Colors.gold, fontWeight: '700' },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 12, alignSelf: 'flex-start',
  },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperValue: { alignItems: 'center', minWidth: 60 },
  stepperNumber: { fontSize: 32, fontWeight: '900', color: Colors.gold, lineHeight: 36 },
  stepperUnit: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  diffRow: { flexDirection: 'row', gap: 10 },
  diffCard: {
    flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
  },
  diffEmoji: { fontSize: 24 },
  diffLabel: { fontSize: 14, fontWeight: '800', color: Colors.text },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },

  generateBtn: {
    backgroundColor: Colors.gold, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 18, borderRadius: 16, gap: 10,
  },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnIcon: { width: 26, height: 26, borderRadius: 7 },
  generateBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
