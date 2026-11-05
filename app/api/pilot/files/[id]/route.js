import { currentUser } from "@/lib/auth.js";
import { fileDownload } from "@/lib/pilot-storage.js";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    return new Response(null, {
      status: 303,
      headers: {
        Location: await fileDownload(user, (await params).id),
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 400 });
  }
}
