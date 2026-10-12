import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Limpia el DOM entre tests: necesario porque los archivos de test no usan
// `globals: true`, así que la auto-limpieza de Testing Library no se activa.
afterEach(() => {
  cleanup();
});

