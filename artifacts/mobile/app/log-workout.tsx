import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GeneratedWorkout,
  useAddSessionLog,
  useCreateSession,
  ExerciseWithHistory,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface LogState {
  sets: string;
  reps: string;
  weightUsed: string;
  setsCompleted: number;
}

const getMuscleIcon = (ex: ExerciseWithHistory) => {
  if (ex.exercise.hitArm) return "zap";
  if (ex.exercise.hitChest) return "crosshair";
  if (ex.exercise.hitLegs) return "anchor";
  if (ex.exercise.hitCore) return "wind";
  if (ex.exercise.hitBack) return "activity";
  if (ex.exercise.hitShoulder) return "sun";
  return "circle";
};

export default function LogWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const createSession = useCreateSession();
  const addSessionLog = useAddSessionLog();

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [logs, setLogs] = useState<Record<number, LogState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allExercises, setAllExercises] = useState<{item: ExerciseWithHistory, label: string}[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [showPROverlay, setShowPROverlay] = useState(false);
  const prOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem("activeWorkout").then((data) => {
      if (data) {
        try {
          const parsed: GeneratedWorkout = JSON.parse(data);
          setWorkout(parsed);

          const exercisesList: {item: ExerciseWithHistory, label: string}[] = [];
          if (parsed.compound) exercisesList.push({ item: parsed.compound, label: "PRIMARY COMPOUND" });
          if (parsed.compound2) exercisesList.push({ item: parsed.compound2, label: "SECONDARY COMPOUND" });
          parsed.circuits.forEach((c) => {
            c.exercises.forEach((ex, i) => {
              exercisesList.push({ item: ex, label: `CIRCUIT ${c.circuitNumber} · EXERCISE ${i + 1}` });
            });
          });
          setAllExercises(exercisesList);

          const initialLogs: Record<number, LogState> = {};
          exercisesList.forEach(({ item }) => {
            initialLogs[item.exercise.id] = {
              sets: item.suggestedSets.toString(),
              reps: item.suggestedReps.toString(),
              weightUsed: item.lastLog?.weightUsed?.toString() || "",
              setsCompleted: 0,
            };
          });
          setLogs(initialLogs);
        } catch (e) {}
      }
    });
  }, []);

  const handleNext = async () => {
    const currentEx = allExercises[currentIndex].item;
    const currentLog = logs[currentEx.exercise.id];
    
    let isPR = false;
    if (currentEx.lastLog?.weightUsed && currentLog.weightUsed) {
      if (Number(currentLog.weightUsed) > currentEx.lastLog.weightUsed) {
        isPR = true;
      }
    }

    if (isPR) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPROverlay(true);
      Animated.sequence([
        Animated.timing(prOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(prOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start(() => {
        setShowPROverlay(false);
        advanceOrFinish();
      });
    } else {
      advanceOrFinish();
    }
  };

  const advanceOrFinish = async () => {
    if (currentIndex < allExercises.length - 1) {
      slideAnim.setValue(SCREEN_WIDTH);
      setCurrentIndex((prev) => prev + 1);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!workout) return;
    setIsSubmitting(true);
    try {
      const session = await createSession.mutateAsync({
        data: {
          splitType: workout.splitType,
          splitVariant: workout.splitVariant,
          completedAt: new Date().toISOString(),
        },
      });

      const promises = Object.entries(logs).map(([exerciseId, log]) => {
        return addSessionLog.mutateAsync({
          sessionId: session.id,
          data: {
            exerciseId: Number(exerciseId),
            sets: Number(log.sets) || 0,
            reps: Number(log.reps) || 0,
            weightUsed: log.weightUsed ? Number(log.weightUsed) : undefined,
          },
        });
      });

      await Promise.all(promises);
      await AsyncStorage.removeItem("activeWorkout");
      await AsyncStorage.removeItem("lastGeneratedWorkout");

      router.replace("/");
    } catch (err) {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workout || allExercises.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const currentExerciseObj = allExercises[currentIndex];
  const { item, label } = currentExerciseObj;
  const currentLog = logs[item.exercise.id];
  const progressWidth = ((currentIndex + 1) / allExercises.length) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={[styles.progressBarBg, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${progressWidth}%` }]} />
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          <View style={styles.cardContainer}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.exerciseName, { color: colors.foreground }]}>{item.exercise.name}</Text>
            
            <View style={styles.tagsRow}>
              <View style={[styles.tag, { backgroundColor: colors.muted }]}>
                <Feather name={getMuscleIcon(item)} size={12} color={colors.primary} />
                <Text style={[styles.tagText, { color: colors.foreground }]}>{item.exercise.classification}</Text>
              </View>
            </View>

            <View style={[styles.lastSessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.lastSessionLabel, { color: colors.mutedForeground }]}>Last session</Text>
              {item.lastLog ? (
                <Text style={[styles.lastSessionValue, { color: colors.foreground }]}>
                  {item.lastLog.weightUsed ? `${item.lastLog.weightUsed} lbs` : "Bodyweight"} × {item.lastLog.reps} reps
                </Text>
              ) : (
                <Text style={[styles.lastSessionValue, { color: colors.mutedForeground }]}>First time — set your baseline</Text>
              )}
            </View>

            <View style={styles.inputsRow}>
              <View style={styles.inputCol}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
                <TextInput
                  style={[styles.bigInput, { backgroundColor: colors.input, color: colors.foreground }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  value={currentLog?.weightUsed}
                  onChangeText={(val) => setLogs(p => ({ ...p, [item.exercise.id]: { ...p[item.exercise.id], weightUsed: val } }))}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Reps</Text>
                <TextInput
                  style={[styles.bigInput, { backgroundColor: colors.input, color: colors.foreground }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  value={currentLog?.reps}
                  onChangeText={(val) => setLogs(p => ({ ...p, [item.exercise.id]: { ...p[item.exercise.id], reps: val } }))}
                />
              </View>
            </View>

            <View style={styles.setsContainer}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Sets completed</Text>
              <TouchableOpacity 
                style={styles.dotsRow} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLogs(p => {
                    const c = p[item.exercise.id];
                    const next = (c.setsCompleted + 1) > parseInt(c.sets || "3") ? 0 : c.setsCompleted + 1;
                    return { ...p, [item.exercise.id]: { ...c, setsCompleted: next } };
                  });
                }}
              >
                {Array.from({ length: parseInt(currentLog?.sets || "3") }).map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.dot, 
                      { backgroundColor: i < (currentLog?.setsCompleted || 0) ? colors.primary : colors.muted }
                    ]} 
                  />
                ))}
              </TouchableOpacity>
            </View>

          </View>
        </Animated.View>

        <View style={styles.bottomContainer}>
          <TouchableOpacity 
            style={[styles.nextBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]} 
            onPress={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
                {currentIndex === allExercises.length - 1 ? "Finish Workout" : "Next Exercise →"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {showPROverlay && (
        <Animated.View style={[styles.prOverlay, { backgroundColor: 'rgba(0,0,0,0.9)', opacity: prOpacity }]}>
          <View style={[styles.prBox, { borderColor: colors.primary }]}>
            <Text style={[styles.prTitle, { color: colors.primary }]}>NEW PR</Text>
            <Text style={[styles.prSubtitle, { color: colors.foreground }]}>{item.exercise.name}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerContainer: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, marginHorizontal: 16, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  cardContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  cardLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 8 },
  exerciseName: { fontSize: 36, fontFamily: "Inter_700Bold", lineHeight: 40, marginBottom: 16 },
  tagsRow: { flexDirection: "row", marginBottom: 32 },
  tag: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, gap: 6 },
  tagText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  lastSessionCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 32 },
  lastSessionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4, textTransform: "uppercase" },
  lastSessionValue: { fontSize: 16, fontFamily: "Inter_500Medium" },
  inputsRow: { flexDirection: "row", gap: 16, marginBottom: 32 },
  inputCol: { flex: 1 },
  inputLabel: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 8 },
  bigInput: { height: 72, borderRadius: 16, fontSize: 32, fontFamily: "Inter_700Bold", textAlign: "center" },
  setsContainer: { alignItems: "center" },
  dotsRow: { flexDirection: "row", gap: 12, paddingVertical: 12 },
  dot: { width: 24, height: 24, borderRadius: 12 },
  bottomContainer: { paddingHorizontal: 24, paddingVertical: 16 },
  nextBtn: { height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  nextBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  prOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", zIndex: 1000 },
  prBox: { padding: 40, borderRadius: 24, borderWidth: 2, alignItems: "center" },
  prTitle: { fontSize: 48, fontFamily: "Inter_700Bold", marginBottom: 8 },
  prSubtitle: { fontSize: 18, fontFamily: "Inter_500Medium", textAlign: "center" }
});
