import { getNeonAuth } from "@/lib/auth/neon-auth";

/** Contexto de la ruta catch-all con los segmentos de la ruta de autenticación. */
interface AuthRouteContext {
  params: Promise<{ path: string[] }>;
}

/** Reenvía las solicitudes GET a Neon Auth. */
export function GET(request: Request, context: AuthRouteContext) {
  return getNeonAuth().handler().GET(request, context);
}

/** Reenvía las solicitudes POST a Neon Auth. */
export function POST(request: Request, context: AuthRouteContext) {
  return getNeonAuth().handler().POST(request, context);
}

/** Reenvía las solicitudes PUT a Neon Auth. */
export function PUT(request: Request, context: AuthRouteContext) {
  return getNeonAuth().handler().PUT(request, context);
}

/** Reenvía las solicitudes PATCH a Neon Auth. */
export function PATCH(request: Request, context: AuthRouteContext) {
  return getNeonAuth().handler().PATCH(request, context);
}

/** Reenvía las solicitudes DELETE a Neon Auth. */
export function DELETE(request: Request, context: AuthRouteContext) {
  return getNeonAuth().handler().DELETE(request, context);
}
