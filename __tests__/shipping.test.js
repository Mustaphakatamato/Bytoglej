// Shipping system — unit tests
// Kør med: npx jest __tests__/shipping.test.js

import { getPriceQuote, listPickupPoints, createShipment, getShipmentStatus, handleWebhook, isMockMode } from '../lib/shipmondo/client';

// Shipmondo client kører i mock-mode under tests
describe('Shipmondo mock client', () => {
  test('isMockMode er true i test-miljø', () => {
    expect(isMockMode).toBe(true);
  });

  describe('getPriceQuote', () => {
    test('returnerer korrekt pris for postnord service_point small', async () => {
      const result = await getPriceQuote({ carrier: 'postnord', service_type: 'service_point', size_category: 'small' });
      expect(result.price_dkk).toBe(49);
      expect(result.carrier).toBe('postnord');
      expect(result.service_type).toBe('service_point');
      expect(result.size_category).toBe('small');
      expect(typeof result.estimated_days).toBe('string');
    });

    test('returnerer korrekt pris for dao parcel_shop large', async () => {
      const result = await getPriceQuote({ carrier: 'dao', service_type: 'parcel_shop', size_category: 'large' });
      expect(result.price_dkk).toBe(79);
    });

    test('kaster fejl for ukendt carrier/service kombination', async () => {
      await expect(getPriceQuote({ carrier: 'unknown', service_type: 'unknown', size_category: 'small' })).rejects.toThrow();
    });

    test('kaster fejl for ukendt størrelse', async () => {
      await expect(getPriceQuote({ carrier: 'postnord', service_type: 'service_point', size_category: 'giant' })).rejects.toThrow();
    });

    test('home_delivery estimerer kortere leveringstid', async () => {
      const result = await getPriceQuote({ carrier: 'postnord', service_type: 'home_delivery', size_category: 'medium' });
      expect(result.estimated_days).toContain('1-3');
    });
  });

  describe('listPickupPoints', () => {
    test('returnerer max {limit} pakkeshops', async () => {
      const points = await listPickupPoints({ zip_code: '8000', carrier: 'postnord', limit: 2 });
      expect(points.length).toBeLessThanOrEqual(2);
    });

    test('inkluderer carrier-felt på hvert punkt', async () => {
      const points = await listPickupPoints({ zip_code: '2100', carrier: 'dao' });
      for (const p of points) {
        expect(p.carrier).toBe('dao');
        expect(p.id).toBeDefined();
        expect(p.name).toBeDefined();
        expect(p.address).toBeDefined();
      }
    });

    test('default limit er 5', async () => {
      const points = await listPickupPoints({ zip_code: '8000', carrier: 'gls' });
      expect(points.length).toBeLessThanOrEqual(5);
    });
  });

  describe('createShipment', () => {
    const sender = { name: 'Test Daginstitution', address: 'Testvej 1', zip_code: '8000', city: 'Aarhus', country_code: 'DK', email: 'test@inst.dk', phone: '12345678' };
    const receiver = { name: 'Modtager Børnehave', address: 'Modtagervej 2', zip_code: '2100', city: 'København Ø', country_code: 'DK', email: 'modtager@inst.dk', phone: '87654321' };

    test('returnerer shipment med ID og tracking nummer', async () => {
      const result = await createShipment({ sender, receiver, carrier: 'postnord', service_type: 'service_point', size_category: 'medium', reference: 'test-conv-id' });
      expect(result.shipmondo_shipment_id).toBeDefined();
      expect(result.tracking_number).toBeDefined();
      expect(result.tracking_url).toBeDefined();
      expect(typeof result.price_dkk).toBe('number');
    });

    test('ID starter med MOCK- i mock mode', async () => {
      const result = await createShipment({ sender, receiver, carrier: 'dao', service_type: 'parcel_shop', size_category: 'small', reference: 'conv-123' });
      expect(result.shipmondo_shipment_id).toMatch(/^MOCK-/);
    });
  });

  describe('getShipmentStatus', () => {
    test('returnerer status, tracking_number og tracking_events', async () => {
      const result = await getShipmentStatus('MOCK-123');
      expect(result.status).toBe('in_transit');
      expect(result.tracking_number).toBeDefined();
      expect(Array.isArray(result.tracking_events)).toBe(true);
      expect(result.tracking_events.length).toBeGreaterThan(0);
    });

    test('hvert tracking event har timestamp, description og location', async () => {
      const result = await getShipmentStatus('any-id');
      for (const e of result.tracking_events) {
        expect(e.timestamp).toBeDefined();
        expect(e.description).toBeDefined();
        expect(e.location).toBeDefined();
      }
    });
  });

  describe('handleWebhook', () => {
    test('parser delivered event korrekt', () => {
      const payload = { event_type: 'shipment.delivered', shipment: { id: '12345', tracking_number: 'TRK001' } };
      const result = handleWebhook({ payload, signature: '', secret: '' });
      expect(result.event_type).toBe('shipment.delivered');
      expect(result.shipmondo_shipment_id).toBe('12345');
      expect(result.tracking_number).toBe('TRK001');
    });

    test('parser in_transit event', () => {
      const payload = { event_type: 'shipment.in_transit', shipment: { id: '99', tracking_number: 'TRK002' } };
      const result = handleWebhook({ payload, signature: '', secret: '' });
      expect(result.event_type).toBe('shipment.in_transit');
    });

    test('normaliserer dot-notation event typer', () => {
      const payload = { event_type: 'shipment.delivered', shipment: { id: '1' } };
      const result = handleWebhook({ payload });
      expect(result.event_type).toBe('shipment.delivered');
    });

    test('kaster 401 ved ugyldig signatur', () => {
      const payload = { event_type: 'test', shipment: { id: '1' } };
      expect(() => handleWebhook({ payload, signature: 'bad', secret: 'correct-secret' })).toThrow();
    });
  });
});
