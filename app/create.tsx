import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { HuntDifficulty } from '@/lib/types';
import { generateHunt } from '@/lib/api';
import { useAppStore } from '@/lib/store';

const DIFFICULTIES: { key: HuntDifficulty; label: string; emoji: string; desc: string; color: string }[] = [
  { key: 'easy', label: 'Chill', emoji: '🌿', desc: '5 items · relaxed vibes', color: Colors.green },
  { key: 'medium', label: 'Honky', emoji: '🪿', desc: '8 items · classic goose chaos', color: Colors.gold },
  { key: 'hard', label: 'Feral', emoji: '🔥', desc: '12 items · pure madness', color: Colors.red },
];

const PROMPT_SUGGESTIONS = [
  'Dog-friendly things in the park',
  'Things that are surprisingly old',
  'Local street art and murals',
  'Hidden gems only locals know',
  'Things that start with the letter B',
  'Weird or funny signs',
  'Nature stuff you can touch',
];

export default function CreateScreen() {
  const router = useRouter();
  const saveHunt = useAppStore((s) => s.saveHunt);

  const [location, setLocation] = useState('');
  const [prompt, setPrompt] = useState('');
  const [difficulty, setDifficulty] = useState<HuntDifficulty>('medium');
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = location.trim().length > 2 && prompt.trim().length > 2;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGenerating(true);
    try {
      const hunt = await generateHunt({ location: location.trim(), prompt: prompt.trim(), difficulty });
      await saveHunt(hunt);
      router.replace(`/hunt/${hunt.id}`);
    } catch (e: any) {
      Alert.alert('Generation Failed', e.message || 'Could not generate the hunt. Check your connection and try again.', [
        { text: 'OK' },
      ]);
    } finally {
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
        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Where are you?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Central Park, NYC"
            placeholderTextColor={Colors.textMuted}
            value={location}
            onChangeText={setLocation}
            returnKeyType="next"
          />
        </View>

        {/* Prompt */}
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
            {PROMPT_SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.suggestion}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPrompt(s);
                }}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                  style={[
                    styles.diffCard,
                    selected && { borderColor: d.color, backgroundColor: `${d.color}15` },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDifficulty(d.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.diffEmoji}>{d.emoji}</Text>
                  <Text style={[styles.diffLabel, selected && { color: d.color }]}>{d.label}</Text>
                  <Text style={styles.diffDesc}>{d.desc}</Text>
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
              <ActivityIndicator color="#000" />
              <Text style={styles.generateBtnText}>Hatching your hunt...</Text>
            </>
          ) : (
            <>
              <Text style={styles.generateBtnIcon}>🪿</Text>
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

  section: { marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  suggestions: { gap: 8, paddingTop: 10, paddingRight: 4 },
  suggestion: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: { fontSize: 13, color: Colors.textSecondary },

  diffRow: { flexDirection: 'row', gap: 10 },
  diffCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  diffEmoji: { fontSize: 24 },
  diffLabel: { fontSize: 14, fontWeight: '800', color: Colors.text },
  diffDesc: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  generateBtn: {
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnIcon: { fontSize: 20 },
  generateBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
