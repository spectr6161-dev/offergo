import { PageFrame } from "@offergo/ui";
import { FoundationPlaceholder } from "@/components/foundation-placeholder";

export default function BillingPage() {
  return (
    <PageFrame title="Billing" description="Placeholder route for plans, payment history, and active entitlements.">
      <FoundationPlaceholder
        title="Billing module"
        summary="Platega adapter, payment statuses, and entitlement models are present. Manual-renewal UI is still intentionally deferred."
        next={["Plan selection UI", "Payment history list", "Webhook-driven entitlement sync display"]}
      />
    </PageFrame>
  );
}
