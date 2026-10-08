"use client";

import { useState } from "react";
import { useSessionStore } from "@/store/session";
import { OtpStep } from "./OtpStep";
import { PhoneStep } from "./PhoneStep";
import { ProfileStep } from "./ProfileStep";

/** Registration / login: phone number -> mocked SMS code -> profile (new accounts only). */
export function Onboarding() {
  const status = useSessionStore((s) => s.status);
  const [phone, setPhone] = useState<string | null>(null);

  if (status === "onboarding") return <ProfileStep />;
  if (phone) return <OtpStep phone={phone} onBack={() => setPhone(null)} />;
  return <PhoneStep onSubmitted={setPhone} />;
}
