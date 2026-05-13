import { redirect } from "next/navigation";
import { SignupForm } from "#/features/auth";
import { getServerSession } from "#/lib/auth-server";

export default async function SignupPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/");
  }

  return <SignupForm />;
}
