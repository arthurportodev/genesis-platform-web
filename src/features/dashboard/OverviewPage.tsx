import { Activity, Clock3, TrendingUp, UsersRound } from "lucide-react";

import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { Badge } from "@/shared/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";

const summaryCards = [
  { label: "Leads ativos", icon: UsersRound },
  { label: "Em follow-up", icon: Clock3 },
  { label: "Conversão", icon: TrendingUp },
  { label: "Atividade recente", icon: Activity },
] as const;

export function OverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operação"
        title="Visão geral"
        description="Acompanhe a operação comercial em um único espaço quando as fontes de dados estiverem conectadas."
        action={<Badge variant="warning">Dados indisponíveis</Badge>}
      />

      <section
        aria-label="Resumo operacional"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </CardHeader>
              <CardContent>
                <p
                  className="text-2xl font-bold"
                  aria-label={`${item.label}: indisponível`}
                >
                  —
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aguardando integração
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Movimentação do pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <OperationalState
              compact
              kind="empty"
              title="Sem movimentações para exibir"
              description="O histórico aparecerá aqui depois que a API e o contexto organizacional forem integrados."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximos follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <OperationalState
              compact
              kind="unavailable"
              title="Agenda não conectada"
              description="Nenhum compromisso é criado ou simulado nesta etapa."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
