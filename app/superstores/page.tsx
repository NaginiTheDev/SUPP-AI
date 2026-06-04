import { CoachExperience } from "@/components/superstores/CoachExperience";

export const metadata = {
  title: "AI Coach — Supplement Superstores",
  description:
    "Your personal AI supplement coach. Answer a few questions and get a tailored stack loaded straight into your cart.",
};

export default function SuperstoresPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <CoachExperience />
    </main>
  );
}
