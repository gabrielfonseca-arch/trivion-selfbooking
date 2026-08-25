import { initials } from "@/lib/utils";

export function Avatar({
  name,
  color = "#4338ca",
  size = 32,
}: {
  name: string;
  color?: string | null;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ backgroundColor: color ?? "#4338ca", width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
