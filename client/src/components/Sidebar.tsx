import { BrandLogo } from "./BrandLogo";

export function Sidebar({ role, items }: { role: string; items: string[] }) {
  return (
    <aside className="sidebar">
      <div className="brand side-brand">
        <BrandLogo compact size={24} />
        <span>{role}</span>
      </div>
      {items.map((item, index) => (
        <button className={index === 1 ? "side-active" : ""} key={item}>
          {item}
        </button>
      ))}
      <div className="operator">RBAC эрхээр тусгаарласан</div>
    </aside>
  );
}
