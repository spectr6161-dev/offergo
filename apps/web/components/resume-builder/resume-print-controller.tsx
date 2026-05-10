"use client";

import { PrinterIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function ResumePrintController() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 650);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <aside className="print:hidden sticky top-8 h-fit shrink-0">
      <Button onClick={() => window.print()} size="lg" type="button">
        <PrinterIcon data-icon="inline-start" />
        Распечатать
      </Button>
    </aside>
  );
}
