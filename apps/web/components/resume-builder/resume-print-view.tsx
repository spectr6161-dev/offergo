import type {
  ResumeBuilderContent,
  ResumeBuilderEducation,
  ResumeBuilderExperience,
} from "@offergo/shared";
import { plateValueToPlainText } from "@offergo/shared";

import type {
  ResumeBuilderPhotoFile,
  ResumeBuilderPhotoSettings,
} from "@/components/resume-builder/resume-photo-control";

type ResumePrintViewProps = {
  content: ResumeBuilderContent;
  photoFile: ResumeBuilderPhotoFile;
  photoSettings: ResumeBuilderPhotoSettings;
  resumeId: string;
  userEmail?: string | null;
};

function compact(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

function fullName(content: ResumeBuilderContent) {
  const { firstName, lastName, middleName } = content.wizard.basic;

  return compact([lastName, firstName, middleName]).join(" ") || "Без имени";
}

function period(item: ResumeBuilderExperience) {
  const start = compact([item.startMonth, item.startYear]).join(" ");
  const end = item.current
    ? "по настоящее время"
    : compact([item.endMonth, item.endYear]).join(" ");

  return compact([start, end]).join(" — ");
}

function educationPeriod(item: ResumeBuilderEducation) {
  return compact([item.graduationYear, item.level]).join(" · ");
}

const salaryCurrencyLabels: Record<string, string> = {
  EUR: "€",
  RUB: "₽",
  USD: "$",
};

const employmentTypeLabels: Record<string, string> = {
  internship: "Стажировка",
  part_time: "Подработка",
  permanent: "Постоянная работа",
  unpaid_internship: "Бесплатная стажировка",
};

const workFormatLabels: Record<string, string> = {
  hybrid: "Гибрид",
  onsite: "На месте работодателя",
  remote: "Удалённо",
};

const contractTypeLabels: Record<string, string> = {
  employment_contract: "Трудовой договор",
  individual_entrepreneur: "ИП",
  self_employed: "Самозанятый",
};

function mapLabels(values: string[], labels: Record<string, string>) {
  return values.map((value) => labels[value] ?? value).join(", ");
}

function photoStyle(settings: ResumeBuilderPhotoSettings) {
  const x = Math.min(100, Math.max(0, settings.positionX ?? 50));
  const y = Math.min(100, Math.max(0, settings.positionY ?? 50));
  const scale = Math.min(3, Math.max(1, settings.scale ?? 1));
  const origin = `${x}% ${y}%`;

  return {
    objectPosition: origin,
    transform: `scale(${scale})`,
    transformOrigin: origin,
  };
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="break-inside-avoid border-t border-neutral-200 pt-6">
      <h2 className="mb-4 text-[22px] font-semibold leading-tight">{title}</h2>
      {children}
    </section>
  );
}

function DefinitionList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="flex flex-col gap-2 text-[15px] leading-6">
      {items.map(([label, value]) => (
        <p key={label}>
          <span className="text-neutral-500">{label}: </span>
          <span>{value || "Не указано"}</span>
        </p>
      ))}
    </div>
  );
}

function presentDefinitionItems(
  items: Array<[string, string | null | undefined]>,
) {
  return items.filter(
    (item): item is [string, string] => Boolean(item[1]?.trim()),
  );
}

