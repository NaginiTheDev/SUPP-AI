import { CoachExperience } from "@/components/CoachExperience";

// Demo page hosting the dedicated AI Coach experience. The pitch slides away
// and the panel expands when Coach delivers the stack.
export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <CoachExperience />
    </main>
  );
}
