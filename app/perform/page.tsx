import { CoachExperience } from "@/components/perform/CoachExperience";

export const metadata = {
  title: "Þjálfarinn — perform.is",
  description: "Þinn persónulegi ráðgjafi í bætiefnum. Svaraðu nokkrum spurningum og fáðu sérsniðinn stafla.",
};

// AI supplement advisor for perform.is, in Icelandic. Lives at /perform.
export default function PerformPage() {
  return (
    <main lang="is" className="min-h-screen bg-zinc-950 text-white">
      <CoachExperience />
    </main>
  );
}
