"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JuryResult } from "../api/client";
import type { ScoreValue } from "../criteria";

export type DraftStatus = "idle" | "saving" | "saved" | "error";

export interface UseDraftOptions {
  roundId: string | null;
  serverNotes: Readonly<Partial<Record<string, ScoreValue>>>;
  saveNote: (criterionId: string, value: ScoreValue) => Promise<JuryResult>;
  onSessionExpired: (message: string) => void;
}

export interface UseDraftResult {
  scores: Readonly<Partial<Record<string, ScoreValue>>>;
  status: DraftStatus;
  errorMessage: string | null;
  hasRecoveredDraft: boolean;
  setScore: (criterionId: string, value: ScoreValue) => void;
  resetDraft: () => void;
}

/**
 * Gestiona el borrador de notas del jurado por ronda (RF-14). Aplica cambios optimistas mientras
 * persiste cada nota en la base de datos, evita que respuestas tardías pisen ediciones más
 * recientes y revierte un criterio si el servidor rechaza el guardado.
 */
export function useDraft({
  roundId,
  serverNotes,
  saveNote,
  onSessionExpired,
}: UseDraftOptions): UseDraftResult {
  const [localOverrides, setLocalOverrides] = useState<Partial<Record<string, ScoreValue>>>({});
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const seqRef = useRef<Record<string, number>>({});
  const inFlightRef = useRef(0);
  const roundIdRef = useRef(roundId);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const resetDraft = useCallback(() => {
    seqRef.current = {};
    inFlightRef.current = 0;
    setLocalOverrides({});
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    roundIdRef.current = roundId;
    resetDraft();
  }, [roundId, resetDraft]);

  const scores = useMemo(() => {
    const merged: Partial<Record<string, ScoreValue>> = { ...serverNotes };
    for (const [key, value] of Object.entries(localOverrides)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
    return merged;
  }, [serverNotes, localOverrides]);

  const setScore = useCallback(
    (criterionId: string, value: ScoreValue) => {
      const targetRoundId = roundIdRef.current;
      const nextSeq = (seqRef.current[criterionId] ?? 0) + 1;
      seqRef.current[criterionId] = nextSeq;
      inFlightRef.current += 1;

      setLocalOverrides((prev) => ({ ...prev, [criterionId]: value }));
      setStatus("saving");
      setErrorMessage(null);

      void (async () => {
        const result = await saveNote(criterionId, value);
        if (unmountedRef.current || roundIdRef.current !== targetRoundId) {
          return;
        }

        inFlightRef.current = Math.max(0, inFlightRef.current - 1);

        if (result.ok) {
          if (seqRef.current[criterionId] === nextSeq && inFlightRef.current === 0) {
            setStatus("saved");
          }
          return;
        }

        if (result.sessionExpired) {
          onSessionExpired(result.message);
          return;
        }

        if (seqRef.current[criterionId] === nextSeq) {
          setLocalOverrides((prev) => {
            const copy = { ...prev };
            delete copy[criterionId];
            return copy;
          });
          setErrorMessage(result.message);
          if (inFlightRef.current === 0) {
            setStatus("error");
          }
        }
      })();
    },
    [saveNote, onSessionExpired],
  );

  const hasRecoveredDraft = Object.keys(serverNotes).length > 0;

  return {
    scores,
    status,
    errorMessage,
    hasRecoveredDraft,
    setScore,
    resetDraft,
  };
}
