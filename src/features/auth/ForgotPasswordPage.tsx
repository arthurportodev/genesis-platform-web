import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { PasswordResetAcceptedResponse } from "@/features/auth/api/auth-contracts";
import { PasswordField } from "@/features/auth/components/PasswordField";
import { useSession } from "@/features/auth/session/useSession";
import { toAppError } from "@/shared/api/errors";
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

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido.")
    .max(320),
});

const completionSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/u, "Informe os seis dígitos do código."),
    password: z
      .string()
      .min(10, "Use pelo menos 10 caracteres.")
      .max(128, "Use no máximo 128 caracteres.")
      .regex(/\S/u, "A senha precisa conter um caractere visível."),
    confirmPassword: z.string(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  });

type EmailValues = z.infer<typeof emailSchema>;
type CompletionValues = z.infer<typeof completionSchema>;

export function ForgotPasswordPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [acceptance, setAcceptance] =
    useState<PasswordResetAcceptedResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const completionForm = useForm<CompletionValues>({
    resolver: zodResolver(completionSchema),
    defaultValues: { code: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!acceptance) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [acceptance]);

  const requestCode = async ({ email: input }: EmailValues) => {
    setMessage(null);
    try {
      const response = await session.requestPasswordReset(input);
      setEmail(input);
      setAcceptance(response);
      setNow(Date.now());
      setMessage(
        "Se existir uma conta ativa com este e-mail, enviaremos um código de seis dígitos.",
      );
    } catch (error) {
      setMessage(toAppError(error).message);
    }
  };

  const complete = async ({ code, password }: CompletionValues) => {
    if (!email) return;
    setMessage(null);
    try {
      await session.completePasswordReset({ email, code, password });
      await navigate({
        to: "/login",
        search: {
          returnTo: undefined,
          verified: undefined,
          passwordReset: true,
        },
        replace: true,
      });
    } catch (error) {
      const normalized = toAppError(error);
      setMessage(
        normalized.code === "AUTH_PASSWORD_RESET_INVALID"
          ? "Código inválido ou expirado. Confira os dígitos ou solicite outro código."
          : normalized.message,
      );
    } finally {
      completionForm.setValue("code", "");
      completionForm.setValue("password", "");
      completionForm.setValue("confirmPassword", "");
    }
  };

  const resend = async () => {
    if (!email) return;
    setResending(true);
    setMessage(null);
    try {
      const response = await session.requestPasswordReset(email);
      setAcceptance(response);
      setNow(Date.now());
      completionForm.reset();
      setMessage(
        "Se existir uma conta ativa com este e-mail, enviaremos um novo código.",
      );
    } catch (error) {
      setMessage(toAppError(error).message);
    } finally {
      setResending(false);
    }
  };

  const restart = () => {
    setEmail(null);
    setAcceptance(null);
    setMessage(null);
    emailForm.reset();
    completionForm.reset();
  };

  const cooldownSeconds = acceptance
    ? Math.max(
        0,
        Math.ceil((Date.parse(acceptance.resendAvailableAt) - now) / 1_000),
      )
    : 0;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Brand className="mb-8 justify-center" />
        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Recupere sua senha</CardTitle>
            <CardDescription>
              {email
                ? "Digite o código recebido e escolha uma nova senha."
                : "Informe seu e-mail para receber as próximas instruções."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!email ? (
              <form
                className="space-y-4"
                onSubmit={(event) =>
                  void emailForm.handleSubmit(requestCode)(event)
                }
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
                      aria-invalid={Boolean(emailForm.formState.errors.email)}
                      aria-describedby={
                        emailForm.formState.errors.email
                          ? "email-error"
                          : undefined
                      }
                      {...emailForm.register("email")}
                    />
                  </div>
                  {emailForm.formState.errors.email ? (
                    <p id="email-error" className="text-sm text-destructive">
                      {emailForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={emailForm.formState.isSubmitting}
                >
                  {emailForm.formState.isSubmitting
                    ? "Enviando…"
                    : "Enviar código"}
                </Button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) =>
                  void completionForm.handleSubmit(complete)(event)
                }
                noValidate
              >
                <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  Código solicitado para <strong>{email}</strong>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Código</Label>
                  <div className="relative">
                    <KeyRound
                      className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="reset-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="pl-9 text-center text-lg tracking-[0.35em]"
                      aria-invalid={Boolean(
                        completionForm.formState.errors.code,
                      )}
                      aria-describedby={
                        completionForm.formState.errors.code
                          ? "reset-code-error"
                          : undefined
                      }
                      {...completionForm.register("code")}
                    />
                  </div>
                  {completionForm.formState.errors.code ? (
                    <p
                      id="reset-code-error"
                      className="text-sm text-destructive"
                    >
                      {completionForm.formState.errors.code.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <PasswordField
                    id="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(
                      completionForm.formState.errors.password,
                    )}
                    aria-describedby={
                      completionForm.formState.errors.password
                        ? "password-error"
                        : undefined
                    }
                    {...completionForm.register("password")}
                  />
                  {completionForm.formState.errors.password ? (
                    <p id="password-error" className="text-sm text-destructive">
                      {completionForm.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <PasswordField
                    id="confirmPassword"
                    autoComplete="new-password"
                    aria-invalid={Boolean(
                      completionForm.formState.errors.confirmPassword,
                    )}
                    aria-describedby={
                      completionForm.formState.errors.confirmPassword
                        ? "confirm-password-error"
                        : undefined
                    }
                    {...completionForm.register("confirmPassword")}
                  />
                  {completionForm.formState.errors.confirmPassword ? (
                    <p
                      id="confirm-password-error"
                      className="text-sm text-destructive"
                    >
                      {completionForm.formState.errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Use entre 10 e 128 caracteres.
                </p>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={completionForm.formState.isSubmitting}
                >
                  {completionForm.formState.isSubmitting
                    ? "Alterando…"
                    : "Alterar senha"}
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="secondary"
                  disabled={resending || cooldownSeconds > 0}
                  onClick={() => void resend()}
                >
                  {resending
                    ? "Reenviando…"
                    : cooldownSeconds > 0
                      ? `Reenviar em ${cooldownSeconds}s`
                      : "Reenviar código"}
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  onClick={restart}
                >
                  Usar outro e-mail
                </Button>
              </form>
            )}

            {message ? (
              <div
                className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm leading-5"
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            ) : null}
            <p className="mt-5 text-center text-sm">
              <Link
                className="font-semibold text-primary hover:underline"
                to="/login"
              >
                Voltar ao login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
