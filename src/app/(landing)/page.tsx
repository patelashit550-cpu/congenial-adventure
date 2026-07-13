import { HomeBento } from "@/components/features/HomeBento";
import { CompassWatermark } from "@/components/features/CompassWatermark";

export default function Home() {
  return (
    <div className="p3-landing-home flex flex-1 flex-col justify-start w-full pb-8 relative">
      <CompassWatermark />
      <div className="relative w-full">
        <HomeBento />
      </div>
    </div>
  );
}
