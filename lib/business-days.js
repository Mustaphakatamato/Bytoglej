// Læg N hverdage til en dato (springer lør/søn over).
// Danske helligdage håndteres ikke endnu — noteret som senere forfining.
export function addBusinessDays(from, n) {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay(); // 0 = søndag, 6 = lørdag
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}
