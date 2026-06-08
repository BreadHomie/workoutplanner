import { useState } from "react";
import { Dumbbell, History, CalendarDays, User } from "lucide-react";
import Today from "./pages/Today";
import HistoryPage from "./pages/History";
import Schedule from "./pages/Schedule";
import Profile from "./pages/Profile";

type Tab = "today" | "history" | "schedule" | "profile";

const TABS: { id: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { id: "today", label: "Today", Icon: Dumbbell },
  { id: "history", label: "History", Icon: History },
  { id: "schedule", label: "Schedule", Icon: CalendarDays },
  { id: "profile", label: "Profile", Icon: User },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "hsl(0 0% 4%)" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "today" && <Today />}
        {tab === "history" && <HistoryPage />}
        {tab === "schedule" && <Schedule />}
        {tab === "profile" && <Profile />}
      </div>
      <nav className="tab-bar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`tab-item${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
            type="button"
          >
            <Icon size={22} strokeWidth={tab === id ? 2.5 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
