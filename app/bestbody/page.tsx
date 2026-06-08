import { CoachExperience } from "@/components/bestbody/CoachExperience";

export const metadata = {
  title: "Coach — BestBody Costa Rica",
  description:
    "Tu asesor personal de suplementos. Responde unas preguntas y recibe un stack personalizado, listo para agregar al carrito.",
};

export default function BestBodyPage() {
  return (
    <main lang="es" className="min-h-screen bg-zinc-50 text-zinc-900">
      <CoachExperience />
    </main>
  );
}
