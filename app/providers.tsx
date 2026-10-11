"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "#/components/ui/sonner";
import { useSession } from "#/lib/auth-client";
import { createAppQueryClient } from "#/lib/query-client";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const { data: session } = useSession();
  const sessionKey = session
    ? JSON.stringify([session.user.id, session.session.id])
    : "anonymous";

  return (
    <>
      <SessionQueryProvider key={sessionKey}>{children}</SessionQueryProvider>
      <Toaster richColors closeButton />
    </>
  );
}

function SessionQueryProvider({ children }: ProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
