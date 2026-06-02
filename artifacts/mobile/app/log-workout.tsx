import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GeneratedWorkout,
  useAddSessionLog,
  useCreateSession,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";

interface LogState {
  sets: string;
  reps: string;
  weightUsed: string;
}

export default function LogWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const createSession = useCreateSession();
  const addSessionLog = useAddSessionLog();

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [logs, setLogs] = useState<Record<number, LogState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("activeWorkout").then((data) => {
      if (data) {
        try {
          const parsed: GeneratedWorkout = JSON.parse(data);
          setWorkout(parsed);

          // Initialize logs
          const initialLogs: Record<number, LogState> = {};
          if (parsed.compound) {
            initialLogs[parsed.compound.exercise.id] = {
              sets: parsed.compound.suggestedSets.toString(),
              reps: parsed.compound.suggestedReps.toString(),
              weightUsed: parsed.compound.lastLog?.weightUsed?.toString() || "",
            };
          }
          if (parsed.compound2) {
            initialLogs[parsed.compound2.exercise.id] = {
              sets: parsed.compound2.suggestedSets.toString(),
              reps: parsed.compound2.suggestedReps.toString(),
              weightUsed: parsed.compound2.lastLog?.weightUsed?.toString() || "",
            };
          }
          parsed.circuits.forEach((circuit) => {
            circuit.exercises.forEach((ex) => {
              initialLogs[ex.exercise.id] = {
                sets: ex.suggestedSets.toString(),
                reps: ex.suggestedReps.toString(),
                weightUsed: ex.lastLog?.weightUsed?.toString() || "",
              };
            });
          });
          setLogs(initialLogs);
        } catch (e) {}
      }
    });
  }, []);

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

      Alert.alert("Success", "Workout logged successfully!", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (err) {
      Alert.alert("Error", "Failed to log workout");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workout) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const allExercises = [];
  if (workout.compound) allExercises.push(workout.compound);
  if (workout.compound2) allExercises.push(workout.compound2);
  workout.circuits.forEach((c) => {
    c.exercises.forEach((ex) => allExercises.push(ex));
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Log Workout
          </Text>
          <Button
            title="Cancel"
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
          />
        </View>

        {allExercises.map((item, idx) => (
          <Card key={idx} style={styles.card}>
            <Text style={[styles.exerciseName, { color: colors.foreground }]}>
              {item.exercise.name}
            </Text>
            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Sets
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.input,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                  keyboardType="numeric"
                  value={logs[item.exercise.id]?.sets}
                  onChangeText={(val) =>
                    setLogs((prev) => ({
                      ...prev,
                      [item.exercise.id]: { ...prev[item.exercise.id], sets: val },
                    }))
                  }
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Reps
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.input,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                  keyboardType="numeric"
                  value={logs[item.exercise.id]?.reps}
                  onChangeText={(val) =>
                    setLogs((prev) => ({
                      ...prev,
                      [item.exercise.id]: { ...prev[item.exercise.id], reps: val },
                    }))
                  }
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1.5 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Weight (lbs)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.input,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholder="Bodyweight"
                  placeholderTextColor={colors.mutedForeground}
                  value={logs[item.exercise.id]?.weightUsed}
                  onChangeText={(val) =>
                    setLogs((prev) => ({
                      ...prev,
                      [item.exercise.id]: {
                        ...prev[item.exercise.id],
                        weightUsed: val,
                      },
                    }))
                  }
                />
              </View>
            </View>
          </Card>
        ))}

        <Button
          title="Finish & Save"
          icon="check"
          size="lg"
          loading={isSubmitting}
          onPress={handleFinish}
          style={styles.finishBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  inputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  finishBtn: {
    marginTop: 24,
  },
});
