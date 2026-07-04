import { HomeBento } from "@/components/features/HomeBento";
import { CompassWatermark } from "@/components/features/CompassWatermark";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col justify-center w-full pb-8 relative">
      <CompassWatermark />
      <div className="relative w-full" style={{ zIndex: 1 }}>
        <HomeBento />
      </div>
    </div>
  );
}
