import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { environment } from "@/shared/config/environment";
import { Brand } from "@/shared/components/Brand";
import { Button } from "@/shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { useSession } from "@/features/auth/session/useSession";
import { safeReturnTo } from "@/shared/lib/safe-return-to";
import { toAppError } from "@/shared/api/errors";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { session, state } = useSession();
  const navigate = useNavigate();
  const search = useLocation({ select: (location) => location.searchStr });
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const sessionMessage =
    state.status === "anonymous" || state.status === "session-expired"
      ? state.message
      : undefined;
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmissionMessage(null);
    try {
      await session.login(values);
      reset();
      const nextState = session.getSnapshot();
      if (
        "activeOrganization" in nextState &&
        nextState.activeOrganization !== null
      ) {
        const returnTo = safeReturnTo(
          new URLSearchParams(search).get("returnTo"),
        );
        await navigate({
          to: (returnTo ?? "/app") as "/app",
          replace: true,
        });
      } else {
        await navigate({ to: "/select-organization", replace: true });
      }
    } catch (error) {
      const normalized = toAppError(error);
      if (normalized.kind !== "network" && normalized.kind !== "timeout")
        setValue("password", "");
      setSubmissionMessage(
        normalized.kind === "unauthorized"
          ? "E-mail ou senha inválidos."
          : normalized.message,
      );
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,var(--login-halo),transparent_68%)]"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        <Brand className="mb-8 justify-center" />
        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Acesse sua conta</CardTitle>
            <CardDescription>
              Use suas credenciais para entrar na {environment.appName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void handleSubmit(onSubmit)(event);
              }}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="pl-9"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email")}
                  />
                </div>
                {errors.email ? (
                  <p id="email-error" className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="pl-9"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    {...register("password")}
                  />
                </div>
                {errors.password ? (
                  <p id="password-error" className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                Entrar
              </Button>
            </form>

            {submissionMessage || sessionMessage ? (
              <div
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-5 text-foreground"
                role="alert"
                aria-live="assertive"
              >
                {submissionMessage ?? sessionMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
