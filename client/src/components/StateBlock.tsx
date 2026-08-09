import type { ReactNode } from "react";

export function StateBlock({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) return <div className="state-card">Өгөгдөл ачаалж байна...</div>;
  if (error) return <div className="state-card">{error}</div>;
  if (empty) return <div className="state-card">Одоогоор харуулах өгөгдөл алга.</div>;
  return children;
}
