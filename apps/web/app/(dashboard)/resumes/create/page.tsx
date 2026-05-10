import { ResumeCreateWizard } from "@/components/resume-create-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { BillingSubscriptionSummary } from "@/components/pricing-section";

function isResumeSlotExhausted(subscription: BillingSubscriptionSummary) {
  const limit = subscription.limits.find((item) => item.feature === "resume_slot");

  if (!limit) {
    return false;
  }

  const enforcementLimit = limit.enforcementLimit ?? limit.limit;

  return enforcementLimit !== null && limit.used + limit.reserved >= enforcementLimit;
}

export default async function CreateResumePage() {
  const subscription =
    await apiFetch<BillingSubscriptionSummary>("/api/v1/billing/subscription");

  if (isResumeSlotExhausted(subscription)) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Лимит резюме исчерпан</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              На текущем тарифе больше нельзя создать новое активное резюме.
              Удалите лишнее резюме или перейдите на тариф выше.
            </p>
            <Button asChild className="w-fit bg-sky-600 text-white hover:bg-sky-700">
              <a href="/billing">Посмотреть тарифы</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <ResumeCreateWizard />;
}
