import { CoachPanel } from "@/components/CoachPanel";

// Bare, embeddable Coach panel for the iframe injected by public/embed.js.
export const metadata = {
  title: "Protein House — AI Coach",
};

export default function WidgetPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-2">
      <CoachPanel />
    </div>
  );
}
