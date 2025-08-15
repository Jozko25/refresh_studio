export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Return hardcoded services based on the facility
    const services = [
      {
        id: 130113,
        name: "test",
        duration: 40,
        price: "90.00",
        currency: "EUR",
        workerId: 31576,
        description: "Test service for AI Recepcia"
      }
    ];

    res.status(200).json({
      success: true,
      services: services,
      facilityId: process.env.BOOKIO_FACILITY_ID || '16052',
      timestamp: new Date().toISOString()
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}
