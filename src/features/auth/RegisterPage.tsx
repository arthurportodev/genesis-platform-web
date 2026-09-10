import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { writeVerificationContinuation } from "@/features/auth/email-verification-storage";
import { PasswordField } from "@/features/auth/components/PasswordField";
import { GoogleAuthPanel } from "@/features/auth/google/GoogleAuthPanel";
import { useSession } from "@/features/auth/session/useSession";
import { Brand } from "@/shared/components/Brand";
import { toAppError } from "@/shared/api/errors";
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

const registrationSchema = z
  .object({
    firstName: z.string().trim().min(1, "Informe seu nome.").max(160),
    lastName: z.string().trim().min(1, "Informe seu sobrenome.").max(160),
    email: z
      .string()
      .trim()
      .min(1, "Informe seu e-mail.")
      .email("E-mail inválido.")
      .max(320),
    password: z
      .string()
      .min(10, "Use pelo menos 10 caracteres.")
      .max(128, "Use no máximo 128 caracteres.")
      .regex(/\S/u, "A senha precisa conter um caractere visível."),
    confirmPassword: z.string(),
  })
  .superRefine(
    ({ firstName, lastName, password, confirmPassword }, context) => {
      if (Array.from(`${firstName.trim()} ${lastName.trim()}`).length > 160) {
        context.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Nome completo muito longo.",
        });
      }
      if (password !== confirmPassword) {
        context.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "As senhas não coincidem.",
        });
      }
    },
  );

type RegistrationValues = z.infer<typeof registrationSchema>;

export function RegisterPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RegistrationValues) => {
    setSubmissionMessage(null);
    try {
      const response = await session.register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      writeVerificationContinuation(response, response.delivery);
      await navigate({ to: "/verify-email", replace: true });
    } catch (error) {
      const normalized = toAppError(error);
      setSubmissionMessage(
        normalized.code === "AUTH_EMAIL_ALREADY_REGISTERED"
          ? "Já existe uma conta com este e-mail. Entre ou verifique seu e-mail."
          : normalized.message,
      );
    } finally {
      setValue("password", "");
      setValue("confirmPassword", "");
    }
  };

  const continueAfterGoogleAuthentication = async () => {
    const nextState = session.getSnapshot();
    await navigate({
      to:
        "activeOrganization" in nextState &&
        nextState.activeOrganization !== null
          ? "/app"
          : "/select-organization",
      replace: true,
    });
  };

  const field = (
    id: "firstName" | "lastName" | "email",
    label: string,
    input: React.ComponentProps<typeof Input>,
  ) => {
    const error = errors[id];
    const Icon = id === "email" ? Mail : UserRound;
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
          <Icon
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={id}
            className="pl-9"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            {...input}
            {...register(id)}
          />
        </div>
        {error ? (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error.message}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-md">
        <Brand className="mb-8 justify-center" />
        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl">Crie sua conta</CardTitle>
            <CardDescription>
              Informe seus dados. Enviaremos um código para confirmar seu
              e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => void handleSubmit(onSubmit)(event)}
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {field("firstName", "Nome", { autoComplete: "given-name" })}
                {field("lastName", "Sobrenome", {
                  autoComplete: "family-name",
                })}
              </div>
              {field("email", "E-mail", {
                type: "email",
                autoComplete: "email",
              })}
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <PasswordField
                  id="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  {...register("password")}
                />
                {errors.password ? (
                  <p id="password-error" className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <PasswordField
                  id="confirmPassword"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={
                    errors.confirmPassword
                      ? "confirm-password-error"
                      : undefined
                  }
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <p
                    id="confirm-password-error"
                    className="text-sm text-destructive"
                  >
                    {errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Use entre 10 e 128 caracteres.
              </p>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando conta…" : "Criar conta"}
              </Button>
            </form>
            <GoogleAuthPanel
              onAuthenticated={continueAfterGoogleAuthentication}
              onVerificationRequired={() =>
                navigate({ to: "/verify-email", replace: true })
              }
            />
            {submissionMessage ? (
              <div
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {submissionMessage}
              </div>
            ) : null}
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link
                className="font-semibold text-primary hover:underline"
                to="/login"
              >
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
