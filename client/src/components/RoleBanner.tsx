export function RoleBanner({ role, permission }: { role: string; permission: string }) {
  return (
    <div className="role-banner">
      <span>{role}</span>
      <code>{permission}</code>
    </div>
  );
}
