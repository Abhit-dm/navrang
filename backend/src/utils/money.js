// Decimal-safe money helpers. We store money as Float (rupees) but always
// round to 2 decimal places using integer-paise math to avoid FP drift.
function toPaise(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function toRupees(paise) {
  return Math.round(paise) / 100;
}

function round2(amount) {
  return toRupees(toPaise(amount));
}

function multiply(a, b) {
  return round2((toPaise(a) * b) / 100);
}

function percentOf(amount, percent) {
  return round2((toPaise(amount) * Number(percent || 0)) / 10000);
}

module.exports = { toPaise, toRupees, round2, multiply, percentOf };
