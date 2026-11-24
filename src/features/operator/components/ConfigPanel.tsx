"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Dialog, Toast } from "@/shared/ui";

import { readConfig, updateConfig } from "../api/client";
import { formatCoins, formatSeconds } from "../labels";
import type {
  ConfigUpdate,
  ConfigView,
  CriterionConfigView,
  JurorConfigView,
  SettingView,
  StartupConfigView,
} from "../types";

import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface ConfigPanelProps {
  canWrite: boolean;
  onSessionExpired: () => void;
}

/** Valor visible de un parámetro según su unidad. */
function displayValue(setting: SettingView): string {
  if (setting.unit === "ratio") return `${Math.round(setting.value * 100)}%`;
  if (setting.unit === "seconds") return formatSeconds(setting.value);
  if (setting.unit === "coins") return formatCoins(setting.value);
  return String(setting.value);
}

/** Valor del campo de edición: porcentajes y segundos tal como se escriben. */
function inputValue(setting: SettingView): string {
  return setting.unit === "ratio" ? String(Math.round(setting.value * 100)) : String(setting.value);
}

function inputUnit(setting: SettingView): string {
  if (setting.unit === "ratio") return "%";
  if (setting.unit === "seconds") return "s";
  if (setting.unit === "coins") return "IC";
  return "";
}

/**
 * Configuración del evento (RF-28, RNF-14, CU-16): límites del dinero, duración de las fases,
 * startups, jurados y criterios. Solo se edita sin ronda en curso; el servidor lo vuelve a validar.
 * El soporte la ve sin códigos de acceso y sin poder editar.
 */
