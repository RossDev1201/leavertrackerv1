import { NextRequest, NextResponse } from "next/server";
import {
  appendLeaveToSheet,
  appendLeaveRequestToSheet,
  fetchEmployeesFromSheet,
} from "@/lib/googleSheets";
import { computeEmployeeLeave, type LeaveEntry } from "@/lib/leave";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const role = user.role as "admin" | "member" | undefined;
    const sessionEmployeeId = user.employeeId as string | undefined;
    const employeeId = params.id;

    // Members can only act for themselves
    if (role === "member" && sessionEmployeeId !== employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { date, days, type, note } = body as {
      date?: string;
      days?: number;
      type?: string;
      note?: string;
    };

    if (!date || !days || !type || Number.isNaN(Number(days)) || days <= 0) {
      return NextResponse.json(
        { error: "Invalid leave payload." },
        { status: 400 }
      );
    }

    const entry: LeaveEntry = {
      date,
      days: Number(days),
      type,
      note,
    };

    // If MEMBER → create a pending request in LeaveRequests
    if (role === "member") {
      const requestedBy = user.name || user.username || "Member";

      await appendLeaveRequestToSheet(employeeId, entry, requestedBy);

      return NextResponse.json({
        message: "Leave request submitted for approval.",
      });
    }

    // If ADMIN → write directly to Leaves and update balances
    await appendLeaveToSheet(employeeId, entry);

    const employees = await fetchEmployeesFromSheet();
    const enriched = computeEmployeeLeave(employees);

    return NextResponse.json({
      message: "Leave added and balance updated.",
      employees: enriched,
    });
  } catch (err) {
    console.error("Error adding leave:", err);
    const message =
      err instanceof Error ? err.message : "Failed to add leave entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
