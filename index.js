/**
 * Book Appointment - Keep It Cut Barbershop
 *
 * Railway-deployable endpoint for Retell AI
 * Books appointments with support for additional services (add-ons)
 *
 * Endpoint: POST /book
 *
 * Request Body:
 * {
 *   "client_id": "uuid",              // Required: Client UUID
 *   "service": "uuid",                // Required: Primary service UUID
 *   "datetime": "ISO-8601",           // Required: Appointment start time
 *   "stylist": "uuid",                // Optional: Stylist UUID
 *   "additional_services": ["uuid"]   // Optional: Array of add-on service UUIDs
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "appointment_id": "uuid",
 *   "message": "Appointment booked successfully"
 * }
 *
 * SERVICES REFERENCE:
 * Primary Services:
 * - Men's Haircut: 480b1fd6-1c42-4c8a-add3-a7600102a9b1
 * - Women's Haircut: 54761597-e106-480a-898e-a76001002356
 * - Children's Haircut: d16c704b-3ff0-4d18-b73b-a7600102fdf1
 *
 * Add-On Services (can be booked standalone or with haircut):
 * - Blow Out (Wash): 978cbc02-048b-4d39-9f0d-a760010f32f8
 * - Blow Out With Flat Iron: 70886ed8-46fc-48c2-ac89-a760010fa24b
 * - Blow Out With Curls: d41e7bcf-8d53-40ea-9443-a760010ff707
 * - Bang Trim: 0bd1b8b0-1252-47be-8862-a7600106fb6d
 *
 * USAGE EXAMPLES:
 *
 * 1. Haircut only:
 * { "client_id": "...", "service": "480b1fd6...", "datetime": "2025-12-19T10:00:00-08:00" }
 *
 * 2. Haircut + Wash (Blow Out as add-on):
 * { "client_id": "...", "service": "480b1fd6...", "datetime": "...",
 *   "additional_services": ["978cbc02-048b-4d39-9f0d-a760010f32f8"] }
 *
 * 3. Just a Wash (Blow Out standalone):
 * { "client_id": "...", "service": "978cbc02-048b-4d39-9f0d-a760010f32f8", "datetime": "..." }
 */

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const CONFIG = {
  AUTH_URL: 'https://d18devmarketplace.meevodev.com/oauth2/token',
  API_URL: 'https://d18devpub.meevodev.com/publicapi/v1',
  CLIENT_ID: 'a7139b22-775f-4938-8ecb-54aa23a1948d',
  CLIENT_SECRET: 'b566556f-e65d-47dd-a27d-dd1060d9fe2d',
  TENANT_ID: '4',
  LOCATION_ID: '5'
};

// Service name to ID mapping for Retell AI convenience
const SERVICE_MAP = {
  // Primary haircuts
  'mens_haircut': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'mens haircut': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'womens_haircut': '54761597-e106-480a-898e-a76001002356',
  'womens haircut': '54761597-e106-480a-898e-a76001002356',
  'childrens_haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1',
  'childrens haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1',
  'kids_haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1',
  'kids haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1',

  // Add-on / Standalone services
  'wash': '978cbc02-048b-4d39-9f0d-a760010f32f8',
  'blow_out': '978cbc02-048b-4d39-9f0d-a760010f32f8',
  'blow out': '978cbc02-048b-4d39-9f0d-a760010f32f8',
  'blowout': '978cbc02-048b-4d39-9f0d-a760010f32f8',
  'shampoo': '978cbc02-048b-4d39-9f0d-a760010f32f8',

  'blow_out_flat_iron': '70886ed8-46fc-48c2-ac89-a760010fa24b',
  'blow out flat iron': '70886ed8-46fc-48c2-ac89-a760010fa24b',

  'blow_out_curls': 'd41e7bcf-8d53-40ea-9443-a760010ff707',
  'blow out curls': 'd41e7bcf-8d53-40ea-9443-a760010ff707',

  'bang_trim': '0bd1b8b0-1252-47be-8862-a7600106fb6d',
  'bang trim': '0bd1b8b0-1252-47be-8862-a7600106fb6d',
  'bangs': '0bd1b8b0-1252-47be-8862-a7600106fb6d'
};

// Helper to resolve service name to ID
function resolveServiceId(input) {
  if (!input) return null;
  // If it's already a UUID, return as-is
  if (input.includes('-') && input.length > 30) return input;
  // Otherwise look up by name (case-insensitive)
  return SERVICE_MAP[input.toLowerCase().trim()] || null;
}

