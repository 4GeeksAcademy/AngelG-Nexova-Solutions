import type { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow: string;
  id: string;
  children: ReactNode;
};

export function SectionTitle({ eyebrow, id, children }: SectionTitleProps) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{children}</h2>
    </>
  );
}