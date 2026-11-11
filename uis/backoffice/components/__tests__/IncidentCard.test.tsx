import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IncidentCard } from "@/components/IncidentCard";
import { ManagedIncident } from "@/types/managed-incident";

const incidentFixture: ManagedIncident = {
  id: "inc-1",
  client_name: null,
  channel: "email",
  type: "system_outage",
  severity: "high",
  responsible_area: "technology",
  title: "No funciona el acceso al ATS",
  description: "El equipo no puede iniciar sesión.",
  status: "open",
  assigned_to: null,
  sla_deadline: null,
  resolved_at: null,
  closed_at: null,
  created_at: "2026-07-01T08:00:00Z",
  updated_at: "2026-07-01T08:00:00Z",
  is_archived: false,
};

describe("IncidentCard", () => {
  it("muestra solo las transiciones válidas para el estado actual", () => {
    render(
      <IncidentCard incident={incidentFixture} isUpdating={false} onChangeStatus={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /Mover a Asignada/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mover a En progreso/ })).not.toBeInTheDocument();
  });

  it("no muestra acciones para estados finales", () => {
    render(
      <IncidentCard
        incident={{ ...incidentFixture, status: "closed" }}
        isUpdating={false}
        onChangeStatus={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalle e historial" })).toBeInTheDocument();
  });
});
