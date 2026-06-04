import React, { useState, useMemo } from "react";
import {
  ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Switch,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useListExercises, useGetExerciseLogs, useCreateExercise,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { format } from "date-fns";

const MUSCLE_FILTERS = ["All", "Chest", "Back", "Legs", "Core", "Arms", "Shoulders"];
const EQUIPMENT_OPTS = ["Full Gym", "Bodyweight", "Dumbbells"];
const DIFFICULTY_OPTS = ["Beginner", "Intermediate", "Advanced"];
const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Core", "Arms", "Shoulders"];

function getMuscles(ex: any): string[] {
  const groups: string[] = [];
  if (ex.hitChest) groups.push("Chest");
  if (ex.hitBack) groups.push("Back");
  if (ex.hitLegs) groups.push("Legs");
  if (ex.hitCore) groups.push("Core");
  if (ex.hitArm) groups.push("Arms");
  if (ex.hitShoulder) groups.push("Shoulders");
  return groups;
}

function getPrimary(ex: any): string {
  const m = getMuscles(ex);
  return m[0] ?? "Other";
}

function ExerciseHistoryRow({ log }: { log: any }) {
  const colors = useColors();
  return (
    <View style={[hStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[hStyles.date, { color: colors.mutedForeground }]}>
        {log.scheduledDate ? format(new Date(log.scheduledDate), "MMM d") : "—"}
      </Text>
      <Text style={[hStyles.weight, { color: colors.foreground }]}>
        {log.weightUsed != null ? `${log.weightUsed} lbs` : "Bodyweight"}
      </Text>
      <Text style={[hStyles.sets, { color: colors.mutedForeground }]}>
        {log.sets}×{log.reps}
      </Text>
    </View>
  );
}

const hStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1 },
  date: { fontSize: 12, fontFamily: "Inter_500Medium", width: 52 },
  weight: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  sets: { fontSize: 12, fontFamily: "Inter_500Medium", width: 44, textAlign: "right" },
});

