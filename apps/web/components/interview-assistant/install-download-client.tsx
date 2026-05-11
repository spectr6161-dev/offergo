"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, TimerIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";

const downloadHref = "/downloads/offergo-interview-assistant.zip";
const initialCountdown = 10;

function triggerDownload() {
  const link = document.createElement("a");
  link.href = downloadHref;
  link.download = "offergo-interview-assistant.zip";
  document.body.append(link);
  link.click();
  link.remove();
}

export function InstallDownloadClient() {
  const [secondsLeft, setSecondsLeft] = useState(initialCountdown);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);

  function startDownload() {
    startedRef.current = true;
    setStarted(true);
    setSecondsLeft(0);
    triggerDownload();
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (startedRef.current) {
          return 0;
        }

        if (current <= 1) {
          window.clearInterval(interval);
          startDownload();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const progress = ((initialCountdown - secondsLeft) / initialCountdown) * 100;

  return (
    <ItemGroup>
      <Item className="rounded-3xl bg-primary p-5 text-primary-foreground sm:p-6">
        <ItemMedia variant="icon">
          <TimerIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="w-full text-lg">
            {started
              ? "Загрузка началась"
              : `Загрузка начнётся через ${secondsLeft} сек.`}
          </ItemTitle>
          <ItemDescription className="text-primary-foreground/80">
            Если скачивание не началось, нажмите кнопку ещё раз.
          </ItemDescription>
        </ItemContent>
        <ItemActions className="basis-full sm:basis-auto">
          <Button
            className="w-full sm:w-auto"
            onClick={startDownload}
            type="button"
            variant="secondary"
          >
            <DownloadIcon data-icon="inline-start" />
            Скачать сейчас
          </Button>
        </ItemActions>
        <div className="basis-full pt-3">
          <Progress className="bg-primary-foreground/20" value={progress} />
        </div>
      </Item>
    </ItemGroup>
  );
}
