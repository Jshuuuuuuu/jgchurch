import Image from "next/image";

export function ChurchLogo() {
  return (
    <Image
      src="/assets/logo.png"
      alt="Jesus Generation Church logo"
      width={56}
      height={56}
      className="size-14 shrink-0 rounded-lg bg-white object-contain"
    />
  );
}