function TimelineItem({
  children,
  side,
}: {
  children: React.ReactNode;
  side: string;
}) {
  return (
    <div className="grid break-inside-avoid grid-cols-[150px_1fr] gap-8 py-3">
      <div className="text-[14px] leading-6 text-neutral-500">{side}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ExperienceBlock({ items }: { items: ResumeBuilderExperience[] }) {
  if (!items.length) {
    return <p className="text-neutral-500">Опыт работы не указан.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      {items.map((item) => {
        const description = plateValueToPlainText(item.description);

        return (
          <TimelineItem key={item.id} side={period(item) || "Период не указан"}>
            <div className="flex flex-col gap-2">
              {item.company ? (
                <p className="text-[17px] font-semibold leading-6">
                  {item.company}
                </p>
              ) : null}
              {item.position ? (
                <p className="text-[16px] font-semibold leading-6">
                  {item.position}
                </p>
              ) : null}
              {description ? (
                <p className="whitespace-pre-line text-[15px] leading-7">
                  {description}
                </p>
              ) : null}
            </div>
          </TimelineItem>
        );
      })}
    </div>
  );
}

function EducationBlock({
  emptyText,
  items,
}: {
  emptyText: string;
  items: ResumeBuilderEducation[];
}) {
  if (!items.length) {
    return <p className="text-neutral-500">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      {items.map((item) => {
        const details = compact([item.faculty, item.specialization]).join(", ");
        const activities = plateValueToPlainText(item.activities);

        return (
          <TimelineItem
            key={item.id}
            side={educationPeriod(item) || "Период не указан"}
          >
            <div className="flex flex-col gap-2">
              {item.institution ? (
                <p className="text-[17px] font-semibold leading-6">
                  {item.institution}
                </p>
              ) : null}
              {details ? (
                <p className="text-[15px] leading-6 text-neutral-700">
                  {details}
                </p>
              ) : null}
              {activities ? (
                <p className="whitespace-pre-line text-[15px] leading-7">
                  {activities}
                </p>
              ) : null}
            </div>
          </TimelineItem>
        );
      })}
    </div>
  );
}

export function ResumePrintView({
  content,
  photoFile,
  photoSettings,
  resumeId,
  userEmail,
}: ResumePrintViewProps) {
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
  const name = fullName(content);
  const contactEmail = contacts.email || userEmail || "";
  const phone = contacts.phone || basic.phone;
  const birthDate = compact([
    basic.birthDay,
    basic.birthMonth,
    basic.birthYear,
  ]).join(" ");
  const salaryLine = salary.amount
    ? `${salary.amount} ${salaryCurrencyLabels[salary.currency] ?? salary.currency}`
    : "Уровень дохода не указан";
  const employmentLine = mapLabels(
    workConditions.employmentTypes,
    employmentTypeLabels,
  );
  const formatLine = mapLabels(workConditions.workFormats, workFormatLabels);
  const contractLine = mapLabels(
    workConditions.contractTypes,
    contractTypeLabels,
  );
  const aboutText = plateValueToPlainText(about);
  const photoUrl = photoFile
    ? `/api/resumes/${resumeId}/builder/photo?v=${encodeURIComponent(photoFile.id)}`
    : "";

  return (
    <article className="resume-print-sheet mx-auto flex max-w-[900px] flex-col gap-8 bg-white px-14 py-12 text-neutral-950 shadow-sm print:max-w-none print:gap-6 print:p-0 print:shadow-none">
      <style>{`
        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .resume-print-page {
            background: #ffffff !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <header className="grid break-inside-avoid grid-cols-[1fr_auto] gap-8">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-[30px] font-bold leading-tight">
            {profession || "Желаемая должность не указана"}
          </h1>
          <p className="text-[22px] font-semibold leading-tight">{name}</p>
          <div className="flex flex-col gap-1 text-[15px] leading-6">
            {basic.city ? <p>{basic.city}</p> : null}
            {birthDate ? (
              <p>
                <span className="text-neutral-500">Дата рождения: </span>
                {birthDate}
              </p>
            ) : null}
          </div>
        </div>
        {photoUrl ? (
          <div className="size-32 overflow-hidden rounded-2xl bg-neutral-100">
            <img
              alt="Фото резюме"
              className="size-full object-cover"
              src={photoUrl}
              style={photoStyle(photoSettings)}
            />
          </div>
        ) : null}
      </header>

      <Section title="Контакты">
        <DefinitionList
          items={presentDefinitionItems([
            ["Мобильный телефон", phone],
            ["Электронная почта", contactEmail],
            ["Telegram", contacts.telegram],
            ["Max", contacts.max],
            ["VK", contacts.vk],
            ["WhatsApp", contacts.whatsapp],
            ["Комментарий", contacts.comment],
          ])}
        />
      </Section>

      <Section title="Желаемая должность и условия">
        <DefinitionList
          items={[
            ["Желаемая зарплата", salaryLine],
            ["Тип занятости", employmentLine],
            ["Формат работы", formatLine],
            ["Оформление", contractLine],
          ]}
        />
      </Section>

      <Section title="Опыт работы">
        <ExperienceBlock items={experience} />
      </Section>

      {skills.length ? (
        <Section title="Навыки">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                className="rounded-md bg-neutral-100 px-2.5 py-1 text-[14px] leading-5"
                key={skill}
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {aboutText ? (
        <Section title="О себе">
          <p className="whitespace-pre-line text-[15px] leading-7">
            {aboutText}
          </p>
        </Section>
      ) : null}

      <Section title="Образование">
        <EducationBlock
          emptyText="Образование не указано."
          items={education}
        />
      </Section>

      {additionalEducation.length ? (
        <Section title="Дополнительное образование">
          <EducationBlock
            emptyText="Дополнительное образование не указано."
            items={additionalEducation}
          />
        </Section>
      ) : null}

      <Section title="Гражданство и разрешение на работу">
        <DefinitionList
          items={[
            ["Гражданство", basic.citizenship],
            ["Разрешение на работу", basic.workPermit],
          ]}
        />
      </Section>
    </article>
  );
}
