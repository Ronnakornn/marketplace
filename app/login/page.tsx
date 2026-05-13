import { redirect } from "next/navigation";
import { LoginForm } from "#/features/auth";
import { getServerSession } from "#/lib/auth-server";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/");
  }

  return <LoginForm />;
}
