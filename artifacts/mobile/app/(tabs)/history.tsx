import { useListSessions, useGetSession, useAddSessionLog, useUpdateSessionLog, useCompleteWorkout, useCompleteExercise, useUpdateSession } from "@workspace/api-client-react";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image, TextInput, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

function ExerciseLogItem({ session, exerciseData, typeText }: { session: any, exerciseData: any, typeText: string }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const addLog = useAddSessionLog();
  const updateLog = useUpdateSessionLog();
  const completeEx = useCompleteExercise();

  const existingLog = session.logs?.find((l: any) => l.exerciseId === exerciseData.exercise.id);
  const [weight, setWeight] = useState(existingLog?.weightUsed?.toString() || "");
  const [isCompleted, setIsCompleted] = useState(existingLog?.isCompleted || false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Debounce saving weight
  useEffect(() => {
    const timer = setTimeout(() => {
      const parsedWeight = parseFloat(weight);
      if (!isNaN(parsedWeight)) {
        if (existingLog) {
          updateLog.mutate({ logId: existingLog.id, data: { weightUsed: parsedWeight } });
        } else {
          addLog.mutate({
            data: {
              sessionId: session.id,
              exerciseId: exerciseData.exercise.id,
              sets: exerciseData.suggestedSets,
              reps: exerciseData.suggestedReps,
              weightUsed: parsedWeight
            }
          });
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [weight]);

  const handleCheck = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCompleted(true);

    if (existingLog) {
      updateLog.mutate({ logId: existingLog.id, data: { isCompleted: true } });
    } else {
      addLog.mutate({
        data: {
          sessionId: session.id,
          exerciseId: exerciseData.exercise.id,
          sets: exerciseData.suggestedSets,
          reps: exerciseData.suggestedReps,
          isCompleted: true
        }
      });
    }

    completeEx.mutate({ exerciseId: exerciseData.exercise.id }, {
      onSuccess: () => {
        setShowToast(true);
        Animated.sequence([
          Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(1000),
          Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start(() => setShowToast(false));
      }
    });
  };

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.exCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.exName, { color: colors.foreground }]}>{exerciseData.exercise.name}</Text>
          {typeText.startsWith("COMPOUND") ? (
            <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{typeText}</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{typeText}</Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: "center" }}>
          <TouchableOpacity onPress={handleCheck} disabled={isCompleted}>
            <Feather name={isCompleted ? "check-circle" : "circle"} size={28} color={isCompleted ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          {showToast && (
            <Animated.View style={[styles.toast, { opacity: toastOpacity, backgroundColor: colors.secondary }]}>
              <Text style={[styles.toastText, { color: colors.primary }]}>+10 XP</Text>
            </Animated.View>
          )}
        </View>
      </View>
      
      <View style={styles.weightRow}>
        <Text style={[styles.weightLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
        <TextInput
          style={[styles.weightInput, { color: colors.foreground, borderColor: colors.border }]}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>
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

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  }

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
        }
      }
    );
  };

  const plan = session.workoutPlan;
  const exercises = [];
  if (plan.compound) {
    exercises.push({ type: `COMPOUND ${plan.compound.suggestedSets}×${plan.compound.suggestedReps}`, data: plan.compound });
  }
  if (plan.compound2) {
    exercises.push({ type: `COMPOUND ${plan.compound2.suggestedSets}×${plan.compound2.suggestedReps}`, data: plan.compound2 });
  }
  plan.circuits?.forEach(c => {
    c.exercises?.forEach(e => {
      exercises.push({ type: `${e.suggestedSets}×${e.suggestedReps}`, data: e });
    });
  });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100, gap: 16 }}>
      {/* Session Header Card */}
      <View style={[styles.sessionHeaderCard, { backgroundColor: colors.card }]}>
        <View style={styles.shRow}>
          <View>
            <Text style={[styles.shDate, { color: colors.foreground }]}>
              {session.scheduledDate ? format(new Date(session.scheduledDate), "EEEE, MMMM d") : "Untitled Session"}
            </Text>
            <View style={[styles.shPill, { backgroundColor: colors.background }]}>
              <Text style={[styles.shPillText, { color: colors.primary }]}>
                {session.splitType} {session.splitVariant !== "Standard" ? `+ ${session.splitVariant}` : ""}
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
            <Feather name="camera" size={24} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_500Medium" }}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Exercise List */}
      {exercises.map((item, idx) => (
        <ExerciseLogItem key={idx} session={session} exerciseData={item.data} typeText={item.type} />
      ))}

      {/* Complete Button */}
      {!session.isCompleted && (
        <TouchableOpacity style={[styles.completeBtn, { backgroundColor: colors.primary }]} onPress={handleCompleteWorkout} disabled={completeWorkoutMut.isPending}>
          {completeWorkoutMut.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.completeBtnText, { color: colors.primaryForeground }]}>Complete Workout</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Reward Modal Overlay */}
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

  useEffect(() => {
    setCurrentIndex(0);
  }, [sessions?.length]);

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
            <TouchableOpacity 
              onPress={() => setCurrentIndex(c => Math.max(0, c - 1))}
              disabled={currentIndex === 0}
            >
              <Feather name="chevron-left" size={28} color={currentIndex === 0 ? colors.muted : colors.foreground} />
            </TouchableOpacity>
            
            <Text style={[styles.carouselText, { color: colors.foreground }]}>
              Session {currentIndex + 1} of {sessions.length}
            </Text>

            <TouchableOpacity 
              onPress={() => setCurrentIndex(c => Math.min(sessions.length - 1, c + 1))}
              disabled={currentIndex === sessions.length - 1}
            >
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
  
  sessionHeaderCard: { padding: 20, borderRadius: 16, marginBottom: 16 },
  shRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  shDate: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 8 },
  shPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  shPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  shStatus: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  shStatusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  shImage: { width: "100%", height: 200, borderRadius: 12 },
  shPhotoBtn: { width: "100%", height: 80, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", justifyContent: "center", alignItems: "center" },
  
  exerciseCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  exCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  exName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  weightRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  weightLabel: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  weightInput: { width: 80, height: 40, borderWidth: 1, borderRadius: 8, textAlign: "center", fontFamily: "Inter_600SemiBold" },
  
  completeBtn: { width: "100%", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 8 },
  completeBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  
  toast: { position: "absolute", top: 35, right: 0, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  toastText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  modalContent: { padding: 32, borderRadius: 24, borderWidth: 2, alignItems: "center" },
  modalXp: { fontSize: 48, fontFamily: "Inter_700Bold", marginBottom: 8 },
  modalTitle: { fontSize: 24, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  modalCoins: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
