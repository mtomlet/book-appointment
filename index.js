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
 *   "service": "string",              // Required: Service name (see SERVICE_MAP below)
 *   "datetime": "ISO-8601",           // Required: Appointment start time
 *   "stylist": "uuid",                // Optional: Stylist UUID
 *   "additional_services": ["string"] // Optional: Array of add-on service names
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "appointment_id": "uuid",
 *   "message": "Appointment booked successfully"
 * }
 *
 * KEEP IT CUT SERVICES (Mapped to Meevo Dev):
 *
 * Primary Services:
 * - "haircut_standard" ($26) -> Men's Haircut: 480b1fd6-1c42-4c8a-add3-a7600102a9b1
 * - "haircut_skin_fade" ($32) -> Men's Haircut: 480b1fd6-1c42-4c8a-add3-a7600102a9b1
 * - "long_locks" ($60) -> Women's Haircut: 54761597-e106-480a-898e-a76001002356
 *
 * Add-On Services (for haircut, skin fade, long locks):
 * - "wash" ($6) -> Blow Out: 978cbc02-048b-4d39-9f0d-a760010f32f8
 * - "grooming" ($14) -> Beard Trim: aff1ff92-15a6-4090-bf75-abf80103eebb
 *
 * USAGE EXAMPLES:
 *
 * 1. Haircut Standard only:
 * { "client_id": "...", "service": "haircut_standard", "datetime": "2025-12-19T10:00:00-08:00" }
 *
 * 2. Haircut Skin Fade + Wash + Grooming:
 * { "client_id": "...", "service": "haircut_skin_fade", "datetime": "...",
 *   "additional_services": ["wash", "grooming"] }
 *
 * 3. Long Locks + Wash:
 * { "client_id": "...", "service": "long_locks", "datetime": "...",
 *   "additional_services": ["wash"] }
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

// Keep It Cut service names to Meevo Dev IDs
// Production will need different IDs - these are DEV mappings
const SERVICE_MAP = {
  // PRIMARY SERVICES (Choose ONE)
  // Haircut Standard ($26) - maps to Men's Haircut
  'haircut_standard': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'haircut standard': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'standard': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'haircut': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',

  // Haircut Skin Fade ($32) - maps to Men's Haircut (no skin fade in dev)
  'haircut_skin_fade': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'haircut skin fade': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'skin_fade': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'skin fade': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'fade': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',

  // Long Locks ($60) - maps to Women's Haircut
  'long_locks': '54761597-e106-480a-898e-a76001002356',
  'long locks': '54761597-e106-480a-898e-a76001002356',
  'long': '54761597-e106-480a-898e-a76001002356',

  // ADD-ON SERVICES (optional, only for haircuts)
  // Wash ($6) - maps to Blow Out
  'wash': '978cbc02-048b-4d39-9f0d-a760010f32f8',
  'shampoo': '978cbc02-048b-4d39-9f0d-a760010f32f8',

  // Grooming ($14) - maps to Beard Trim & Neck Cleanup
  'grooming': 'aff1ff92-15a6-4090-bf75-abf80103eebb',
  'beard': 'aff1ff92-15a6-4090-bf75-abf80103eebb',
  'beard_trim': 'aff1ff92-15a6-4090-bf75-abf80103eebb',
  'beard trim': 'aff1ff92-15a6-4090-bf75-abf80103eebb',

  // Legacy mappings for backwards compatibility
  'mens_haircut': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'mens haircut': '480b1fd6-1c42-4c8a-add3-a7600102a9b1',
  'womens_haircut': '54761597-e106-480a-898e-a76001002356',
  'womens haircut': '54761597-e106-480a-898e-a76001002356',
  'childrens_haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1',
  'childrens haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1',
  'kids_haircut': 'd16c704b-3ff0-4d18-b73b-a7600102fdf1'
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
    keep_it_cut_services: {
      primary: {
        'haircut_standard': { price: '$26', meevo_id: '480b1fd6-1c42-4c8a-add3-a7600102a9b1' },
        'haircut_skin_fade': { price: '$32', meevo_id: '480b1fd6-1c42-4c8a-add3-a7600102a9b1' },
        'long_locks': { price: '$60', meevo_id: '54761597-e106-480a-898e-a76001002356' }
      },
      addons: {
        'wash': { price: '$6', meevo_id: '978cbc02-048b-4d39-9f0d-a760010f32f8', note: 'Optional add-on for any haircut' },
        'grooming': { price: '$14', meevo_id: 'aff1ff92-15a6-4090-bf75-abf80103eebb', note: 'Optional add-on for any haircut' }
      }
    },
    usage_examples: {
      haircut_standard_only: {
        service: 'haircut_standard',
        additional_services: []
      },
      haircut_skin_fade_with_wash_and_grooming: {
        service: 'haircut_skin_fade',
        additional_services: ['wash', 'grooming']
      },
      long_locks_with_wash: {
        service: 'long_locks',
        additional_services: ['wash']
      }
    },
    booking_rules: {
      rule_1: 'Choose ONE primary service (haircut_standard, haircut_skin_fade, or long_locks)',
      rule_2: 'Wash and Grooming are optional add-ons for any primary service',
      rule_3: 'You cannot book just Wash or Grooming alone - they require a primary service'
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
