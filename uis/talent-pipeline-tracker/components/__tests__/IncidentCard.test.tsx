import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IncidentCard } from "@/components/IncidentCard";
import { Incident } from "@/types/incident";

const incidentFixture: Incident = {
  id: "inc-1",
  title: "No funciona el acceso al ATS",
  description: "El equipo no puede iniciar sesión.",
  category: "technical_failure",
  status: "open",
  origin: "internal",
  branch: "valencia_operations",
  created_at: "2026-07-01T08:00:00Z",
  updated_at: "2026-07-01T08:00:00Z",
};

describe("IncidentCard", () => {
  it("muestra solo las transiciones válidas para el estado actual", () => {
    render(
      <IncidentCard incident={incidentFixture} isUpdating={false} onChangeStatus={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /Mover a En progreso/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mover a Descartada/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mover a Resuelta/ })).not.toBeInTheDocument();
  });

  it("no muestra acciones para estados finales", () => {
    render(
      <IncidentCard
        incident={{ ...incidentFixture, status: "resolved" }}
        isUpdating={false}
        onChangeStatus={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Estado final/)).toBeInTheDocument();
  });
});
