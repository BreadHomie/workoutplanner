import { useState } from "react";
import { Zap, Users, CalendarDays, History, User } from "lucide-react";
import Generate from "./pages/Generate";
import Clientele from "./pages/Clientele";
import Schedule from "./pages/Schedule";
import HistoryPage from "./pages/History";
import Profile from "./pages/Profile";
import ClientDetail from "./pages/ClientDetail";
import ExerciseHistory from "./pages/ExerciseHistory";

type Tab = "generate" | "clientele" | "schedule" | "history" | "profile";

type NavScreen =
  | { screen: "main" }
  | { screen: "client-detail"; clientId: number }
  | { screen: "exercise-history"; clientId: number };

const TABS: { id: Tab; label: string; Icon: typeof Zap }[] = [
  { id: "generate", label: "Generate", Icon: Zap },
  { id: "clientele", label: "Clientele", Icon: Users },
  { id: "schedule", label: "Schedule", Icon: CalendarDays },
  { id: "history", label: "History", Icon: History },
  { id: "profile", label: "Profile", Icon: User },
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

  const goBack = () => {
    if (nav.screen === "exercise-history") {
      const clientId = (nav as { screen: "exercise-history"; clientId: number }).clientId;
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
            {tab === "schedule" && <Schedule />}
            {tab === "history" && <HistoryPage />}
            {tab === "profile" && <Profile />}
          </>
        )}
        {nav.screen === "client-detail" && (
          <ClientDetail
            clientId={(nav as { screen: "client-detail"; clientId: number }).clientId}
            onBack={goBack}
            onViewExerciseHistory={openExerciseHistory}
          />
        )}
        {nav.screen === "exercise-history" && (
          <ExerciseHistory
            clientId={(nav as { screen: "exercise-history"; clientId: number }).clientId}
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
