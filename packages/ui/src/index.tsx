"use client";

import * as React from "react";

type ToastSeverity = "success" | "info" | "warning" | "error";
type RowRecord = {
  id: string | number;
};

export type AppDataColumn<Row extends RowRecord> = {
  key: keyof Row | string;
  header: string;
  align?: "left" | "center" | "right";
  render?: (row: Row) => React.ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function OffergoProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function PageFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ui-page-frame">
      <header className="ui-page-frame__header">
        <div>
          <h1 className="ui-page-frame__title">{title}</h1>
          {description ? (
            <p className="ui-page-frame__description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="ui-page-frame__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ui-card ui-card--section">
      <div className="ui-card__header">
        <h2 className="ui-card__title">{title}</h2>
        {subtitle ? <p className="ui-card__subtitle">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="ui-card ui-stat-card">
      <div className="ui-stat-card__label">{label}</div>
      <div className="ui-stat-card__value">{value}</div>
      {hint ? <div className="ui-stat-card__hint">{hint}</div> : null}
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <div>
        <h3 className="ui-empty-state__title">{title}</h3>
        <p className="ui-empty-state__description">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function AppDataGrid<Row extends RowRecord>({
  rows,
  columns,
  emptyMessage = "No rows to display.",
}: {
  rows: Row[];
  columns: AppDataColumn<Row>[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <div className="ui-table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cx(
                  column.align === "center" && "ui-table__cell--center",
                  column.align === "right" && "ui-table__cell--right",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => {
                const value = row[column.key as keyof Row];

                return (
                  <td
                    key={`${row.id}-${String(column.key)}`}
                    className={cx(
                      column.align === "center" && "ui-table__cell--center",
                      column.align === "right" && "ui-table__cell--right",
                    )}
                  >
                    {column.render ? column.render(row) : String(value ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ToastContext = React.createContext<
  | ((message: string, severity?: ToastSeverity) => void)
  | null
>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{
    open: boolean;
    message: string;
    severity: ToastSeverity;
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const showToast = React.useCallback(
    (message: string, severity: ToastSeverity = "info") => {
      setState({
        open: true,
        message,
        severity,
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!state.open) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setState((current) => ({ ...current, open: false }));
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [state.open]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {state.open ? (
        <div className={cx("ui-toast", `ui-toast--${state.severity}`)}>
          {state.message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = React.useContext(ToastContext);

  if (!value) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return value;
}
