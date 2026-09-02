import { Spacing } from "@toss/tds-mobile";
import { AdSlot } from "@/components/AdSlot";

export function BannerSection({ adGroupId }: { adGroupId?: string }) {
  if (!adGroupId) return null;
  return (
    <>
      <Spacing size={16} />
      <AdSlot adGroupId={adGroupId} />
      <Spacing size={16} />
    </>
  );
}
