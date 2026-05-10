"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  createEmptyBuilderBasic,
  createEmptyBuilderContacts,
  createEmptyBuilderSalary,
  createEmptyBuilderWorkConditions,
  createEmptyPlateValue,
  createEmptyResumeBuilderContent,
  isResumeBuilderContent,
  normalizeResumeBuilderContent,
  type ResumeBuilderAppearance,
  type ResumeBuilderBasic,
  type ResumeBuilderContacts,
  type ResumeBuilderContent,
  type ResumeBuilderSalary,
  type ResumeBuilderWorkConditions,
} from "@/components/resume-builder/builder-data";
import { cn } from "@/lib/utils";

import { AboutStep } from "./resume-create-wizard/about-step";
import { BasicInfoStep } from "./resume-create-wizard/basic-info-step";
import { ContactsStep } from "./resume-create-wizard/contacts-step";
import { EducationStep } from "./resume-create-wizard/education-step";
import { ExperienceStep } from "./resume-create-wizard/experience-step";
import { IntentStep } from "./resume-create-wizard/intent-step";
import { ProfessionStep } from "./resume-create-wizard/profession-step";
import { SalaryStep } from "./resume-create-wizard/salary-step";
import {
  emptyValidationErrors,
  hasValidationErrors,
  stepOrder,
  validateBasicInfo,
  validateContacts,
  validateProfession,
  validateSalary,
  type BuilderResponse,
  type EducationDraft,
  type ExperienceDraft,
  type WizardStep,
  type WizardValidationErrors,
} from "./resume-create-wizard/shared";
import { SkillsStep } from "./resume-create-wizard/skills-step";
import { WizardProgress } from "./resume-create-wizard/wizard-progress";
import { WorkConditionsStep } from "./resume-create-wizard/work-conditions-step";

