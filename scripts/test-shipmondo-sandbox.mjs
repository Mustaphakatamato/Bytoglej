/**
 * Test-script: booker en testforsendelse i Shipmondo sandbox og printer resultatet.
 * Kør med: node scripts/test-shipmondo-sandbox.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manuelt
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local');
const envVars = readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .forEach(l => {
    const [key, ...rest] = l.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  });

const BASE_URL = process.env.SHIPMONDO_BASE_URL;
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;

if (!API_USER || !API_KEY) {
  console.error('❌ Mangler SHIPMONDO_API_USER eller SHIPMONDO_API_KEY i .env.local');
  process.exit(1);
}

console.log('🔗 Sandbox URL:', BASE_URL);
console.log('👤 API User:', API_USER);
console.log('');

const authHeader = 'Basic ' + Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');

async function shipmondoRequest(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} fejlede (${res.status}): ${text}`);
  return JSON.parse(text);
}

async function main() {
  // 1. Test forbindelsen
  console.log('1️⃣  Tester forbindelsen til sandbox...');
  try {
    const products = await shipmondoRequest('GET', '/products?own_agreement=false');
    const list = Array.isArray(products) ? products : products.products ?? [];
    console.log(`✅ Forbundet! ${list.length} produkter tilgængelige`);
    console.log('   Eksempler:', list.slice(0,3).map(p => p.code ?? p.product_code ?? JSON.stringify(p).slice(0,60)).join(', '));
  } catch (e) {
    console.error('❌ Forbindelsesfejl:', e.message);
    process.exit(1);
  }

  console.log('');

  // 2. Book en testforsendelse
  console.log('2️⃣  Booker testforsendelse (PostNord pakkeshop, 0-1 kg)...');
  const body = {
    own_agreement: false,
    product_code: 'PDK_MC',
    service_codes: 'EMAIL_NT',
    reference: 'TEST-BYTOGLEG-001',
    parcels: [{ weight: 500, length: 30, width: 20, height: 15 }],
    sender: {
      name: 'Testvej Børnehave',
      address1: 'Testvej 1',
      zipcode: '8000',
      city: 'Aarhus C',
      country_code: 'DK',
      email: 'mustaphakatamato@gmail.com',
      mobile: '12345678',
    },
    receiver: {
      name: 'Modtager SFO',
      address1: 'Modtagervej 5',
      zipcode: '2100',
      city: 'København Ø',
      country_code: 'DK',
      email: 'mustaphakatamato@gmail.com',
      mobile: '87654321',
    },
    automatic_select_service_point: true,
  };

  let shipment;
  try {
    shipment = await shipmondoRequest('POST', '/shipments', body);
    console.log('✅ Forsendelse booket!');
    console.log('   Shipmondo ID:', shipment.id);
    console.log('   Trackingnummer:', shipment.packages?.[0]?.pkg_no ?? shipment.pkg_no ?? '—');
    console.log('   Tracking URL:', shipment.tracking_link ?? '—');
    // Label hentes altid via GET (label_format må ikke sendes med i POST)
    let labelB64 = shipment.labels?.[0]?.base64;
    if (!labelB64 && shipment.id) {
      try {
        const labels = await shipmondoRequest('GET', `/shipments/${shipment.id}/labels`);
        labelB64 = labels?.[0]?.base64 ?? null;
        if (labelB64) console.log('   Label hentet via GET /labels ✅');
      } catch (e) { console.log('   GET /labels fejlede:', e.message); }
    }
    shipment._resolvedLabel = labelB64;
    console.log('   Label (base64):', labelB64 ? `✅ Modtaget (${Math.round(labelB64.length / 1024)} KB)` : '❌ Mangler');
  } catch (e) {
    console.error('❌ Fejl ved booking:', e.message);
    process.exit(1);
  }

  // 3. Gem label lokalt som PDF til inspektion
  const labelB64 = shipment._resolvedLabel;
  if (labelB64) {
    const { writeFileSync } = await import('fs');
    const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../test-label.pdf');
    writeFileSync(outPath, Buffer.from(labelB64, 'base64'));
    console.log('');
    console.log(`📄 Label gemt som: test-label.pdf`);
    console.log(`   Åbn den for at se om den ser rigtig ud.`);
  }

  console.log('');
  console.log('✅ Sandbox-test gennemført!');
  console.log('   EMAIL_NT-servicekoden betyder at Shipmondo også sender notifikation til afsender/modtager.');
}

main().catch(e => { console.error('Uventet fejl:', e); process.exit(1); });
