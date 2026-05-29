"use client";

import { useState } from "react";

export function ValidatorLogo({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);

  if (!url || errored) {
    return (
      <div
        className="rounded-full bg-[#129D49]/20 border border-[#129D49]/40 flex items-center justify-center font-semibold text-[#129D49] shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={name}
      onError={() => setErrored(true)}
      className="rounded-full object-cover bg-white/5 shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}
