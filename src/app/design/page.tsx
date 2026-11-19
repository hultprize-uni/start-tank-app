"use client";

import { notFound } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AmountField,
  AnimatedBackground,
  Badge,
  BottomSheet,
  BrandLogo,
  Button,
  Countdown,
  Dialog,
  Eyebrow,
  GradientCard,
  LiveDot,
  MarketCard,
  ProgressBar,
  SegmentedChoice,
  Spinner,
  StatBlock,
  Toast,
} from "@/shared/ui";
import styles from "./page.module.css";

/** Catálogo de componentes solo para desarrollo. En producción la ruta responde 404. */

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.row}>{children}</div>
    </section>
  );
}

const RISK_OPTIONS = [
  { value: "low", label: "Bajo" },
  { value: "mid", label: "Medio" },
  { value: "high", label: "Alto", disabled: true },
];

export default function DesignCatalogPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [risk, setRisk] = useState("low");
  const [amount, setAmount] = useState("");

  const amountError =
    amount !== "" && Number(amount) < 250 ? "El monto mínimo es 250 coins." : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandLogo variant="horizontal" priority />
        <Eyebrow tone="muted">Design system catalog</Eyebrow>
        <h1 className={styles.title}>Start Tank UI kit</h1>
      </header>

      <Section title="Button">
        <Button variant="primary">Primary md</Button>
        <Button variant="primary" size="lg">Primary lg</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" loading>Loading</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="ghost" fullWidth>Full width</Button>
      </Section>

      <Section title="Badge and live dot">
        <Badge tone="cyan" live>Mercado abierto</Badge>
        <Badge tone="pink">Mercado cerrado</Badge>
        <Badge tone="yellow">Programada</Badge>
        <Badge tone="neutral">Neutral</Badge>
        <LiveDot tone="cyan" label="En vivo" />
      </Section>

      <Section title="Eyebrow and stat block">
        <Eyebrow tone="cyan">Ronda 3 de 5</Eyebrow>
        <Eyebrow tone="pink" as="span">Última llamada</Eyebrow>
        <StatBlock label="Acumulado" value="1,250" />
        <StatBlock label="Posición" value="#12" size="lg" align="end" />
      </Section>

      <Section title="Market card">
        <MarketCard
          status={
            <>
              <LiveDot tone="cyan" />
              <span>Mercado en vivo</span>
            </>
          }
          roundLabel="Ronda 3 de 5"
          name="Aqua Ruta"
          ods="ODS 6 · Agua limpia"
          price="104"
          delta="+4 %"
          total="1,250"
          totalLabel="Acumulado"
          investors="18"
          investorsLabel="Inversores"
        />
        <MarketCard
          name="Huerta Viva"
          ods="ODS 2 · Hambre cero"
          price="87"
          delta="-3 %"
          deltaTone="negative"
          total="640"
          totalLabel="Acumulado"
          investors="9"
          investorsLabel="Inversores"
          headingLevel={2}
        />
      </Section>

      <Section title="Gradient card">
        <GradientCard glow>
          <p className={styles.sample}>Contenido dentro del panel interior.</p>
        </GradientCard>
      </Section>

      <Section title="Logos">
        <BrandLogo variant="horizontal" />
        <BrandLogo variant="vertical" />
      </Section>

      <Section title="Toast">
        <Toast tone="positive">Inversión registrada.</Toast>
        <Toast tone="negative" role="alert">No se pudo completar la operación.</Toast>
        <Toast
          tone="warning"
          action={<Button variant="ghost" size="md">Deshacer</Button>}
        >
          Voto emitido.
        </Toast>
      </Section>

      <Section title="Progress and countdown">
        <div className={styles.block}>
          <ProgressBar label="Tope de la ronda" value={30} max={60} valueText="30 % del tope" />
        </div>
        <Countdown seconds={60} label="Tiempo de la última llamada" />
        <Countdown seconds={9} tone="warning" label="Tiempo restante" />
        <Spinner label="Cargando datos" />
      </Section>

      <Section title="Segmented choice">
        <SegmentedChoice
          label="Nivel de riesgo"
          options={RISK_OPTIONS}
          value={risk}
          onChange={setRisk}
        />
      </Section>

      <Section title="Amount field">
        <div className={styles.block}>
          <AmountField
            label="Monto a invertir"
            value={amount}
            onChange={setAmount}
            suffix="coins"
            placeholder="0"
            hint="Compra mínima 250 coins."
            error={amountError}
            shortcuts={[
              { label: "250", value: "250" },
              { label: "500", value: "500" },
              { label: "1,000", value: "1000" },
            ]}
            shortcutsLabel="Montos sugeridos"
            min={0}
          />
        </div>
      </Section>

      <Section title="Dialog and bottom sheet">
        <Button variant="ghost" onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="ghost" onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Confirmar inversión"
          description="Esta acción no se puede deshacer."
          closeOnBackdrop
        >
          <div className={styles.dialogActions}>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirmar</Button>
          </div>
        </Dialog>
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Invertir en Aqua Ruta"
          description="Elige un monto para esta ronda."
          closeOnBackdrop
        >
          <Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>
            Confirmar
          </Button>
        </BottomSheet>
      </Section>

      <div className={styles.backgroundFrame}>
        <AnimatedBackground fixed={false} />
        <p className={styles.sample}>Animated background (decorative, behind this text).</p>
      </div>
    </main>
  );
}
