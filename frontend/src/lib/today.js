// Today's date as "YYYY-MM-DD" in the browser's local timezone.
// (toISOString() is UTC, so before 7 AM in Thailand it gives yesterday.)
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
