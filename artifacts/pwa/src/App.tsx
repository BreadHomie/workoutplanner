import { useState } from "react";
import { Zap, Users, Dumbbell, CalendarDays, Settings } from "lucide-react";
import Generate from "./pages/Generate";
import Clientele from "./pages/Clientele";
import WorkoutTab from "./pages/Workout";
import Schedule from "./pages/Schedule";
import Profile from "./pages/Profile";
import ClientDetail from "./pages/ClientDetail";
import ExerciseHistory from "./pages/ExerciseHistory";
import WorkoutDetail from "./pages/WorkoutDetail";

type Tab = "generate" | "clientele" | "workout" | "schedule" | "profile";

type NavScreen =
  | { screen: "main" }
  | { screen: "client-detail"; clientId: number }
  | { screen: "exercise-history"; clientId: number }
  | { screen: "workout-detail"; sessionId: number };

const TABS: { id: Tab; label: string; Icon: typeof Zap }[] = [
  { id: "generate", label: "Generate", Icon: Zap },
  { id: "clientele", label: "Clientele", Icon: Users },
  { id: "workout", label: "Workout", Icon: Dumbbell },
  { id: "schedule", label: "Schedule", Icon: CalendarDays },
  { id: "profile", label: "Settings", Icon: Settings },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("generate");
  const [nav, setNav] = useState<NavScreen>({ screen: "main" });

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setNav({ screen: "main" });
  };

  const openClientDetail = (clientId: number) => {
    setNav({ screen: "client-detail", clientId });
    setTab("clientele");
  };

  const openExerciseHistory = (clientId: number) => {
    setNav({ screen: "exercise-history", clientId });
  };

  const openWorkoutDetail = (sessionId: number) => {
    setNav({ screen: "workout-detail", sessionId });
  };

  const goBack = () => {
    if (nav.screen === "exercise-history") {
      const clientId = (nav as any).clientId;
      setNav({ screen: "client-detail", clientId });
    } else {
      setNav({ screen: "main" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "hsl(0 0% 4%)" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {nav.screen === "main" && (
          <>
            {tab === "generate" && <Generate />}
            {tab === "clientele" && <Clientele onOpenClient={openClientDetail} />}
            {tab === "workout" && <WorkoutTab onOpenWorkout={openWorkoutDetail} />}
            {tab === "schedule" && <Schedule onOpenWorkout={openWorkoutDetail} />}
            {tab === "profile" && <Profile />}
          </>
        )}
        {nav.screen === "client-detail" && (
          <ClientDetail
            clientId={(nav as any).clientId}
            onBack={goBack}
            onViewExerciseHistory={openExerciseHistory}
          />
        )}
        {nav.screen === "exercise-history" && (
          <ExerciseHistory
            clientId={(nav as any).clientId}
            onBack={goBack}
          />
        )}
        {nav.screen === "workout-detail" && (
          <WorkoutDetail
            sessionId={(nav as any).sessionId}
            onBack={goBack}
          />
        )}
      </div>

      {nav.screen === "main" && (
        <nav className="tab-bar">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`tab-item${tab === id ? " active" : ""}`}
              onClick={() => handleTabChange(id)}
              type="button"
            >
              <Icon size={22} strokeWidth={tab === id ? 2.5 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
