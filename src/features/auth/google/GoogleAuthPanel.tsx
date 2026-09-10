import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { PasswordField } from "@/features/auth/components/PasswordField";
import { writeVerificationContinuation } from "@/features/auth/email-verification-storage";
import { useSession } from "@/features/auth/session/useSession";
import { toAppError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import {
  isIosGooglePopupUnsupported,
  loadGoogleIdentityServices,
} from "./google-identity";

interface GoogleAuthPanelProps {
  onAuthenticated: () => Promise<void>;
  onVerificationRequired: () => Promise<void>;
}

type Continuation = "button" | "profile" | "link";
type SetupStatus = "loading" | "disabled" | "ready" | "error";

export function GoogleAuthPanel({
  onAuthenticated,
  onVerificationRequired,
}: GoogleAuthPanelProps) {
  const { session } = useSession();
  const button = useRef<HTMLDivElement>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>("loading");
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [continuation, setContinuation] = useState<Continuation>("button");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<{
    clientId: string;
    challengeToken: string;
    nonce: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const profile = useForm<{ firstName: string; lastName: string }>({
    defaultValues: { firstName: "", lastName: "" },
  });
  const link = useForm<{ password: string }>({
    defaultValues: { password: "" },
  });

  const handleFailure = async (error: unknown) => {
    const normalized = toAppError(error);
    if (
      normalized.code === "EMAIL_VERIFICATION_REQUIRED" &&
      normalized.continuation
    ) {
      writeVerificationContinuation(normalized.continuation);
      await onVerificationRequired();
      return;
    }
    if (normalized.code === "AUTH_GOOGLE_LINK_REQUIRED") {
      setContinuation("link");
      setMessage(
        "Já existe uma conta com este e-mail. Confirme sua senha para conectar o Google.",
      );
      return;
    }
    if (normalized.code === "AUTH_GOOGLE_PROFILE_REQUIRED") {
      setContinuation("profile");
      setMessage("Complete seu nome para criar sua conta.");
      return;
    }
    setMessage(
      normalized.kind === "unauthorized"
        ? "Não foi possível confirmar suas credenciais."
        : normalized.message,
    );
  };

  const authenticate = async (token: string, credential: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await session.authenticateWithGoogle({
        challengeToken: token,
        credential,
      });
      await onAuthenticated();
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = profile.handleSubmit(async (values) => {
    if (!challengeToken) return;
    setBusy(true);
    try {
      await session.completeGoogleProfile({ challengeToken, ...values });
      await onAuthenticated();
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  });

  const submitLink = link.handleSubmit(async ({ password }) => {
    if (!challengeToken) return;
    setBusy(true);
    try {
      await session.linkGoogleIdentity({ challengeToken, password });
      link.reset();
      await onAuthenticated();
    } catch (error) {
      link.reset();
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  });

  const restartCeremony = () => {
    profile.reset();
    link.reset();
    setContinuation("button");
    setChallengeToken(null);
    setCeremony(null);
    setMessage(null);
    setSetupStatus("loading");
    setSetupAttempt((current) => current + 1);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await session.getGoogleConfig();
      if (cancelled) return;
      if (!config.enabled) {
        setSetupStatus("disabled");
        return;
      }
      if (isIosGooglePopupUnsupported()) {
        setSetupStatus("ready");
        setMessage(
          "O acesso com Google ainda não está disponível neste dispositivo. Use e-mail e senha.",
        );
        return;
      }
      const challenge = await session.issueGoogleChallenge();
      if (cancelled) return;
      setChallengeToken(challenge.challengeToken);
      setCeremony({
        clientId: config.clientId,
        challengeToken: challenge.challengeToken,
        nonce: challenge.nonce,
      });
    })().catch(() => {
      if (!cancelled) {
        setSetupStatus("error");
        setMessage("O acesso com Google está temporariamente indisponível.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, setupAttempt]);

  useEffect(() => {
    if (ceremony === null) return;
    let cancelled = false;
    const target = button.current;
    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !target || !window.google?.accounts.id) return;
        window.google.accounts.id.initialize({
          client_id: ceremony.clientId,
          nonce: ceremony.nonce,
          ux_mode: "popup",
          auto_select: false,
          use_fedcm_for_button: false,
          callback: ({ credential }) => {
            if (!credential) {
              setMessage("O acesso com Google foi cancelado.");
              return;
            }
            void authenticate(ceremony.challengeToken, credential);
          },
        });
        target.replaceChildren();
        window.google.accounts.id.renderButton(target, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: target.clientWidth || 352,
        });
        setSetupStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setSetupStatus("error");
          setMessage("O acesso com Google está temporariamente indisponível.");
        }
      });
    return () => {
      cancelled = true;
      target?.replaceChildren();
    };
    // The ceremony intentionally starts once per mounted page. The callback
    // uses the ceremony values created by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceremony]);

  if (setupStatus === "disabled") return null;

  return (
    <section className="mt-5 space-y-4" aria-label="Acesso com Google">
      <div
        className="flex items-center gap-3 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        <span>ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {continuation === "button" ? (
        <div
          ref={button}
          className="min-h-10 w-full"
          aria-busy={busy || setupStatus === "loading"}
        />
      ) : null}
      {setupStatus === "loading" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Carregando acesso com Google…
        </p>
      ) : null}
      {setupStatus === "error" ? (
        <Button className="w-full" type="button" onClick={restartCeremony}>
          Tentar Google novamente
        </Button>
      ) : null}
      {continuation === "profile" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => void submitProfile(event)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="google-first-name">Nome</Label>
              <Input
                id="google-first-name"
                autoComplete="given-name"
                required
                maxLength={160}
                {...profile.register("firstName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-last-name">Sobrenome</Label>
              <Input
                id="google-last-name"
                autoComplete="family-name"
                required
                maxLength={160}
                {...profile.register("lastName")}
              />
            </div>
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            Continuar
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={restartCeremony}
          >
            Cancelar
          </Button>
        </form>
      ) : null}
      {continuation === "link" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => void submitLink(event)}
        >
          <div className="space-y-2">
            <Label htmlFor="google-link-password">Senha atual</Label>
            <PasswordField
              id="google-link-password"
              autoComplete="current-password"
              required
              {...link.register("password")}
            />
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            Conectar Google e entrar
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={restartCeremony}
          >
            Cancelar
          </Button>
        </form>
      ) : null}
      {message ? (
        <p
          className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-5"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
