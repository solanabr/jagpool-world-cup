import { type HTMLAttributes } from "react";

export function Card({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white/5 border border-white/10 rounded-xl p-6 ${className}`}
      {...rest}
    />
  );
}
