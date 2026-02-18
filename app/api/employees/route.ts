import { NextResponse } from "next/server";
import { computeEmployeeLeave } from "@/lib/leave";
import { fetchEmployeesFromSheet } from "@/lib/googleSheets";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employees = await fetchEmployeesFromSheet();
    const enriched = computeEmployeeLeave(employees);

    const role = (session.user as any).role as "admin" | "member" | undefined;
    const employeeId = (session.user as any).employeeId as string | undefined;

    // Members see only their own row
    if (role === "member" && employeeId) {
      const own = enriched.filter((e) => e.id === employeeId);
      return NextResponse.json(own);
    }

    // Admin (or missing data) see all
    return NextResponse.json(enriched);
  } catch (err) {
    console.error("Error in GET /api/employees:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
