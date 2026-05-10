import Link from "next/link";
import {
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  UserRoundIcon,
} from "lucide-react";
import {
  plateValueToPlainText,
  type ResumeBuilderContent,
  type ResumeBuilderEducation,
  type ResumeBuilderExperience,
} from "@offergo/shared";

import { ResumeActions } from "@/components/resume-builder/resume-actions";
import {
  ResumePhotoControl,
  type ResumeBuilderPhotoFile,
  type ResumeBuilderPhotoSettings,
} from "@/components/resume-builder/resume-photo-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ResumeBuilderViewProps = {
  content: ResumeBuilderContent;
  photoFile?: ResumeBuilderPhotoFile;
  photoSettings?: ResumeBuilderPhotoSettings;
  resumeId: string;
  userEmail?: string | null;
};

function compact(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

function getFullName(content: ResumeBuilderContent) {
  const { firstName, lastName, middleName } = content.wizard.basic;

  return compact([lastName, firstName, middleName]).join(" ");
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "РЗ";
}

function getPeriod(item: ResumeBuilderExperience) {
  const start = compact([item.startMonth, item.startYear]).join(" ");
  const end = item.current
    ? "по настоящее время"
    : compact([item.endMonth, item.endYear]).join(" ");

  return compact([start, end]).join(" — ");
}

function getEducationMeta(item: ResumeBuilderEducation) {
  return compact([item.graduationYear, item.level]).join(" · ");
}

const salaryCurrencyLabels: Record<string, string> = {
  RUB: "₽",
  EUR: "€",
  USD: "$",
};

const employmentTypeLabels: Record<string, string> = {
  permanent: "Постоянная работа",
  part_time: "Подработка",
  internship: "Стажировка",
  unpaid_internship: "Бесплатная стажировка",
};

const workFormatLabels: Record<string, string> = {
  onsite: "На месте работодателя",
  remote: "Удаленно",
  hybrid: "Гибрид",
};

const contractTypeLabels: Record<string, string> = {
  employment_contract: "Трудовой договор",
  self_employed: "Самозанятый",
  individual_entrepreneur: "ИП",
};

function mapLabels(values: string[], labels: Record<string, string>) {
  return values.map((value) => labels[value] ?? value).join(", ") || "Не указано";
}

function EditIconButton({
  href,
  label = "Редактировать",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Button asChild size="icon" variant="ghost">
      <Link aria-label={label} href={href}>
        <PencilIcon data-icon="inline-start" />
      </Link>
    </Button>
  );
}

function EditLink({
  href,
  children = "Редактировать",
}: {
  href: string;
  children?: string;
}) {
  return (
    <Button asChild className="w-fit gap-1.5 px-0" variant="link">
      <Link href={href}>
        <PencilIcon data-icon="inline-start" />
        {children}
      </Link>
    </Button>
  );
}

function SectionHeader({
  actionLabel = "Добавить",
  children,
  editHref,
}: {
  actionLabel?: string;
  children: string;
  editHref: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-heading text-xl font-semibold tracking-tight">
        {children}
      </h2>
      <Button asChild className="gap-1.5 px-1" variant="link">
        <Link href={editHref}>
          <PlusIcon data-icon="inline-start" />
          {actionLabel}
        </Link>
      </Button>
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  if (!text) {
    return null;
  }

  return <div className="whitespace-pre-line leading-7 text-foreground">{text}</div>;
}

function EmptyBlock({ children }: { children: string }) {
  return <p className="text-muted-foreground">{children}</p>;
}

export function ResumeBuilderView({
  content,
  photoFile = null,
  photoSettings = {
    positionX: 50,
    positionY: 50,
    scale: 1,
  },
  resumeId,
  userEmail,
}: ResumeBuilderViewProps) {
  const editHref = `/resumes/${resumeId}/edit`;
  const {
    additionalEducation,
    about,
    basic,
    contacts,
    education,
    experience,
    profession,
    salary,
    skills,
    workConditions,
  } = content.wizard;
  const fullName = getFullName(content);
  const displayName = fullName || "Имя не указано";
  const phone = basic.phone || "Телефон не указан";
  const email = userEmail || "Электронная почта не указана";
  const contactPhone = contacts.phone || phone;
  const contactEmail = contacts.email || email;
  const salaryText = salary.amount
    ? `${salary.amount} ${salaryCurrencyLabels[salary.currency] ?? salary.currency}`
    : "Уровень дохода не указан";
  const aboutText = plateValueToPlainText(about);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
        <Card className="gap-2 py-6">
          <CardHeader className="px-6">
            <div className="flex flex-col gap-2">
              <CardTitle className="max-w-3xl text-2xl font-semibold">
                {profession || "Профессия не указана"}
              </CardTitle>
              <p className="text-base">{displayName}</p>
              <p className="text-base">{salaryText}</p>
              <p className="text-base">
                <span className="text-muted-foreground">Тип занятости:</span>{" "}
                {mapLabels(workConditions.employmentTypes, employmentTypeLabels)}
              </p>
              <p className="text-base">
                <span className="text-muted-foreground">Формат работы:</span>{" "}
                {mapLabels(workConditions.workFormats, workFormatLabels)}
              </p>
              <p className="text-base">
                <span className="text-muted-foreground">Оформление:</span>{" "}
                {mapLabels(workConditions.contractTypes, contractTypeLabels)}
              </p>
              <EditLink href={editHref} />
            </div>
            <CardAction>
              <ResumePhotoControl
                initials={getInitials(fullName)}
                photoFile={photoFile}
                photoSettings={photoSettings}
                resumeId={resumeId}
              />
            </CardAction>
          </CardHeader>
        </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Контакты
        </h2>
        <Card className="py-6">
          <CardContent className="flex items-start justify-between gap-6 px-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PhoneIcon className="size-4" />
                  Мобильный телефон
                </div>
                <p className="text-base">{contactPhone}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MailIcon className="size-4" />
                  Электронная почта
                </div>
                <p className="break-all text-base">{contactEmail}</p>
              </div>
              {[
                ["Telegram", contacts.telegram],
                ["Max", contacts.max],
                ["VK", contacts.vk],
                ["WhatsApp", contacts.whatsapp],
                ["Комментарий", contacts.comment],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div className="flex flex-col gap-1" key={label}>
                    <div className="text-muted-foreground">{label}</div>
                    <p className="break-all text-base">{value}</p>
                  </div>
                ))}
            </div>
            <EditIconButton href={editHref} label="Редактировать контакты" />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader editHref={editHref}>Опыт работы</SectionHeader>
        <Card className="py-6">
          <CardContent className="flex flex-col gap-6 px-6">
            {experience.length > 0 ? (
              experience.map((item, index) => {
                const description = plateValueToPlainText(item.description);
                const period = getPeriod(item);

                return (
                  <div className="flex flex-col gap-4" key={item.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex gap-4">
                      <div className="mt-2 flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                        <UserRoundIcon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-base font-medium">
                              {item.company || "Компания не указана"}
                            </p>
                            {period ? (
                              <p className="text-sm text-muted-foreground">
                                {period}
                              </p>
                            ) : null}
                          </div>
                          <EditIconButton
                            href={editHref}
                            label="Редактировать опыт"
                          />
                        </div>
                        <div>
                          <p className="text-base font-medium">
                            {item.position || "Должность не указана"}
                          </p>
                          <TextBlock text={description} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyBlock>Опыт работы не указан.</EmptyBlock>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Навыки
        </h2>
        <Card className="py-6">
          <CardContent className="flex flex-col gap-4 px-6">
            {skills.length > 0 ? (
              <>
                <p className="text-muted-foreground">Уровень не указан</p>
                <div className="flex flex-wrap gap-2.5">
                  {skills.map((skill) => (
                    <Badge
                      className="px-3 py-1.5 text-sm font-medium"
                      key={skill}
                      variant="secondary"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <EmptyBlock>Навыки не указаны.</EmptyBlock>
            )}
            <EditLink href={editHref} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader editHref={editHref}>Образование</SectionHeader>
        <Card className="py-6">
          <CardContent className="flex flex-col gap-6 px-6">
            {education.length > 0 ? (
              education.map((item, index) => {
                const activities = plateValueToPlainText(item.activities);
                const meta = getEducationMeta(item);

                return (
                  <div className="flex flex-col gap-3" key={item.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-base font-medium">
                          {item.institution || "Учебное заведение не указано"}
                        </p>
                        {item.faculty || item.specialization ? (
                          <p className="text-muted-foreground">
                            {compact([item.faculty, item.specialization]).join(
                              ", ",
                            )}
                          </p>
                        ) : null}
                        {meta ? (
                          <p className="text-muted-foreground">{meta}</p>
                        ) : null}
                      </div>
                      <EditIconButton
                        href={editHref}
                        label="Редактировать образование"
                      />
                    </div>
                    <TextBlock text={activities} />
                  </div>
                );
              })
            ) : (
              <EmptyBlock>Образование не указано.</EmptyBlock>
            )}
          </CardContent>
        </Card>
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeader editHref={editHref}>Дополнительное образование</SectionHeader>
        <Card className="py-6">
          <CardContent className="flex flex-col gap-6 px-6">
            {additionalEducation.length > 0 ? (
              additionalEducation.map((item, index) => {
                const activities = plateValueToPlainText(item.activities);
                const meta = getEducationMeta(item);

                return (
                  <div className="flex flex-col gap-3" key={item.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-base font-medium">
                          {item.institution || "Учебное заведение не указано"}
                        </p>
                        {item.faculty || item.specialization ? (
                          <p className="text-muted-foreground">
                            {compact([item.faculty, item.specialization]).join(
                              ", ",
                            )}
                          </p>
                        ) : null}
                        {meta ? (
                          <p className="text-muted-foreground">{meta}</p>
                        ) : null}
                      </div>
                      <EditIconButton
                        href={editHref}
                        label="Редактировать дополнительное образование"
                      />
                    </div>
                    <TextBlock text={activities} />
                  </div>
                );
              })
            ) : (
              <EmptyBlock>Дополнительное образование не указано.</EmptyBlock>
            )}
          </CardContent>
        </Card>
      </section>

      {aboutText ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            О себе
          </h2>
          <Card className="py-6">
            <CardContent className="flex items-start justify-between gap-6 px-6">
              <TextBlock text={aboutText} />
              <EditIconButton href={editHref} label="Редактировать о себе" />
            </CardContent>
          </Card>
        </section>
      ) : null}
        </div>
        <aside className="order-first lg:sticky lg:top-24 lg:order-none">
          <ResumeActions resumeId={resumeId} />
        </aside>
      </div>
    </main>
  );
}
