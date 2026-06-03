import {
  useListSessions, useGetSession, useAddSessionLog, useUpdateSessionLog,
  useCompleteWorkout, useCompleteExercise, useUpdateSession, useReplaceExercise
} from "@workspace/api-client-react";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { Feather } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity,
  View, Image, TextInput, Animated
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

type SetData = { done: boolean; weight: string };

function parseSetData(json: string | null | undefined, numSets: number): SetData[] {
  if (!json) return Array.from({ length: numSets }, () => ({ done: false, weight: "" }));
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && typeof parsed[0] === "boolean") {
        return parsed.map((b: boolean) => ({ done: b, weight: "" }));
      }
      return parsed.map((s: any) => ({ done: s.done ?? false, weight: s.weight != null ? String(s.weight) : "" }));
    }
  } catch (_) {}
  return Array.from({ length: numSets }, () => ({ done: false, weight: "" }));
}

function getPrimaryMuscle(ex: any): string {
  if (ex?.hitChest) return "Chest";
  if (ex?.hitBack) return "Back";
  if (ex?.hitLegs) return "Legs";
  if (ex?.hitCore) return "Core";
  if (ex?.hitArm) return "Arms";
  if (ex?.hitShoulder) return "Shoulders";
  return "";
}

function StarRating({ rating, onRate }: { rating: number | null; onRate: (n: number) => void }) {
  const colors = useColors();
  return (
    <View style={srStyles.row}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onRate(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Ionicons
            name={n <= (rating ?? 0) ? "star" : "star-outline"}
            size={14}
            color={n <= (rating ?? 0) ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}
const srStyles = StyleSheet.create({ row: { flexDirection: "row", gap: 3 } });

function SectionHeader({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={shStyles.row}>
      <View style={[shStyles.line, { backgroundColor: colors.border }]} />
      <Text style={[shStyles.label, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      <View style={[shStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}
const shStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 },
  line: { flex: 1, height: 1 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
});

function ExerciseLogItem({ session, exerciseData }: { session: any; exerciseData: any }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const updateLog = useUpdateSessionLog();
  const addLog = useAddSessionLog();
  const completeEx = useCompleteExercise();
  const replaceEx = useReplaceExercise();

  const exercise = exerciseData.exercise;
  const existingLog = session.logs?.find((l: any) => l.exerciseId === exercise.id);
  const logId: number | undefined = existingLog?.id;

  const [expanded, setExpanded] = useState(false);
  const [sets, setSets] = useState<SetData[]>(() =>
    parseSetData(existingLog?.setCompletions, exerciseData.suggestedSets)
  );
  const [notes, setNotes] = useState(existingLog?.notes || "");
  const [rating, setRating] = useState<number | null>(existingLog?.rating ?? null);
  const [isCompleted, setIsCompleted] = useState(existingLog?.isCompleted || false);
  const [showToast, setShowToast] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveLog = (data: Record<string, unknown>) => {
    if (logId) {
      updateLog.mutate({ sessionId: session.id, logId, data: data as any });
    } else {
      addLog.mutate({
        sessionId: session.id,
        data: { exerciseId: exercise.id, sets: exerciseData.suggestedSets, reps: exerciseData.suggestedReps, ...data } as any,
      });
    }
  };

  const persistSets = (newSets: SetData[], immediate: boolean) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const doSave = () => {
      const json = JSON.stringify(newSets.map(s => ({ done: s.done, weight: s.weight ? parseFloat(s.weight) : null })));
      const maxWeight = Math.max(0, ...newSets.map(s => parseFloat(s.weight) || 0));
      saveLog({ setCompletions: json, ...(maxWeight > 0 ? { weightUsed: maxWeight } : {}) });
    };
    if (immediate) doSave();
    else saveTimerRef.current = setTimeout(doSave, 800);
  };

  useEffect(() => {
    const t = setTimeout(() => saveLog({ notes }), 800);
    return () => clearTimeout(t);
  }, [notes]);

  const handleSetToggle = (idx: number) => {
    const next = sets.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    setSets(next);
    persistSets(next, true);
    if (next.every(s => s.done) && !isCompleted) handleComplete();
  };

  const handleSetWeight = (idx: number, weight: string) => {
    const next = sets.map((s, i) => i === idx ? { ...s, weight } : s);
    setSets(next);
    persistSets(next, false);
  };

  const handleRating = (n: number) => {
    setRating(n);
    saveLog({ rating: n });
  };

  const handleComplete = () => {
    if (isCompleted) return;
    setIsCompleted(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (logId) {
      updateLog.mutate({ sessionId: session.id, logId, data: { isCompleted: true } });
      completeEx.mutate(
        { sessionId: session.id, logId },
        {
          onSuccess: () => {
            setShowToast(true);
            Animated.sequence([
              Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.delay(1000),
              Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => setShowToast(false));
          },
        }
      );
    }
  };

  const handleSwap = () => {
    setIsReplacing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    replaceEx.mutate(
      { sessionId: session.id, data: { exerciseId: exercise.id, direction: "random" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/sessions", session.id] });
          setIsReplacing(false);
        },
        onError: () => setIsReplacing(false),
      }
    );
  };

  const muscle = getPrimaryMuscle(exercise);
  const completedCount = sets.filter(s => s.done).length;
  const totalSets = sets.length;

  return (
    <View style={[styles.exCard, {
      backgroundColor: colors.card,
      borderColor: isCompleted ? colors.primary + "50" : colors.border,
    }]}>
      {/* Collapsed header */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7} disabled={isReplacing}>
        <View style={styles.exHeader}>
          <TouchableOpacity
            onPress={() => handleComplete()}
            disabled={isCompleted}
            style={styles.checkBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={isCompleted ? "check-circle" : "circle"}
              size={22}
              color={isCompleted ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[styles.exName, { color: isCompleted ? colors.mutedForeground : colors.foreground }]} numberOfLines={1}>
              {exercise.name}
            </Text>
            <View style={styles.exTagRow}>
              {muscle ? (
                <View style={[styles.muscleTag, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.muscleTagText, { color: colors.mutedForeground }]}>{muscle}</Text>
                </View>
              ) : null}
              <Text style={[styles.setsProgress, {
                color: completedCount === totalSets ? colors.primary : colors.mutedForeground
              }]}>
                {completedCount}/{totalSets} sets
              </Text>
            </View>
          </View>

          <View style={styles.exHeaderRight}>
            <StarRating rating={rating} onRate={handleRating} />
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedForeground} />
          </View>
        </View>
      </TouchableOpacity>

      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, backgroundColor: colors.secondary }]}>
          <Text style={[styles.toastText, { color: colors.primary }]}>+10 XP</Text>
        </Animated.View>
      )}

      {expanded && (
        <View style={[styles.exBody, { borderTopColor: colors.border }]}>
          {/* Per-set rows: each has own weight input */}
          <View style={styles.setsTable}>
            {sets.map((s, idx) => (
              <View key={idx} style={[styles.setRow, idx < sets.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity
                  onPress={() => handleSetToggle(idx)}
                  style={styles.setCheckbox}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather
                    name={s.done ? "check-circle" : "circle"}
                    size={18}
                    color={s.done ? colors.primary : colors.mutedForeground}
                  />
                </TouchableOpacity>
                <Text style={[styles.setLabel, { color: colors.mutedForeground }]}>Set {idx + 1}</Text>
                <View style={styles.setWeightWrap}>
                  <TextInput
                    style={[styles.setWeightInput, {
                      color: colors.foreground,
                      borderColor: s.done ? colors.primary + "60" : colors.border,
                      backgroundColor: colors.background,
                    }]}
                    value={s.weight}
                    onChangeText={w => handleSetWeight(idx, w)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="done"
                  />
                  <Text style={[styles.setWeightUnit, { color: colors.mutedForeground }]}>lbs</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Notes */}
          <TextInput
            style={[styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes for next time..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={2}
          />

          {/* Swap button */}
          <TouchableOpacity
            style={[styles.swapBtn, { backgroundColor: colors.secondary }]}
            onPress={handleSwap}
            disabled={isReplacing}
          >
            {isReplacing ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Feather name="shuffle" size={14} color={colors.foreground} />
                <Text style={[styles.swapBtnText, { color: colors.foreground }]}>Swap Exercise</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SessionDetails({ sessionId }: { sessionId: number }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useGetSession(sessionId);
  const updateSessionMut = useUpdateSession();
  const completeWorkoutMut = useCompleteWorkout();

  const [showRewardModal, setShowRewardModal] = useState(false);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  if (!session) return null;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      updateSessionMut.mutate(
        { sessionId: session.id, data: { photoUri: result.assets[0].uri } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sessions", session.id] }) }
      );
    }
  };

  const handleCompleteWorkout = () => {
    completeWorkoutMut.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowRewardModal(true);
          queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
          setTimeout(() => setShowRewardModal(false), 2000);
        },
      }
    );
  };

  const plan = session.workoutPlan;
  type SectionItem = { data: any };
  const sections: { label: string; items: SectionItem[] }[] = [];

  if (plan) {
    const compoundItems: SectionItem[] = [];
    if (plan.compound?.exercise) compoundItems.push({ data: plan.compound });
    if (plan.compound2?.exercise) compoundItems.push({ data: plan.compound2 });
    if (compoundItems.length > 0) sections.push({ label: "Compound", items: compoundItems });

    plan.circuits?.forEach((c: any) => {
      const items = (c.exercises || []).filter((e: any) => e.exercise).map((e: any) => ({ data: e }));
      if (items.length > 0) sections.push({ label: `Circuit ${c.circuitNumber}`, items });
    });
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: 0 }}>
      <View style={[styles.sessionHeaderCard, { backgroundColor: colors.card }]}>
        <View style={styles.shRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shDate, { color: colors.foreground }]}>
              {session.scheduledDate ? format(new Date(session.scheduledDate), "EEE, MMM d") : "Session"}
            </Text>
            <View style={[styles.shPill, { backgroundColor: colors.background }]}>
              <Text style={[styles.shPillText, { color: colors.primary }]}>
                {session.splitType}{session.splitVariant !== "Standard" ? ` + ${session.splitVariant}` : ""}
              </Text>
            </View>
          </View>
          <View style={[styles.shStatus, { backgroundColor: session.isCompleted ? "#22c55e20" : colors.muted }]}>
            <Text style={[styles.shStatusText, { color: session.isCompleted ? "#22c55e" : colors.mutedForeground }]}>
              {session.isCompleted ? "Completed" : "In Progress"}
            </Text>
          </View>
        </View>

        {session.photoUri ? (
          <Image source={{ uri: session.photoUri }} style={styles.shImage} />
        ) : (
          <TouchableOpacity style={[styles.shPhotoBtn, { borderColor: colors.border }]} onPress={handlePickImage}>
            <Feather name="camera" size={20} color={colors.mutedForeground} />
            <Text style={[styles.shPhotoBtnText, { color: colors.mutedForeground }]}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {sections.map((section) => (
        <View key={section.label} style={{ marginBottom: 4 }}>
          <SectionHeader label={section.label} />
          <View style={{ gap: 8 }}>
            {section.items.map((item, idx) => (
              <ExerciseLogItem key={`${item.data.exercise?.id}-${idx}`} session={session} exerciseData={item.data} />
            ))}
          </View>
        </View>
      ))}

      {!session.isCompleted && (
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={handleCompleteWorkout}
          disabled={completeWorkoutMut.isPending}
        >
          {completeWorkoutMut.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.completeBtnText, { color: colors.primaryForeground }]}>Complete Workout</Text>
          )}
        </TouchableOpacity>
      )}

      {showRewardModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.modalXp, { color: colors.primary }]}>+50 XP</Text>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Workout Complete!</Text>
            <Text style={[styles.modalCoins, { color: colors.mutedForeground }]}>+10 coins</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: sessions, isLoading } = useListSessions();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => { setCurrentIndex(0); }, [sessions?.length]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
      <Text style={[styles.header, { color: colors.foreground }]}>My Workouts</Text>

      {!sessions || sessions.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Generate your first workout plan</Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <View style={styles.carouselNav}>
            <TouchableOpacity onPress={() => setCurrentIndex(c => Math.max(0, c - 1))} disabled={currentIndex === 0}>
              <Feather name="chevron-left" size={28} color={currentIndex === 0 ? colors.muted : colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.carouselText, { color: colors.foreground }]}>
              Session {currentIndex + 1} of {sessions.length}
            </Text>
            <TouchableOpacity onPress={() => setCurrentIndex(c => Math.min(sessions.length - 1, c + 1))} disabled={currentIndex === sessions.length - 1}>
              <Feather name="chevron-right" size={28} color={currentIndex === sessions.length - 1 ? colors.muted : colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <SessionDetails sessionId={sessions[currentIndex].id} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, paddingHorizontal: 20, letterSpacing: -1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  carouselNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  carouselText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  sessionHeaderCard: { padding: 16, borderRadius: 16, marginBottom: 16 },
  shRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  shDate: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  shPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  shPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  shStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  shStatusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  shImage: { width: "100%", height: 180, borderRadius: 10, marginTop: 4 },
  shPhotoBtn: { width: "100%", height: 64, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 },
  shPhotoBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  exCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  exHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  checkBtn: { marginRight: 12 },
  exName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  exTagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  muscleTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  muscleTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  setsProgress: { fontSize: 12, fontFamily: "Inter_500Medium" },
  exHeaderRight: { alignItems: "flex-end", gap: 6 },

  exBody: { borderTopWidth: 1, padding: 14, gap: 12 },

  setsTable: { borderRadius: 8, overflow: "hidden" },
  setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  setCheckbox: { width: 28, alignItems: "center" },
  setLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 48 },
  setWeightWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  setWeightInput: {
    width: 80, height: 38, borderWidth: 1, borderRadius: 8,
    textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 15,
  },
  setWeightUnit: { fontSize: 12, fontFamily: "Inter_500Medium", width: 24 },

  notesInput: {
    minHeight: 56, borderWidth: 1, borderRadius: 8, padding: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", textAlignVertical: "top",
  },

  swapBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10, borderRadius: 10,
  },
  swapBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  completeBtn: { height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  completeBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },

  toast: { position: "absolute", top: 8, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, zIndex: 10 },
  toastText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  modalContent: { padding: 32, borderRadius: 24, borderWidth: 2, alignItems: "center" },
  modalXp: { fontSize: 48, fontFamily: "Inter_700Bold", marginBottom: 8 },
  modalTitle: { fontSize: 24, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  modalCoins: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