function ExerciseCard({ exercise }: { exercise: any }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const { data: logs, isLoading: logsLoading } = useGetExerciseLogs(exercise.id, {
    query: { enabled: expanded } as any,
  });

  const muscles = getMuscles(exercise);

  return (
    <View style={[cStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={cStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[cStyles.name, { color: colors.foreground }]} numberOfLines={1}>
              {exercise.name}
            </Text>
            {muscles.length > 0 && (
              <View style={cStyles.tagRow}>
                {muscles.map(m => (
                  <View key={m} style={[cStyles.muscleTag, { backgroundColor: colors.muted }]}>
                    <Text style={[cStyles.muscleTagText, { color: colors.mutedForeground }]}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={cStyles.rightCol}>
            <View style={[cStyles.equipBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[cStyles.equipText, { color: colors.primary }]} numberOfLines={1}>
                {exercise.equipment}
              </Text>
            </View>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[cStyles.body, { borderTopColor: colors.border }]}>
          <View style={cStyles.metaRow}>
            <View style={[cStyles.diffBadge, { backgroundColor: colors.muted }]}>
              <Text style={[cStyles.diffText, { color: colors.mutedForeground }]}>{exercise.difficulty}</Text>
            </View>
            {exercise.isCompound && (
              <View style={[cStyles.compBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[cStyles.compText, { color: colors.primary }]}>Compound</Text>
              </View>
            )}
          </View>

          <Text style={[cStyles.histTitle, { color: colors.foreground }]}>Weight History</Text>
          {logsLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />}
          {!logsLoading && (!logs || logs.length === 0) && (
            <Text style={[cStyles.noLogs, { color: colors.mutedForeground }]}>No logs yet — track this exercise to see history.</Text>
          )}
          {!logsLoading && logs && logs.length > 0 && (
            <View>
              {logs.slice(0, 10).map((log: any) => (
                <ExerciseHistoryRow key={log.id} log={log} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const cStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 10 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 5 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  muscleTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  muscleTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  rightCol: { alignItems: "flex-end", gap: 8, paddingTop: 2 },
  equipBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: 100 },
  equipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  body: { borderTopWidth: 1, padding: 14, gap: 10 },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  compBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  compText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  histTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  noLogs: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
});

function AddExerciseModal({
  visible, onClose,
}: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const createEx = useCreateExercise();

  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState("Full Gym");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [muscles, setMuscles] = useState<Set<string>>(new Set());
  const [isCompound, setIsCompound] = useState(false);
  const [error, setError] = useState("");

  const toggleMuscle = (m: string) => {
    setMuscles(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) { setError("Exercise name is required"); return; }
    if (muscles.size === 0) { setError("Select at least one muscle group"); return; }
    setError("");

    createEx.mutate(
      {
        data: {
          name: name.trim(),
          equipment: equipment as any,
          difficulty: difficulty as any,
          isCompound,
          hitChest: muscles.has("Chest"),
          hitBack: muscles.has("Back"),
          hitLegs: muscles.has("Legs"),
          hitCore: muscles.has("Core"),
          hitArm: muscles.has("Arms"),
          hitShoulder: muscles.has("Shoulders"),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
          setName("");
          setEquipment("Full Gym");
          setDifficulty("Beginner");
          setMuscles(new Set());
          setIsCompound(false);
          onClose();
        },
        onError: () => setError("Failed to create exercise. Try again."),
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[mStyles.container, { backgroundColor: colors.background }]}>
        <View style={[mStyles.header, { borderBottomColor: colors.border }]}>
          <Text style={[mStyles.title, { color: colors.foreground }]}>Add Exercise</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={mStyles.body} keyboardShouldPersistTaps="handled">
          <Text style={[mStyles.label, { color: colors.foreground }]}>Exercise Name *</Text>
          <TextInput
            style={[mStyles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Barbell Row"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <Text style={[mStyles.label, { color: colors.foreground }]}>Equipment</Text>
          <View style={mStyles.chipRow}>
            {EQUIPMENT_OPTS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => setEquipment(opt)}
                style={[mStyles.chip, { backgroundColor: equipment === opt ? colors.primary : colors.secondary }]}
              >
                <Text style={[mStyles.chipText, { color: equipment === opt ? colors.primaryForeground : colors.secondaryForeground }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[mStyles.label, { color: colors.foreground }]}>Difficulty</Text>
          <View style={mStyles.chipRow}>
            {DIFFICULTY_OPTS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => setDifficulty(opt)}
                style={[mStyles.chip, { backgroundColor: difficulty === opt ? colors.primary : colors.secondary }]}
              >
                <Text style={[mStyles.chipText, { color: difficulty === opt ? colors.primaryForeground : colors.secondaryForeground }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[mStyles.label, { color: colors.foreground }]}>Muscle Groups *</Text>
          <View style={mStyles.muscleGrid}>
            {MUSCLE_GROUPS.map(m => {
              const sel = muscles.has(m);
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => toggleMuscle(m)}
                  style={[mStyles.muscleChip, {
                    backgroundColor: sel ? colors.primary + "20" : colors.secondary,
                    borderColor: sel ? colors.primary : colors.border,
                  }]}
                >
                  {sel && <Feather name="check" size={11} color={colors.primary} style={{ marginRight: 3 }} />}
                  <Text style={[mStyles.muscleChipText, { color: sel ? colors.primary : colors.secondaryForeground }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[mStyles.switchRow, { borderColor: colors.border }]}>
            <View>
              <Text style={[mStyles.switchLabel, { color: colors.foreground }]}>Compound Movement</Text>
              <Text style={[mStyles.switchSub, { color: colors.mutedForeground }]}>Multi-joint exercise (e.g. Squat, Bench)</Text>
            </View>
            <Switch
              value={isCompound}
              onValueChange={setIsCompound}
              trackColor={{ false: colors.muted, true: colors.primary + "60" }}
              thumbColor={isCompound ? colors.primary : colors.mutedForeground}
            />
          </View>

          {error !== "" && (
            <Text style={[mStyles.error, { color: "#ef4444" }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={[mStyles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={createEx.isPending}
          >
            {createEx.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[mStyles.submitText, { color: colors.primaryForeground }]}>Add Exercise</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  body: { padding: 20, gap: 8, paddingBottom: 60 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 12, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  chipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  muscleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscleChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  muscleChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, marginTop: 8 },
  switchLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  switchSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  error: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  submitBtn: { height: 54, borderRadius: 14, justifyContent: "center", alignItems: "center", marginTop: 16 },
  submitText: { fontSize: 17, fontFamily: "Inter_700Bold" },
});

export default function ExerciseLibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: exercises, isLoading } = useListExercises();
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    if (!exercises) return [];
    return exercises.filter(ex => {
      const matchSearch = search === "" || ex.name.toLowerCase().includes(search.toLowerCase());
      const matchMuscle = muscleFilter === "All" || getMuscles(ex).includes(muscleFilter);
      return matchSearch && matchMuscle;
    });
  }, [exercises, search, muscleFilter]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Exercise Library",
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowAdd(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 4 }}>
              <Feather name="plus" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search bar */}
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search !== "" && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Muscle filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {MUSCLE_FILTERS.map(m => (
            <TouchableOpacity
              key={m}
              onPress={() => setMuscleFilter(m)}
              style={[styles.filterChip, {
                backgroundColor: muscleFilter === m ? colors.primary : colors.secondary,
              }]}
            >
              <Text style={[styles.filterChipText, {
                color: muscleFilter === m ? colors.primaryForeground : colors.secondaryForeground,
              }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => <ExerciseCard exercise={item} />}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="inbox" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {search ? `No exercises matching "${search}"` : "No exercises found"}
                </Text>
              </View>
            }
          />
        )}
      </View>

      <AddExerciseModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 14, height: 44, borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
});
