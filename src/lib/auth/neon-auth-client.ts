"use client";

import { createAuthClient } from "@neon/auth/next";

/** Cliente de Neon Auth para componentes de cliente. Expone signIn.social y signOut. */
export const authClient = createAuthClient();
