// Kundevendt ordrenummer.
//
// Vi viser ikke længere det lange UUID (fx 15738bbc-538d-4f41-bd47-681f195bd5ee)
// til kunden. I stedet bruges det fortløbende order_number fra databasen,
// formateret kort og genkendeligt som fx "BL-1042".
//
// Falder tilbage til et forkortet UUID hvis nummeret mangler — fx for ældre
// ordrer der endnu ikke er backfillet, eller før migrationen er kørt.
export function formatOrderNumber(order) {
  if (order && order.order_number != null) return `BL-${order.order_number}`;
  if (order && order.id) return `#${String(order.id).slice(0, 8).toUpperCase()}`;
  return '';
}
