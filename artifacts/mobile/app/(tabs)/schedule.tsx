import { useGetSchedule, useSaveScheduleBulk, useListSessions, useGetProfile } from "@workspace/api-client-react";
import {
  format, startOfMonth, getDaysInMonth, getDay,
  addMonths, subMonths, startOfWeek, addDays, parseISO,
} from "date-fns";
import React, { useState, useEffect } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

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

  const handleDayTap = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
    setExpandedDay(prev => (prev === dateStr ? null : dateStr));
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

  const getSessionForDate = (dateStr: string) => sessions?.find((s: any) => s.scheduledDate === dateStr);

  const targetCadence = profile?.targetCadence ?? 3;

  // Weekly cadence stats (week starts Monday)
  const weekStats = (() => {
    const stats: { label: string; completed: number; planned: number }[] = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    let weekCursor = startOfWeek(monthStart, { weekStartsOn: 1 });

    while (weekCursor <= monthEnd) {
      let planned = 0;
      let completed = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekCursor, i);
        if (d.getMonth() === currentMonth.getMonth()) {
          const dateStr = format(d, "yyyy-MM-dd");
          if (selectedDates.has(dateStr)) planned++;
          const sess = sessions?.find((s: any) => s.scheduledDate === dateStr);
          if (sess?.isCompleted) completed++;
        }
      }
      stats.push({ label: `Wk of ${format(weekCursor, "MMM d")}`, completed, planned });
      weekCursor = addDays(weekCursor, 7);
    }
    return stats;
  })();

  // Calendar grid — weeks start Monday
  const calendarDays = (() => {
    const monthStart = startOfMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    // Monday=0 offset: (getDay + 6) % 7
    const startOffset = (getDay(monthStart) + 6) % 7;
    const days: (Date | null)[] = Array(startOffset).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  })();

  if (isScheduleLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weekDayHeaders = ["M", "T", "W", "T", "F", "S", "S"];
  const expandedSession = expandedDay ? getSessionForDate(expandedDay) : null;
  const expandedIsSelected = expandedDay ? selectedDates.has(expandedDay) : false;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 100 }}>
      <Text style={[styles.header, { color: colors.foreground, paddingHorizontal: 20 }]}>Schedule</Text>

      {/* Month Nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => { setCurrentMonth(prev => subMonths(prev, 1)); setExpandedDay(null); }} style={styles.navBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.foreground }]}>{format(currentMonth, "MMMM yyyy")}</Text>
        <TouchableOpacity onPress={() => { setCurrentMonth(prev => addMonths(prev, 1)); setExpandedDay(null); }} style={styles.navBtn}>
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
            const isSelected = selectedDates.has(dateStr);
            const sess = getSessionForDate(dateStr);
            const hasSession = !!sess;
            const isCompleted = sess?.isCompleted ?? false;
            const isToday = dateStr === todayStr;
            const isExpanded = expandedDay === dateStr;

            let bgColor = colors.card;
            if (isCompleted) bgColor = colors.primary;
            else if (hasSession) bgColor = colors.primary + "70";
            else if (isSelected) bgColor = colors.secondary;

            const textColor = isCompleted || hasSession ? colors.primaryForeground : colors.foreground;

            return (
              <TouchableOpacity
                key={i}
                onPress={() => handleDayTap(dateStr)}
                style={[
                  styles.dayCell,
                  { backgroundColor: bgColor },
                  isToday && !isSelected && !hasSession && { borderColor: colors.primary, borderWidth: 1.5 },
                  isExpanded && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Text style={[styles.dayText, { color: textColor }]}>{format(date, "d")}</Text>
                {isCompleted && (
                  <View style={[styles.dot, { backgroundColor: colors.primaryForeground + "cc" }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary + "70" }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Workout</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Scheduled</Text>
        </View>
      </View>

      {/* Expanded day panel */}
      {expandedDay && (
        <View style={[styles.dayPanel, { backgroundColor: colors.card, borderColor: expandedIsSelected ? colors.primary + "50" : colors.border }]}>
          <View style={styles.dayPanelHeader}>
            <Text style={[styles.dayPanelDate, { color: colors.foreground }]}>
              {format(parseISO(expandedDay), "EEEE, MMMM d")}
            </Text>
            <TouchableOpacity onPress={() => setExpandedDay(null)}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayBadgeRow}>
            {expandedIsSelected ? (
              <View style={[styles.dayBadge, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="calendar" size={12} color={colors.primary} />
                <Text style={[styles.dayBadgeText, { color: colors.primary }]}>Workout Day</Text>
              </View>
            ) : (
              <View style={[styles.dayBadge, { backgroundColor: colors.muted }]}>
                <Feather name="moon" size={12} color={colors.mutedForeground} />
                <Text style={[styles.dayBadgeText, { color: colors.mutedForeground }]}>Rest Day</Text>
              </View>
            )}
            {expandedSession?.isCompleted && (
              <View style={[styles.dayBadge, { backgroundColor: "#22c55e20" }]}>
                <Feather name="check-circle" size={12} color="#22c55e" />
                <Text style={[styles.dayBadgeText, { color: "#22c55e" }]}>Completed</Text>
              </View>
            )}
          </View>

          {expandedSession ? (
            <View style={{ gap: 6 }}>
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
                <Feather name="layers" size={14} color={colors.primaryForeground} />
                <Text style={[styles.dayActionBtnText, { color: colors.primaryForeground }]}>Open in My Workouts</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.dayPanelHint, { color: colors.mutedForeground }]}>
              {expandedIsSelected
                ? "Tap again to remove this day from your schedule."
                : "Tap this day to add it to your workout schedule."}
            </Text>
          )}
        </View>
      )}

      {/* Save button — ABOVE weekly progress */}
      <View style={[styles.saveSection, { borderColor: colors.border }]}>
        <Text style={[styles.selectedText, { color: colors.mutedForeground }]}>
          {selectedDates.size} {selectedDates.size === 1 ? "day" : "days"} selected this month
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

      {/* Weekly cadence stats */}
      <View style={[styles.weekStatsCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.weekStatsTitle, { color: colors.foreground }]}>
          Weekly Progress · {targetCadence}x / week target
        </Text>
        {weekStats.map((ws, i) => {
          const maxValue = Math.max(targetCadence, ws.planned, ws.completed);
          return (
            <View key={i} style={styles.weekStatRow}>
              <Text style={[styles.weekStatLabel, { color: colors.mutedForeground }]}>{ws.label}</Text>
              <View style={styles.weekStatRight}>
                {/* Planned bar */}
                <View style={styles.weekStatBarRow}>
                  <Text style={[styles.weekStatBarLabel, { color: colors.mutedForeground }]}>Planned</Text>
                  <View style={[styles.weekStatBar, { backgroundColor: colors.muted }]}>
                    <View style={[styles.weekStatFill, {
                      backgroundColor: ws.planned >= targetCadence ? colors.primary : colors.primary + "50",
                      width: `${Math.min(100, (ws.planned / Math.max(1, maxValue)) * 100)}%` as any,
                    }]} />
                  </View>
                  <Text style={[styles.weekStatCount, { color: colors.mutedForeground }]}>{ws.planned}</Text>
                </View>
                {/* Completed bar */}
                <View style={styles.weekStatBarRow}>
                  <Text style={[styles.weekStatBarLabel, { color: "#22c55e" }]}>Done</Text>
                  <View style={[styles.weekStatBar, { backgroundColor: colors.muted }]}>
                    <View style={[styles.weekStatFill, {
                      backgroundColor: ws.completed >= targetCadence ? "#22c55e" : "#22c55e80",
                      width: `${Math.min(100, (ws.completed / Math.max(1, maxValue)) * 100)}%` as any,
                    }]} />
                  </View>
                  <Text style={[styles.weekStatCount, { color: ws.completed >= targetCadence ? "#22c55e" : colors.mutedForeground }]}>
                    {ws.completed}{ws.completed >= targetCadence ? " ✓" : ""}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  navBtn: { padding: 8 },
  monthText: { fontSize: 20, fontFamily: "Inter_600SemiBold" },

  calendarContainer: { paddingHorizontal: 12 },
  weekHeaders: { flexDirection: "row", justifyContent: "space-around", marginBottom: 10 },
  weekDayText: { width: 38, textAlign: "center", fontSize: 12, fontFamily: "Inter_700Bold" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 6 },
  dayCellEmpty: { width: 38, height: 38 },
  dayCell: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  dayText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 3 },

  legend: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  dayPanel: {
    marginHorizontal: 12, marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10,
  },
  dayPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayPanelDate: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dayBadgeRow: { flexDirection: "row", gap: 8 },
  dayBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dayBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  daySessionType: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  daySessionMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  dayPanelHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  dayActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 2 },
  dayActionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  saveSection: { paddingHorizontal: 20, marginTop: 16, marginBottom: 4, gap: 12 },
  selectedText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  saveBtn: { height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_700Bold" },

  weekStatsCard: { marginHorizontal: 12, marginTop: 12, borderRadius: 16, padding: 16, gap: 12 },
  weekStatsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  weekStatRow: { gap: 4 },
  weekStatLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  weekStatRight: { gap: 4 },
  weekStatBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekStatBarLabel: { fontSize: 11, fontFamily: "Inter_500Medium", width: 44 },
  weekStatBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  weekStatFill: { height: "100%", borderRadius: 3 },
  weekStatCount: { fontSize: 11, fontFamily: "Inter_600SemiBold", width: 32, textAlign: "right" },
});