export function ResumeCreateWizard({ resumeId: initialResumeId }: { resumeId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("intent");
  const [resumeId, setResumeId] = useState(initialResumeId ?? "");
  const [profession, setProfession] = useState("");
  const [basic, setBasic] = useState<ResumeBuilderBasic>(createEmptyBuilderBasic());
  const [contacts, setContacts] = useState<ResumeBuilderContacts>(
    createEmptyBuilderContacts(),
  );
  const [salary, setSalary] = useState<ResumeBuilderSalary>(
    createEmptyBuilderSalary(),
  );
  const [workConditions, setWorkConditions] =
    useState<ResumeBuilderWorkConditions>(createEmptyBuilderWorkConditions());
  const [education, setEducation] = useState<EducationDraft[]>([]);
  const [additionalEducation, setAdditionalEducation] = useState<EducationDraft[]>(
    [],
  );
  const [skillSearch, setSkillSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [about, setAbout] = useState<ResumeBuilderContent["wizard"]["about"]>(
    createEmptyPlateValue(),
  );
  const [appearance, setAppearance] = useState<ResumeBuilderAppearance>(
    createEmptyResumeBuilderContent().appearance,
  );
  const [exportState, setExportState] = useState<ResumeBuilderContent["export"]>(
    createEmptyResumeBuilderContent().export,
  );
  const [isBooting, setIsBooting] = useState(true);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [validationErrors, setValidationErrors] =
    useState<WizardValidationErrors>(emptyValidationErrors);
  const lastSavedPayloadRef = useRef("");

  const showActions = step !== "intent";
  const currentStepIndex = stepOrder.indexOf(step);
  const wideStep =
    step === "workConditions" ||
    step === "education" ||
    step === "skills" ||
    step === "experience" ||
    step === "about";
  const builderContent = useMemo<ResumeBuilderContent>(
    () => ({
      kind: "builder_resume",
      schemaVersion: 1,
      wizard: {
        currentStep: step,
        profession,
        basic,
        contacts,
        salary,
        workConditions,
        education,
        additionalEducation,
        skills: selectedSkills,
        experience: experiences,
        about,
      },
      appearance,
      export: exportState,
    }),
    [
      about,
      additionalEducation,
      appearance,
      basic,
      contacts,
      education,
      experiences,
      exportState,
      profession,
      salary,
      selectedSkills,
      step,
      workConditions,
    ],
  );

  function hydrateContent(content: ResumeBuilderContent) {
    const normalized = normalizeResumeBuilderContent(content);

    setStep(normalized.wizard.currentStep);
    setProfession(normalized.wizard.profession);
    setBasic({ ...createEmptyBuilderBasic(), ...normalized.wizard.basic });
    setContacts({ ...createEmptyBuilderContacts(), ...normalized.wizard.contacts });
    setSalary({ ...createEmptyBuilderSalary(), ...normalized.wizard.salary });
    setWorkConditions({
      ...createEmptyBuilderWorkConditions(),
      ...normalized.wizard.workConditions,
    });
    setEducation(normalized.wizard.education);
    setAdditionalEducation(normalized.wizard.additionalEducation);
    setSelectedSkills(normalized.wizard.skills);
    setExperiences(normalized.wizard.experience);
    setAbout(normalized.wizard.about);
    setAppearance(normalized.appearance);
    setExportState(normalized.export);
    setValidationErrors(emptyValidationErrors);
  }

  function updateBasic(next: ResumeBuilderBasic) {
    setBasic(next);

    if (hasValidationErrors(validationErrors.basic)) {
      setValidationErrors((current) => ({
        ...current,
        basic: validateBasicInfo(next),
      }));
    }
  }

  function updateContacts(next: ResumeBuilderContacts) {
    setContacts(next);

    if (hasValidationErrors(validationErrors.contacts)) {
      setValidationErrors((current) => ({
        ...current,
        contacts: validateContacts(next),
      }));
    }
  }

  function updateSalary(next: ResumeBuilderSalary) {
    setSalary(next);

    if (validationErrors.salary) {
      setValidationErrors((current) => ({
        ...current,
        salary: validateSalary(next),
      }));
    }
  }

  function updateProfession(next: string) {
    setProfession(next);

    if (validationErrors.profession) {
      setValidationErrors((current) => ({
        ...current,
        profession: validateProfession(next),
      }));
    }
  }

  async function saveContent(content: ResumeBuilderContent) {
    if (!resumeId) {
      return;
    }

    const serialized = JSON.stringify(content);

    if (serialized === lastSavedPayloadRef.current) {
      setSaveError(false);
      return;
    }

    try {
      const response = await fetch(`/api/resumes/${resumeId}/builder`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Не удалось сохранить резюме.");
      }

      const body = (await response.json()) as BuilderResponse;

      if (isResumeBuilderContent(body.content)) {
        lastSavedPayloadRef.current = JSON.stringify(body.content);
        setExportState(body.content.export);
      } else {
        lastSavedPayloadRef.current = serialized;
      }

      setSaveError(false);
    } catch (error) {
      setSaveError(true);
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить резюме.",
      );
      throw error;
    }
  }

  async function flushSave(content: ResumeBuilderContent = builderContent) {
    await saveContent(content);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setIsBooting(true);

      try {
        const response = await fetch(
          initialResumeId
            ? `/api/resumes/${initialResumeId}/builder`
            : "/api/resumes/builder-drafts",
          {
            method: initialResumeId ? "GET" : "POST",
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Не удалось открыть черновик резюме.");
        }

        const body = (await response.json()) as BuilderResponse;

        if (cancelled) {
          return;
        }

        if (!isResumeBuilderContent(body.content)) {
          throw new Error("Сервер вернул некорректный черновик резюме.");
        }

        setResumeId(body.item.id);
        hydrateContent(body.content);
        lastSavedPayloadRef.current = JSON.stringify(body.content);
        setSaveError(false);
      } catch (error) {
        if (!cancelled) {
          setSaveError(true);
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось открыть черновик резюме.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [initialResumeId]);

  async function goBack() {
    if (isSavingStep) {
      return;
    }

    const previous =
      step === "basic" && !profession
        ? "intent"
        : stepOrder[Math.max(0, currentStepIndex - 1)];
    const content: ResumeBuilderContent = {
      ...builderContent,
      wizard: {
        ...builderContent.wizard,
        currentStep: previous,
      },
    };

    setIsSavingStep(true);

    try {
      await flushSave(content);
      setStep(previous);
    } catch {
      // saveContent already shows the toast; keep the user on the current step.
    } finally {
      setIsSavingStep(false);
    }
  }

  async function goNext() {
    if (!resumeId || isSavingStep) {
      return;
    }

    if (step === "profession") {
      const professionError = validateProfession(profession);

      if (professionError) {
        setValidationErrors((current) => ({
          ...current,
          profession: professionError,
        }));
        return;
      }
    }

    if (step === "basic") {
      const basicErrors = validateBasicInfo(basic);

      if (hasValidationErrors(basicErrors)) {
        setValidationErrors((current) => ({
          ...current,
          basic: basicErrors,
        }));
        return;
      }
    }

    if (step === "contacts") {
      const contactErrors = validateContacts(contacts);

      if (hasValidationErrors(contactErrors)) {
        setValidationErrors((current) => ({
          ...current,
          contacts: contactErrors,
        }));
        return;
      }
    }

    if (step === "salary") {
      const salaryError = validateSalary(salary);

      if (salaryError) {
        setValidationErrors((current) => ({
          ...current,
          salary: salaryError,
        }));
        return;
      }
    }

    setIsSavingStep(true);

    if (step === "about") {
      const content: ResumeBuilderContent = {
        ...builderContent,
        wizard: {
          ...builderContent.wizard,
          currentStep: "about",
        },
      };

      try {
        await flushSave(content);
        const response = await fetch(`/api/resumes/${resumeId}/builder`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Не удалось сохранить резюме.");
        }

        toast.success("Резюме сохранено.");
        router.push(`/resumes/${resumeId}`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось сохранить резюме.",
        );
      } finally {
        setIsSavingStep(false);
      }
      return;
    }

    const next = stepOrder[Math.min(stepOrder.length - 1, currentStepIndex + 1)];
    const content: ResumeBuilderContent = {
      ...builderContent,
      wizard: {
        ...builderContent.wizard,
        currentStep: next,
      },
    };

    try {
      await flushSave(content);
      setStep(next);
    } catch {
      // saveContent already shows the toast; keep the user on the current step.
    } finally {
      setIsSavingStep(false);
    }
  }

  if (isBooting) {
    return (
      <div className="flex min-h-[calc(100svh-var(--shell-header-height))] items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
          Загружаем черновик резюме...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-var(--shell-header-height))] flex-col bg-background [--hh-blue:#1478f2]">
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-4 pt-10 pb-10 sm:pt-12",
          wideStep ? "max-w-[860px]" : "max-w-[620px]",
        )}
      >
        {step === "intent" ? (
          <IntentStep
            onSelectProfession={() => setStep("profession")}
            onSkipProfession={() => {
              setProfession("");
              setStep("basic");
            }}
          />
        ) : null}
        {step === "profession" ? (
          <ProfessionStep
            value={profession}
            onSelect={updateProfession}
            error={validationErrors.profession}
          />
        ) : null}
        {step === "basic" ? (
          <BasicInfoStep
            basic={basic}
            setBasic={updateBasic}
            errors={validationErrors.basic}
          />
        ) : null}
        {step === "contacts" ? (
          <ContactsStep
            contacts={contacts}
            setContacts={updateContacts}
            errors={validationErrors.contacts}
          />
        ) : null}
        {step === "salary" ? (
          <SalaryStep
            salary={salary}
            setSalary={updateSalary}
            error={validationErrors.salary}
          />
        ) : null}
        {step === "workConditions" ? (
          <WorkConditionsStep
            value={workConditions}
            onChange={setWorkConditions}
          />
        ) : null}
        {step === "education" ? (
          <EducationStep
            education={education}
            setEducation={setEducation}
            additionalEducation={additionalEducation}
            setAdditionalEducation={setAdditionalEducation}
          />
        ) : null}
        {step === "skills" ? (
          <SkillsStep
            search={skillSearch}
            setSearch={setSkillSearch}
            selectedSkills={selectedSkills}
            setSelectedSkills={setSelectedSkills}
          />
        ) : null}
        {step === "experience" ? (
          <ExperienceStep experiences={experiences} setExperiences={setExperiences} />
        ) : null}
        {step === "about" ? <AboutStep value={about} onChange={setAbout} /> : null}
      </div>

      {showActions ? (
        <footer className="sticky bottom-0 z-30 mt-auto border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="pt-0">
            <WizardProgress step={step} />
            <div className="mx-auto flex w-full max-w-7xl items-center justify-end gap-3 px-4 py-4 sm:px-6 lg:px-8">
              {saveError ? (
                <div className="mr-auto hidden text-xs text-destructive md:block">
                  Ошибка сохранения
                </div>
              ) : (
                <div className="mr-auto hidden md:block" />
              )}
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl px-5"
                disabled={isSavingStep}
                onClick={() => void goBack()}
              >
                Назад
              </Button>
              <Button
                type="button"
                className="h-12 rounded-xl bg-[var(--hh-blue)] px-5 text-white hover:bg-[var(--hh-blue)]/90"
                disabled={isSavingStep || !resumeId}
                onClick={() => void goNext()}
              >
                {false ? (
                  <>
                    <Loader2Icon className="animate-spin" data-icon="inline-start" />
                    Сохранение...
                  </>
                ) : step === "about" ? (
                  "Сохранить"
                ) : (
                  "Сохранить и продолжить"
                )}
              </Button>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
