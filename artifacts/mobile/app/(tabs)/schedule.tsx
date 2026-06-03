import { useGetSchedule, useSaveScheduleBulk, useListSessions, useGetProfile } from "@workspace/api-client-react";
import {
  format, startOfMonth, getDaysInMonth, getDay, isSameDay,
  parseISO, addMonths, subMonths, startOfWeek, addDays,
} from "date-fns";
import React, { useState, useEffect } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

type DayState = "none" | "scheduled" | "has-session" | "scheduled-and-session";

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading: isScheduleLoading } = useGetSchedule();
  const { data: sessions } = useListSessions({ params: { limit: 200 } } as any);
  const { data: profile } = useGetProfile();
  const saveScheduleBulk = useSaveScheduleBulk();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    if (schedule) {
      const monthStr = format(currentMonth, "yyyy-MM");
      const initial = new Set<string>();
      schedule.forEach((entry: any) => {
        const d = format(new Date(entry.scheduledDate), "yyyy-MM-dd");
        if (d.startsWith(monthStr)) initial.add(d);
      });
      setSelectedDates(initial);
    }
  }, [schedule, currentMonth]);

  const toggleDate = (dateStr: string) => {
    setExpandedDay(prev => prev === dateStr ? null : dateStr);
  };

  const addToSchedule = (dateStr: string) => {
    setSelectedDates(prev => new Set([...prev, dateStr]));
  };

  const removeFromSchedule = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      next.delete(dateStr);
      return next;
    });
  };

  const handleSave = () => {
    saveScheduleBulk.mutate(
      { data: { yearMonth: format(currentMonth, "yyyy-MM"), dates: [...selectedDates].sort() } },
      {
        onSuccess: () => {
          Alert.alert("Saved", "Schedule saved");
          queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
        },
      }
    );
  };

  // Get day state helpers
  const getSessionForDate = (dateStr: string) => sessions?.find((s: any) => s.scheduledDate === dateStr);
  const isScheduledDate = (dateStr: string) => schedule?.some((e: any) => format(new Date(e.scheduledDate), "yyyy-MM-dd") === dateStr) || selectedDates.has(dateStr);

  const getDayState = (dateStr: string): DayState => {
    const hasSess = !!getSessionForDate(dateStr);
    const hasSched = selectedDates.has(dateStr);
    if (hasSess && hasSched) return "scheduled-and-session";
    if (hasSess) return "has-session";
    if (hasSched) return "scheduled";
    return "none";
  };

  // Weekly cadence stats for current month
  const targetCadence = profile?.targetCadence ?? 3;
  const weekStats = (() => {
    const stats: { label: string; count: number; needed: number }[] = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    let weekCursor = startOfWeek(monthStart, { weekStartsOn: 1 });
    while (weekCursor <= monthEnd) {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekCursor, i);
        if (d.getMonth() === currentMonth.getMonth()) {
          const dateStr = format(d, "yyyy-MM-dd");
          if (selectedDates.has(dateStr)) count++;
        }
      }
      const label = `Wk of ${format(weekCursor, "MMM d")}`;
      stats.push({ label, count, needed: Math.max(0, targetCadence - count) });
      weekCursor = addDays(weekCursor, 7);
    }
    return stats;
  })();

  const generateCalendarGrid = () => {
    const monthStart = startOfMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    const startOffset = getDay(monthStart);
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  if (isScheduleLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const calendarDays = generateCalendarGrid();
  const weekDayHeaders = ["S", "M", "T", "W", "T", "F", "S"];
  const expandedSession = expandedDay ? getSessionForDate(expandedDay) : null;
  const expandedIsScheduled = expandedDay ? selectedDates.has(expandedDay) : false;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 100 }}>
      <Text style={[styles.header, { color: colors.foreground, paddingHorizontal: 20 }]}>Schedule</Text>

      {/* Month Nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentMonth(prev => subMonths(prev, 1))} style={styles.navBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.foreground }]}>{format(currentMonth, "MMMM yyyy")}</Text>
        <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, 1))} style={styles.navBtn}>
          <Feather name="chevron-right" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Calendar */}
      <View style={styles.calendarContainer}>
        <View style={styles.weekHeaders}>
          {weekDayHeaders.map((d, i) => (
            <Text key={i} style={[styles.weekDayText, { color: colors.mutedForeground }]}>{d}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((date, i) => {
            if (!date) return <View key={i} style={styles.dayCellEmpty} />;

            const dateStr = format(date, "yyyy-MM-dd");
            const state = getDayState(dateStr);
            const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
            const isExpanded = expandedDay === dateStr;

            const bgColor = (() => {
              if (state === "scheduled-and-session") return colors.primary;
              if (state === "has-session") return colors.primary + "80";
              if (state === "scheduled") return colors.secondary;
              return colors.card;
            })();

            const textColor = (state === "scheduled-and-session" || state === "has-session") ? colors.primaryForeground : colors.foreground;

            return (
              <TouchableOpacity
                key={i}
                onPress={() => toggleDate(dateStr)}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: bgColor,
                    borderColor: isToday && state === "none" ? colors.primary : isExpanded ? colors.primary : "transparent",
                    borderWidth: (isToday && state === "none") || isExpanded ? 1.5 : 0,
                  },
                ]}
              >
                <Text style={[styles.dayText, { color: textColor }]}>{format(date, "d")}</Text>
                {state === "has-session" && (
                  <View style={[styles.dot, { backgroundColor: colors.primaryForeground }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Expanded day panel */}
      {expandedDay && (
        <View style={[styles.dayPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dayPanelHeader}>
            <Text style={[styles.dayPanelDate, { color: colors.foreground }]}>
              {format(parseISO(expandedDay), "EEEE, MMMM d")}
            </Text>
            <TouchableOpacity onPress={() => setExpandedDay(null)}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {expandedSession ? (
            <View>
              <View style={styles.dayTypeRow}>
                <View style={[styles.dayTypeBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="check-circle" size={12} color={colors.primary} />
                  <Text style={[styles.dayTypeBadgeText, { color: colors.primary }]}>Workout Planned</Text>
                </View>
                {expandedSession.isCompleted && (
                  <View style={[styles.dayTypeBadge, { backgroundColor: "#22c55e20" }]}>
                    <Feather name="award" size={12} color="#22c55e" />
                    <Text style={[styles.dayTypeBadgeText, { color: "#22c55e" }]}>Completed</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.daySessionType, { color: colors.foreground }]}>
                {expandedSession.splitType}{expandedSession.splitVariant !== "Standard" ? ` + ${expandedSession.splitVariant}` : ""}
              </Text>
              <Text style={[styles.daySessionMeta, { color: colors.mutedForeground }]}>
                {expandedSession.logCount} exercises
              </Text>
              <TouchableOpacity
                style={[styles.dayActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => { setExpandedDay(null); router.push("/(tabs)/history"); }}
              >
                <Text style={[styles.dayActionBtnText, { color: colors.primaryForeground }]}>Open in My Workouts</Text>
                <Feather name="arrow-right" size={14} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          ) : expandedIsScheduled ? (
            <View>
              <View style={styles.dayTypeRow}>
                <View style={[styles.dayTypeBadge, { backgroundColor: colors.secondary }]}>
                  <Feather name="calendar" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.dayTypeBadgeText, { color: colors.mutedForeground }]}>Workout Day</Text>
                </View>
              </View>
              <Text style={[styles.dayPanelHint, { color: colors.mutedForeground }]}>
                No workout generated yet. Generate a plan from the Generate tab.
              </Text>
              <View style={styles.dayActionsRow}>
                <TouchableOpacity
                  style={[styles.dayActionBtnSmall, { backgroundColor: colors.muted }]}
                  onPress={() => { removeFromSchedule(expandedDay); setExpandedDay(null); }}
                >
                  <Feather name="x" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.dayActionBtnSmallText, { color: colors.mutedForeground }]}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dayActionBtnSmall, { backgroundColor: colors.secondary }]}
                  onPress={() => { setExpandedDay(null); router.push("/"); }}
                >
                  <Feather name="zap" size={13} color={colors.foreground} />
                  <Text style={[styles.dayActionBtnSmallText, { color: colors.foreground }]}>Generate</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.dayTypeRow}>
                <View style={[styles.dayTypeBadge, { backgroundColor: colors.muted }]}>
                  <Feather name="moon" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.dayTypeBadgeText, { color: colors.mutedForeground }]}>Rest Day</Text>
                </View>
              </View>
              <Text style={[styles.dayPanelHint, { color: colors.mutedForeground }]}>
                This day is not scheduled as a workout day.
              </Text>
              <TouchableOpacity
                style={[styles.dayActionBtn, { backgroundColor: colors.secondary }]}
                onPress={() => { addToSchedule(expandedDay); setExpandedDay(null); }}
              >
                <Feather name="plus-circle" size={14} color={colors.foreground} />
                <Text style={[styles.dayActionBtnText, { color: colors.foreground }]}>Add as Workout Day</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Weekly cadence stats */}
      <View style={[styles.weekStatsCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.weekStatsTitle, { color: colors.foreground }]}>
          Weekly Progress · Target {targetCadence}x/week
        </Text>
        {weekStats.map((ws, i) => (
          <View key={i} style={styles.weekStatRow}>
            <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>{ws.label}</Text>
            <View style={styles.weekStatRight}>
              <View style={[styles.weekStatBar, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.weekStatFill,
                    {
                      backgroundColor: ws.count >= targetCadence ? colors.primary : colors.primary + "60",
                      width: `${Math.min(100, (ws.count / targetCadence) * 100)}%` as any,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekStatCount, { color: ws.count >= targetCadence ? colors.primary : colors.mutedForeground }]}>
                {ws.count}/{targetCadence}
                {ws.needed > 0 ? ` · ${ws.needed} more` : " ✓"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.selectedText, { color: colors.mutedForeground }]}>
          {selectedDates.size} days selected this month
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saveScheduleBulk.isPending}
        >
          {saveScheduleBulk.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Schedule</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 24 },
  navBtn: { padding: 8 },
  monthText: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  calendarContainer: { paddingHorizontal: 12 },
  weekHeaders: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  weekDayText: { width: 40, textAlign: "center", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: 6 },
  dayCellEmpty: { width: 40, height: 40 },
  dayCell: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  dayText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  dot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 3 },

  dayPanel: {
    marginHorizontal: 12, marginTop: 12, borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 10,
  },
  dayPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayPanelDate: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dayTypeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  dayTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dayTypeBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  daySessionType: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  daySessionMeta: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  dayPanelHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 10 },
  dayActionsRow: { flexDirection: "row", gap: 8 },
  dayActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  dayActionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dayActionBtnSmall: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  dayActionBtnSmallText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  weekStatsCard: { marginHorizontal: 12, marginTop: 16, borderRadius: 16, padding: 16, gap: 10 },
  weekStatsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  weekStatRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  weekStatLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 80 },
  weekStatRight: { flex: 1, gap: 4 },
  weekStatBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  weekStatFill: { height: "100%", borderRadius: 3 },
  weekStatCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  footer: { paddingHorizontal: 20, marginTop: 20, alignItems: "center" },
  selectedText: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 16 },
  saveBtn: { width: "100%", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  saveBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
});
