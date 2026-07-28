import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
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
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = () => {
    setSubmitted(true);
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

            {submitted ? (
              <div
                className="mt-4 rounded-lg border border-info/20 bg-info/5 p-3 text-sm leading-5 text-muted-foreground"
                role="status"
              >
                A autenticação será conectada em uma tarefa futura. Nenhuma
                credencial foi enviada.
              </div>
            ) : null}

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              Esta interface ainda não possui integração de sessão.{" "}
              <Link
                className="font-semibold text-primary hover:underline"
                to="/app"
              >
                Visualizar estrutura administrativa
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
