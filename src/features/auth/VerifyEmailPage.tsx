import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  clearVerificationContinuation,
  readVerificationContinuation,
  writeVerificationContinuation,
  type StoredVerificationContinuation,
} from "@/features/auth/email-verification-storage";
import { useSession } from "@/features/auth/session/useSession";
import { toAppError } from "@/shared/api/errors";
import { Brand } from "@/shared/components/Brand";
import { Button, buttonVariants } from "@/shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";

const verificationSchema = z.object({
  code: z.string().regex(/^\d{6}$/u, "Informe os seis dígitos do código."),
});

type VerificationValues = z.infer<typeof verificationSchema>;

export function VerifyEmailPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [continuation, setContinuation] =
    useState<StoredVerificationContinuation | null>(() =>
      readVerificationContinuation(),
    );
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(() =>
    continuation?.delivery === "delivery_unavailable"
      ? "Não foi possível entregar o primeiro e-mail. Solicite um novo código."
      : "Enviamos um código de seis dígitos para seu e-mail.",
  );
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!continuation) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <Brand className="mb-8 justify-center" />
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">
                Verificação indisponível
              </CardTitle>
              <CardDescription>
                Inicie novamente pelo cadastro ou pelo login para receber um
                código.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={buttonVariants({ className: "w-full" })}
                to="/login"
              >
                Voltar ao login
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const cooldownSeconds = Math.max(
    0,
    Math.ceil((Date.parse(continuation.resendAvailableAt) - now) / 1_000),
  );

  const onSubmit = async ({ code }: VerificationValues) => {
    setMessage(null);
    try {
      await session.verifyEmail(continuation.challengeId, code);
      clearVerificationContinuation();
      setValue("code", "");
      await navigate({
        to: "/login",
        search: { returnTo: undefined, verified: true },
        replace: true,
      });
    } catch (error) {
      const normalized = toAppError(error);
      setValue("code", "");
      if (normalized.code === "AUTH_EMAIL_VERIFICATION_UNAVAILABLE") {
        clearVerificationContinuation();
        setContinuation(null);
        return;
      }
      setMessage(
        normalized.code === "AUTH_EMAIL_VERIFICATION_INVALID"
          ? "Código inválido ou expirado. Confira os dígitos ou solicite outro código."
          : normalized.message,
      );
    }
  };

  const resend = async () => {
    setResending(true);
    setMessage(null);
    try {
      const response = await session.resendEmailVerification(
        continuation.challengeId,
      );
      const replacement = writeVerificationContinuation(
        response,
        response.delivery,
      );
      setContinuation(replacement);
      setValue("code", "");
      setMessage(
        response.delivery === "sent"
          ? "Um novo código foi enviado."
          : "O novo código foi criado, mas o e-mail não pôde ser entregue. Tente reenviar depois do intervalo.",
      );
    } catch (error) {
      const normalized = toAppError(error);
      setMessage(normalized.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Brand className="mb-8 justify-center" />
        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Confirme seu e-mail</CardTitle>
            <CardDescription>
              Digite o código enviado. Ele expira em poucos minutos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => void handleSubmit(onSubmit)(event)}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="verification-code">Código de verificação</Label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="pl-9 text-center text-lg tracking-[0.35em]"
                    aria-invalid={Boolean(errors.code)}
                    aria-describedby={errors.code ? "code-error" : undefined}
                    {...register("code")}
                  />
                </div>
                {errors.code ? (
                  <p id="code-error" className="text-sm text-destructive">
                    {errors.code.message}
                  </p>
                ) : null}
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Verificando…" : "Verificar e-mail"}
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
            </form>
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
