// lib/leave.ts

export type LeaveEntry = {
  date: string; // YYYY-MM-DD
  days: number;
  type: string;
  note?: string;
};

export type EmployeeRaw = {
  id: string;
  fullName: string;
  position: string;
  hireDate: string; // YYYY-MM-DD

  /**
   * startingBalance:
   *   Manual adjustment for total balance (e.g. initial credit).
   *   Treated as a lifetime adjustment.
   */
  startingBalance: number;

  // All leave entries (all years)
  leaveTaken: LeaveEntry[];
};

export type EmployeeWithLeave = EmployeeRaw & {
  tenureDays: number;
  tenureYears: number;
  tenureMonths: number;

  // LIFETIME totals (since hire)
  accruedLeave: number;
  leaveTakenTotal: number;
  leaveBalance: number;

  // Eligibility to use leave (6-month rule)
  fullMonthsTenure: number;
  canUseLeave: boolean;

  /**
   * What the employee can actually use *now*,
   * after applying:
   * - 6-month rule
   * - No carryover between years for established employees
   * - BUT pre-eligibility accrual is banked into the first eligible year
   */
  availableLeaveToUse: number;

  // Optional, can help debugging/inspection
  accrualYear?: number;
};

const MONTHLY_ACCRUAL = 0.83; // fixed 0.83 day per full month

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function diffInDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcFrom = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate()
  );
  const utcTo = Date.UTC(
    to.getUTCFullYear(),
    to.getUTCMonth(),
    to.getUTCDate()
  );
  return Math.max(0, Math.floor((utcTo - utcFrom) / msPerDay));
}

/**
 * Full months between two dates.
 */
function getFullMonthsBetween(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());

  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function getTenureComponents(hireDate: Date, today: Date) {
  let years = today.getUTCFullYear() - hireDate.getUTCFullYear();
  let months = today.getUTCMonth() - hireDate.getUTCMonth();
  let days = today.getUTCDate() - hireDate.getUTCDate();

  if (days < 0) {
    months -= 1;
    const temp = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
    );
    days += temp.getUTCDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

/**
 * LIFETIME accrual from hire date up to today (no reset).
 */
function calculateAccruedLifetime(hireDate: Date, today: Date): number {
  const months = getFullMonthsBetween(hireDate, today);
  return months * MONTHLY_ACCRUAL;
}

/**
 * LIFETIME leave taken (all years).
 */
function sumLeaveTakenLifetime(entries: LeaveEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.days, 0);
}

/**
 * Accrual in the CURRENT CALENDAR YEAR only (for no-carryover rule).
 */
function calculateAccruedThisYear(hireDate: Date, today: Date): number {
  const currentYear = today.getUTCFullYear();
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));

  // For this-year accrual, start no earlier than Jan 1 of this year
  const accrualStart = hireDate > yearStart ? hireDate : yearStart;

  const months = getFullMonthsBetween(accrualStart, today);
  return months * MONTHLY_ACCRUAL;
}

/**
 * Leave taken in the CURRENT CALENDAR YEAR only.
 */
function sumLeaveTakenThisYear(
  entries: LeaveEntry[],
  year: number
): number {
  return entries.reduce((sum, entry) => {
    if (!entry.date) return sum;
    const d = parseDate(entry.date);
    return d.getUTCFullYear() === year ? sum + entry.days : sum;
  }, 0);
}

/**
 * Main transformer
 *
 * - Lifetime accrual & usage are always tracked.
 * - 6-month rule gate:
 *     - Before 6 months → cannot use any leave.
 * - No-carryover rule:
 *     - Once established (past first eligible year), available leave is
 *       current-year accrual minus current-year taken.
 * - BUT:
 *     - All accrual before eligibility is banked into the first year
 *       where the employee becomes eligible (so late-year hires don't lose it).
 */
export function computeEmployeeLeave(
  rawEmployees: EmployeeRaw[],
  todayArg?: Date
): EmployeeWithLeave[] {
  const today = todayArg ?? new Date();
  const currentYear = today.getUTCFullYear();

  return rawEmployees.map((emp) => {
    const hireDate = parseDate(emp.hireDate);

    // Tenure for info / 6-month rule
    const tenureDays = diffInDays(hireDate, today);
    const { years, months } = getTenureComponents(hireDate, today);
    const fullMonthsTenure = getFullMonthsBetween(hireDate, today);

    // Lifetime accrual + taken
    const lifetimeAccrued =
      calculateAccruedLifetime(hireDate, today) + (emp.startingBalance || 0);
    const lifetimeTaken = sumLeaveTakenLifetime(emp.leaveTaken);
    const lifetimeBalance = lifetimeAccrued - lifetimeTaken;

    // This-year accrual + taken (for no-carryover when established)
    const accruedThisYear =
      calculateAccruedThisYear(hireDate, today) + (emp.startingBalance || 0);
    const takenThisYear = sumLeaveTakenThisYear(
      emp.leaveTaken,
      currentYear
    );
    const balanceThisYear = accruedThisYear - takenThisYear;

    // 6-month eligibility
    const canUseLeave = fullMonthsTenure >= 6;

    // Figure out which YEAR they become eligible (rough but good enough):
    // - If hired Jan–Jun → 6 months later is same calendar year.
    // - If hired Jul–Dec → 6 months later is next calendar year.
    const hireYear = hireDate.getUTCFullYear();
    const hireMonth = hireDate.getUTCMonth(); // 0–11
    const eligibilityYear =
      hireMonth <= 5 /* Jan–Jun */ ? hireYear : hireYear + 1;

    const becameEligibleThisYear =
      canUseLeave && currentYear === eligibilityYear;

    // Now apply the "bank pre-eligibility, no carryover afterwards" rule
    let availableLeaveToUse: number;

    if (!canUseLeave) {
      // Still in first 6 months: can't use anything yet
      availableLeaveToUse = 0;
    } else if (becameEligibleThisYear) {
      // First year they become eligible:
      //   allow them to use their FULL lifetime balance (including
      //   any accrual from last year while they were ineligible).
      availableLeaveToUse = lifetimeBalance;
    } else {
      // Already established (eligibility was in a previous year):
      //   no carryover – only this year's balance is usable.
      availableLeaveToUse = balanceThisYear;
    }

    return {
      ...emp,
      tenureDays,
      tenureYears: years,
      tenureMonths: months,

      // Lifetime totals for display
      accruedLeave: Number(lifetimeAccrued.toFixed(2)),
      leaveTakenTotal: Number(lifetimeTaken.toFixed(2)),
      leaveBalance: Number(lifetimeBalance.toFixed(2)),

      fullMonthsTenure,
      canUseLeave,
      availableLeaveToUse: Number(availableLeaveToUse.toFixed(2)),

      accrualYear: currentYear,
    };
  });
}