export function ConfigPanel({ canWrite, onSessionExpired }: ConfigPanelProps) {
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<
    | { kind: "startup"; item: StartupConfigView }
    | { kind: "juror"; item: JurorConfigView }
    | { kind: "criteria"; items: CriterionConfigView[] }
    | null
  >(null);

  const load = useCallback(async () => {
    const result = await readConfig();
    if (result.ok) {
      setConfig(result.value);
      setDrafts({});
    } else if (result.sessionExpired) {
      onSessionExpired();
    } else {
      setError(result.message);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = canWrite && config !== null && !config.locked;

  async function save(update: ConfigUpdate): Promise<string | null> {
    const result = await updateConfig(update);
    if (!result.ok) {
      if (result.sessionExpired) onSessionExpired();
      return result.message;
    }
    return null;
  }

  async function saveSettings() {
    if (config === null) return;
    setSaving(true);
    setError(null);
    let failure: string | null = null;
    let saved = 0;
    for (const setting of config.settings) {
      const draft = drafts[setting.key];
      if (draft === undefined || draft === inputValue(setting)) continue;
      const number = Number(draft);
      const value = setting.unit === "ratio" ? number / 100 : number;
      failure = await save({ kind: "setting", key: setting.key, value });
      if (failure !== null) {
        failure = `${setting.label}: ${failure}`;
        break;
      }
      saved += 1;
    }
    setSaving(false);
    if (failure !== null) setError(failure);
    else if (saved > 0) setNotice(`Se guardaron ${saved} cambios.`);
    await load();
  }

  async function saveEdit(update: ConfigUpdate) {
    const failure = await save(update);
    if (failure !== null) return failure;
    setEditing(null);
    setNotice("Cambio guardado.");
    await load();
    return null;
  }

  if (config === null) {
    return (
      <>
        <h1 className={styles.sectionTitle}>Configuración del evento</h1>
        <p className={panel.muted}>{error ?? "Cargando la configuración…"}</p>
      </>
    );
  }

  const settingGroup = (group: SettingView["group"], title: string) => (
    <section className={panel.panel} aria-labelledby={`config-${group}`}>
      <h2 id={`config-${group}`} className={panel.title}>
        {title}
      </h2>
      <ul className={styles.rows}>
        {config.settings
          .filter((setting) => setting.group === group)
          .map((setting) => (
            <li key={setting.key} className={styles.row}>
              <label htmlFor={`ajuste-${setting.key}`} className={styles.rowTitle}>
                {setting.label}
              </label>
              {editable ? (
                <span>
                  <input
                    id={`ajuste-${setting.key}`}
                    className={`${styles.input} ${styles.numberInput}`}
                    type="number"
                    inputMode="decimal"
                    value={drafts[setting.key] ?? inputValue(setting)}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))
                    }
                  />{" "}
                  <span className={panel.muted}>{inputUnit(setting)}</span>
                </span>
              ) : (
                <span id={`ajuste-${setting.key}`} className={styles.num}>
                  {displayValue(setting)}
                  {setting.unit === "coins" ? " IC" : ""}
                </span>
              )}
            </li>
          ))}
      </ul>
    </section>
  );

  return (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Configuración del evento</h1>
          <p className={styles.sectionLead}>
            Los cambios se aplican sin tocar el código. Duraciones en segundos.
          </p>
        </div>
        <div className={styles.mainRow}>
          <Badge tone={config.locked ? "pink" : "yellow"}>
            {config.locked ? "Bloqueada: hay una ronda en curso" : "Editable solo sin ronda abierta"}
          </Badge>
          {editable ? (
            <Button
              loading={saving}
              loadingLabel="Guardando"
              disabled={Object.keys(drafts).length === 0}
              onClick={() => void saveSettings()}
            >
              Guardar cambios
            </Button>
          ) : null}
        </div>
      </div>

      {error !== null ? (
        <Toast tone="negative" role="alert">
          {error}
        </Toast>
      ) : null}
      {notice !== null ? (
        <Toast tone="positive" role="status">
          {notice}
        </Toast>
      ) : null}

      <div className={styles.twoColumns}>
        <div className={styles.column}>
          <section className={panel.panel} aria-labelledby="config-startups">
            <h2 id="config-startups" className={panel.title}>
              Startups
            </h2>
            <ol className={styles.rows}>
              {config.startups.map((startup) => (
                <li key={startup.id} className={styles.row}>
                  <span>
                    <p className={styles.rowTitle}>
                      {startup.order}. {startup.name}
                    </p>
                    <p className={styles.rowMeta}>{startup.sdg ?? "Sin ODS"}</p>
                  </span>
                  {editable ? (
                    <Button
                      variant="ghost"
                      aria-label={`Editar ${startup.name}`}
                      onClick={() => setEditing({ kind: "startup", item: startup })}
                    >
                      Editar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <section className={panel.panel} aria-labelledby="config-jurados">
            <h2 id="config-jurados" className={panel.title}>
              Jurados y códigos
            </h2>
            <ul className={styles.rows}>
              {config.jurors.map((juror) => (
                <li key={juror.id} className={styles.row}>
                  <span>
                    <p className={styles.rowTitle}>{juror.name}</p>
                    <p className={styles.rowMeta}>
                      {juror.organization ?? ""}
                      {juror.accessCode !== null ? ` · ${juror.accessCode}` : ""}
                    </p>
                  </span>
                  {editable ? (
                    <Button
                      variant="ghost"
                      aria-label={`Editar ${juror.name}`}
                      onClick={() => setEditing({ kind: "juror", item: juror })}
                    >
                      Editar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={styles.column}>
          {settingGroup("money", "Límites del dinero")}
          {settingGroup("durations", "Duración de cada fase")}
          <section className={panel.panel} aria-labelledby="config-criterios">
            <div className={panel.header}>
              <h2 id="config-criterios" className={panel.title}>
                Criterios del jurado
              </h2>
              {editable ? (
                <Button
                  variant="ghost"
                  onClick={() => setEditing({ kind: "criteria", items: config.criteria })}
                >
                  Editar
                </Button>
              ) : null}
            </div>
            <p className={panel.note}>
              {config.criteria
                .map((criterion) => `${criterion.name} ${Math.round(criterion.weight * 100)}%`)
                .join(", ")}
            </p>
          </section>
        </div>
      </div>

      {editing?.kind === "startup" ? (
        <StartupDialog item={editing.item} onClose={() => setEditing(null)} onSave={saveEdit} />
      ) : null}
      {editing?.kind === "juror" ? (
        <JurorDialog item={editing.item} onClose={() => setEditing(null)} onSave={saveEdit} />
      ) : null}
      {editing?.kind === "criteria" ? (
        <CriteriaDialog items={editing.items} onClose={() => setEditing(null)} onSave={saveEdit} />
      ) : null}
    </>
  );
}

interface EditDialogProps<T> {
  onClose: () => void;
  onSave: (update: ConfigUpdate) => Promise<string | null>;
  item: T;
}

function useSaving(onSave: (update: ConfigUpdate) => Promise<string | null>) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (update: ConfigUpdate) => {
    setSending(true);
    const failure = await onSave(update);
    setSending(false);
    setError(failure);
  };
  return { sending, error, submit };
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DialogActions({
  sending,
  error,
  onClose,
  onSave,
}: {
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <>
      {error !== null ? (
        <Toast tone="negative" role="alert">
          {error}
        </Toast>
      ) : null}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button loading={sending} loadingLabel="Guardando" onClick={onSave}>
          Guardar
        </Button>
      </div>
    </>
  );
}

function StartupDialog({ item, onClose, onSave }: EditDialogProps<StartupConfigView>) {
  const [name, setName] = useState(item.name);
  const [sdg, setSdg] = useState(item.sdg ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [logoUrl, setLogoUrl] = useState(item.logoUrl ?? "");
  const saving = useSaving(onSave);
  return (
    <Dialog open onClose={onClose} title={`Editar ${item.name}`}>
      <div className={styles.form}>
        <TextField id="startup-nombre" label="Nombre" value={name} onChange={setName} />
        <TextField id="startup-ods" label="ODS (por ejemplo, ODS 6)" value={sdg} onChange={setSdg} />
        <TextField id="startup-descripcion" label="Descripción" value={description} onChange={setDescription} />
        <TextField id="startup-logo" label="URL del logo" value={logoUrl} onChange={setLogoUrl} />
        <DialogActions
          sending={saving.sending}
          error={saving.error}
          onClose={onClose}
          onSave={() =>
            void saving.submit({
              kind: "startup",
              id: item.id,
              name,
              sdg: sdg.trim() === "" ? null : sdg,
              description: description.trim() === "" ? null : description,
              logoUrl: logoUrl.trim() === "" ? null : logoUrl,
            })
          }
        />
      </div>
    </Dialog>
  );
}

function JurorDialog({ item, onClose, onSave }: EditDialogProps<JurorConfigView>) {
  const [name, setName] = useState(item.name);
  const [organization, setOrganization] = useState(item.organization ?? "");
  const [code, setCode] = useState(item.accessCode ?? "");
  const saving = useSaving(onSave);
  return (
    <Dialog open onClose={onClose} title={`Editar ${item.name}`}>
      <div className={styles.form}>
        <TextField id="jurado-nombre" label="Nombre" value={name} onChange={setName} />
        <TextField id="jurado-org" label="Organización" value={organization} onChange={setOrganization} />
        <TextField id="jurado-codigo" label="Código de acceso" value={code} onChange={setCode} />
        <DialogActions
          sending={saving.sending}
          error={saving.error}
          onClose={onClose}
          onSave={() =>
            void saving.submit({
              kind: "juror",
              id: item.id,
              name,
              organization: organization.trim() === "" ? null : organization,
              accessCode: code,
            })
          }
        />
      </div>
    </Dialog>
  );
}

function CriteriaDialog({
  items,
  onClose,
  onSave,
}: Omit<EditDialogProps<never>, "item"> & { items: CriterionConfigView[] }) {
  const [drafts, setDrafts] = useState(() =>
    items.map((item) => ({ ...item, percent: String(Math.round(item.weight * 1000) / 10) })),
  );
  const saving = useSaving(onSave);
  const total = drafts.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);

  const update = (index: number, patch: Partial<(typeof drafts)[number]>) =>
    setDrafts((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <Dialog
      open
      onClose={onClose}
      title="Criterios del jurado"
      description={`Los pesos deben sumar 100%. Suma actual: ${Math.round(total * 10) / 10}%.`}
    >
      <div className={styles.form}>
        {drafts.map((item, index) => (
          <fieldset key={item.id} className={styles.form}>
            <legend className={styles.label}>Criterio {index + 1}</legend>
            <TextField
              id={`criterio-${item.id}-nombre`}
              label="Nombre"
              value={item.name}
              onChange={(value) => update(index, { name: value })}
            />
            <TextField
              id={`criterio-${item.id}-peso`}
              label="Peso (%)"
              value={item.percent}
              onChange={(value) => update(index, { percent: value })}
            />
            <TextField
              id={`criterio-${item.id}-min`}
              label="Frase de la nota 1"
              value={item.anchorMin}
              onChange={(value) => update(index, { anchorMin: value })}
            />
            <TextField
              id={`criterio-${item.id}-max`}
              label="Frase de la nota 5"
              value={item.anchorMax}
              onChange={(value) => update(index, { anchorMax: value })}
            />
          </fieldset>
        ))}
        <DialogActions
          sending={saving.sending}
          error={saving.error}
          onClose={onClose}
          onSave={() =>
            void saving.submit({
              kind: "criteria",
              items: drafts.map((item) => ({
                id: item.id,
                name: item.name,
                weight: (Number(item.percent) || 0) / 100,
                anchorMin: item.anchorMin,
                anchorMax: item.anchorMax,
              })),
            })
          }
        />
      </div>
    </Dialog>
  );
}