let token = null;
let tokenExpiry = null;

async function getToken() {
  if (token && tokenExpiry && Date.now() < tokenExpiry - 300000) return token;

  console.log('🔄 Getting fresh Meevo OAuth2 token...');
  const res = await axios.post(CONFIG.AUTH_URL, {
    client_id: CONFIG.CLIENT_ID,
    client_secret: CONFIG.CLIENT_SECRET
  });

  token = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in * 1000);
  console.log('✅ Token obtained');
  return token;
}

app.post('/book', async (req, res) => {
  console.log('📅 Booking request received:', JSON.stringify(req.body));

  try {
    const { client_id, service, stylist, datetime, additional_services } = req.body;

    // Validate required fields
    if (!client_id || !service || !datetime) {
      return res.json({
        success: false,
        error: 'Missing required fields: client_id, service, and datetime are required'
      });
    }

    // Resolve service ID (accepts name or UUID)
    const serviceId = resolveServiceId(service);
    if (!serviceId) {
      return res.json({
        success: false,
        error: `Invalid service: "${service}". Use a valid service UUID or name like "mens_haircut", "wash", etc.`
      });
    }

    const authToken = await getToken();

    // Build booking data
    const bookingData = new URLSearchParams({
      ServiceId: serviceId,
      StartTime: datetime,
      ClientId: client_id,
      ClientGender: '2035'
    });

    // Add stylist if provided
    if (stylist) {
      bookingData.append('EmployeeId', stylist);
    }

    // Add additional services if provided (for multi-service bookings)
    if (additional_services && Array.isArray(additional_services) && additional_services.length > 0) {
      // Resolve each additional service
      const resolvedAddons = additional_services
        .map(s => resolveServiceId(s))
        .filter(s => s !== null);

      if (resolvedAddons.length > 0) {
        // Meevo accepts comma-separated UUIDs for AdditionalServiceIds
        bookingData.append('AdditionalServiceIds', resolvedAddons.join(','));
        console.log('📦 Adding services:', resolvedAddons);
      }
    }

    console.log('📤 Booking payload:', bookingData.toString());

    const bookRes = await axios.post(
      `${CONFIG.API_URL}/book/service?TenantId=${CONFIG.TENANT_ID}&LocationId=${CONFIG.LOCATION_ID}`,
      bookingData.toString(),
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const appointmentId = bookRes.data?.data?.appointmentId || bookRes.data?.appointmentId;

    console.log('✅ Booking successful! Appointment ID:', appointmentId);

    res.json({
      success: true,
      appointment_id: appointmentId,
      service_id: serviceId,
      additional_services: additional_services || [],
      message: additional_services && additional_services.length > 0
        ? 'Appointment booked successfully with add-on services'
        : 'Appointment booked successfully'
    });

  } catch (error) {
    console.error('❌ Booking error:', error.response?.data || error.message);

    res.json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Book Appointment',
    version: '2.0.0',
    features: ['single_service', 'additional_services', 'service_name_resolution'],
    timestamp: new Date().toISOString()
  });
});

// Service reference endpoint (for debugging)
app.get('/services', (req, res) => {
  res.json({
    primary_services: {
      'Mens Haircut': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
      'Womens Haircut': '54761597-e106-480a-898e-a76001002356',
      'Childrens Haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1'
    },
    addon_services: {
      'Blow Out (Wash)': '978cbc02-048b-4d39-9f0d-a760010f32f8',
      'Blow Out With Flat Iron': '70886ed8-46fc-48c2-ac89-a760010fa24b',
      'Blow Out With Curls': 'd41e7bcf-8d53-40ea-9443-a760010ff707',
      'Bang Trim': '0bd1b8b0-1252-47be-8862-a7600106fb6d'
    },
    usage: {
      haircut_only: { service: '480b1fd6-1c42-4c8a-add3-a7600102a9b1' },
      haircut_with_wash: {
        service: '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
        additional_services: ['978cbc02-048b-4d39-9f0d-a760010f32f8']
      },
      wash_only: { service: '978cbc02-048b-4d39-9f0d-a760010f32f8' }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Book Appointment Server v2.0`);
  console.log(`🚀 Listening on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Services reference: http://localhost:${PORT}/services`);
  console.log(`📍 Book endpoint: POST http://localhost:${PORT}/book\n`);
});
