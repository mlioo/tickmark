import { createContext, useContext, useMemo, type ReactNode } from "react";

import { formatGrade as formatGradeValue, type GradeSystem } from "../domain/grades";

interface GradeSystemContextValue {
  gradeSystem: GradeSystem;
  formatGrade: (grade: string) => string;
}

const GradeSystemContext = createContext<GradeSystemContextValue | null>(null);

export function GradeSystemProvider({
  preference,
  children
}: {
  preference: GradeSystem;
  children: ReactNode;
}) {
  const value = useMemo<GradeSystemContextValue>(
    () => ({
      gradeSystem: preference,
      formatGrade: (grade: string) => formatGradeValue(grade, preference)
    }),
    [preference]
  );

  return <GradeSystemContext.Provider value={value}>{children}</GradeSystemContext.Provider>;
}

export function useGradeSystem(): GradeSystemContextValue {
  const context = useContext(GradeSystemContext);
  if (!context) throw new Error("useGradeSystem must be used within GradeSystemProvider");
  return context;
}
