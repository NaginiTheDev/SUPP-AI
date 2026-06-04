import { CoachExperience } from "@/components/protin/CoachExperience";

export const metadata = {
  title: "Þjálfarinn — protin.is",
  description: "Þinn persónulegi ráðgjafi í bætiefnum. Svaraðu nokkrum spurningum og fáðu sérsniðinn stafla beint í körfuna.",
};

export default function ProtinPage() {
  return (
    <main lang="is" className="min-h-screen bg-zinc-950 text-white">
      <CoachExperience />
    </main>
  );
}
