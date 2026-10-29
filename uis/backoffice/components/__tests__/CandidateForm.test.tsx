import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CandidateForm } from "@/components/CandidateForm";

describe("CandidateForm", () => {
  it("envía todos los campos definidos para el registro de candidaturas", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CandidateForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nombre completo" }), {
      target: { value: "Elena Ruiz" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "elena@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: "+34 600 111 222" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Puesto" }), {
      target: { value: "Executive Assistant" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "LinkedIn URL" }), {
      target: { value: "https://linkedin.com/in/elena" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "CV URL" }), {
      target: { value: "https://example.com/elena-cv.pdf" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Años de experiencia" }), {
      target: { value: "6" },
    });
    expect(screen.getByRole("spinbutton", { name: "Años de experiencia" })).toHaveAttribute(
      "step",
      "1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar candidatura" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        full_name: "Elena Ruiz",
        email: "elena@example.com",
        phone: "+34 600 111 222",
        position: "Executive Assistant",
        linkedin_url: "https://linkedin.com/in/elena",
        cv_url: "https://example.com/elena-cv.pdf",
        experience_years: 6,
      });
    });
  });

  it("envía enlaces opcionales vacíos como null", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CandidateForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nombre completo" }), {
      target: { value: "Elena Ruiz" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "elena@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Teléfono" }), {
      target: { value: "+34 600 111 222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar candidatura" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ linkedin_url: null, cv_url: null }),
      );
    });
  });
});
