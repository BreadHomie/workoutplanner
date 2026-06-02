import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GenerateWorkoutInputDifficultyLevel,
  GeneratedWorkout,
  useGenerateWorkout,
  useGetProfile,
  useGetStatsSummary,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

const SPLIT_OPTIONS = ["Full Body", "Upper", "Lower", "Push", "Pull", "Legs"];

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const { data: stats } = useGetStatsSummary();
  const generateWorkoutMut = useGenerateWorkout();

  const [split, setSplit] = useState<string>("Full Body");
  const [variant, setVariant] = useState<string>("Standard");
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("lastGeneratedWorkout").then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const isToday = new Date(parsed.timestamp).toDateString() === new Date().toDateString();
          if (isToday && parsed.workout) {
            setGeneratedWorkout(parsed.workout);
          }
        } catch (e) {}
      }
    });
  }, []);

  const handleGenerate = () => {
    if (!profile) return;
    const now = new Date();
    generateWorkoutMut.mutate(
      {
        data: {
          splitType: split as any,
          splitVariant: variant as any,
          difficultyLevel: profile.difficultyLevel as GenerateWorkoutInputDifficultyLevel,
          equipment: profile.equipment,
          scheduledDate: now.toISOString(),
        },
      },
      {
        onSuccess: (data) => {
          setGeneratedWorkout(data);
          AsyncStorage.setItem(
            "lastGeneratedWorkout",
            JSON.stringify({ workout: data, timestamp: now.toISOString() })
          );
        },
      }
    );
  };

  const handleStartWorkout = () => {
    if (!generatedWorkout) return;
    AsyncStorage.setItem("activeWorkout", JSON.stringify(generatedWorkout)).then(() => {
      router.push("/log-workout");
    });
  };

  if (isProfileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const showVariant = split === "Lower" || split === "Legs";
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const thisWeekCount = stats?.thisWeekCount || 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      {!generatedWorkout ? (
        <View style={styles.generatorSection}>
          <Text style={[styles.header, { color: colors.foreground }]}>Today's Session</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 24 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {SPLIT_OPTIONS.map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setSplit(s)}
                style={[
                  styles.chip,
                  { backgroundColor: split === s ? colors.primary : colors.secondary }
                ]}
              >
                <Text style={[styles.chipText, { color: split === s ? colors.primaryForeground : colors.secondaryForeground }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showVariant && (
            <View style={[styles.segmentedControl, { backgroundColor: colors.secondary, marginBottom: 24 }]}>
              {["Standard", "Core"].map(v => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setVariant(v)}
                  style={[
                    styles.segmentBtn,
                    variant === v && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
                  ]}
                >
                  <Text style={[styles.segmentText, { color: variant === v ? colors.foreground : colors.mutedForeground }]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.primary }]}
            onPress={handleGenerate}
            disabled={generateWorkoutMut.isPending}
          >
            {generateWorkoutMut.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="zap" size={20} color={colors.primaryForeground} style={{ marginRight: 8 }} />
                <Text style={[styles.bigBtnText, { color: colors.primaryForeground }]}>Generate Workout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.workoutSection}>
          <View style={styles.workoutHeader}>
            <View>
              <Text style={[styles.workoutSplit, { color: colors.primary }]}>
                {generatedWorkout.splitType} {generatedWorkout.splitVariant !== "Standard" ? `+ ${generatedWorkout.splitVariant}` : ""}
              </Text>
              <Text style={[styles.workoutTitle, { color: colors.foreground }]}>Training Block</Text>
            </View>
            <TouchableOpacity onPress={() => { setGeneratedWorkout(null); AsyncStorage.removeItem("lastGeneratedWorkout"); }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_500Medium" }}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressStrip}>
            {weekDays.map((d, i) => (
              <View key={i} style={[styles.dayDot, { backgroundColor: i < thisWeekCount ? colors.primary : colors.muted }]}>
                <Text style={[styles.dayText, { color: i < thisWeekCount ? colors.primaryForeground : colors.mutedForeground }]}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.compoundSection}>
            <View style={[styles.compoundCard, { backgroundColor: colors.card, borderLeftColor: colors.primary }]}>
              <Text style={[styles.circuitLabel, { color: colors.mutedForeground }]}>COMPOUND</Text>
              <Text style={[styles.exNameLg, { color: colors.foreground }]}>{generatedWorkout.compound.exercise.name}</Text>
              <View style={styles.pillRow}>
                <View style={[styles.pill, { backgroundColor: colors.muted }]}><Text style={[styles.pillText, { color: colors.foreground }]}>{generatedWorkout.compound.suggestedSets}×{generatedWorkout.compound.suggestedReps}</Text></View>
              </View>
              <View style={[styles.lastBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.lastBadgeText, { color: colors.mutedForeground }]}>
                  {generatedWorkout.compound.lastLog ? `Last: ${generatedWorkout.compound.lastLog.weightUsed || 'Bodyweight'} lbs` : 'First time'}
                </Text>
              </View>
            </View>
          </View>

          {generatedWorkout.circuits.map((circuit) => (
            <View key={circuit.circuitNumber} style={styles.circuitSection}>
              <Text style={[styles.circuitLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>CIRCUIT {circuit.circuitNumber}</Text>
              <View style={styles.circuitGrid}>
                {circuit.exercises.map((ex, i) => (
                  <View key={i} style={[styles.miniCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text numberOfLines={2} style={[styles.exNameSm, { color: colors.foreground }]}>{ex.exercise.name}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={[styles.lastBadge, { backgroundColor: colors.muted, alignSelf: 'flex-start', marginTop: 8 }]}>
                      <Text style={[styles.lastBadgeText, { color: colors.mutedForeground, fontSize: 10 }]}>
                        {ex.lastLog ? `Last: ${ex.lastLog.weightUsed || 'BW'} lbs` : 'First time'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={handleStartWorkout}
          >
            <Text style={[styles.bigBtnText, { color: colors.primaryForeground }]}>Start Workout →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },
  generatorSection: { marginTop: 8 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  chipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  segmentedControl: { flexDirection: "row", padding: 4, borderRadius: 12 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  bigBtn: { height: 64, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  bigBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  workoutSection: { marginTop: 8 },
  workoutHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 },
  workoutSplit: { fontSize: 14, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  workoutTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  progressStrip: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32, paddingHorizontal: 8 },
  dayDot: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  dayText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  compoundSection: { marginBottom: 32 },
  compoundCard: { padding: 20, borderRadius: 16, borderLeftWidth: 4 },
  circuitLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 8 },
  exNameLg: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 12 },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  lastBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  lastBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  circuitSection: { marginBottom: 24 },
  circuitGrid: { flexDirection: "row", gap: 12 },
  miniCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, minHeight: 120 },
  exNameSm: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
});
