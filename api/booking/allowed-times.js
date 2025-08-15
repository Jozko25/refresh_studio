import axios from 'axios';

const WIDGET_API = 'https://services.bookio.com/widget/api';
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

function formatDateForAPI(date) {
  const [day, month, year] = date.split('.');
  return `${day}.${month}.${year}`;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    const { date, serviceId = 130113, workerId = 31576 } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required',
        timestamp: new Date().toISOString()
      });
    }

    const dateOnly = date.split(' ')[0];
    const payload = {
      serviceId: parseInt(serviceId),
      workerId: parseInt(workerId),
      addons: [],
      count: 1,
      participantsCount: 0,
      date: formatDateForAPI(dateOnly),
      lang: 'en'
    };

    const response = await axios.post(`${WIDGET_API}/allowedTimes?lang=en`, payload, { headers });
    const times = response.data?.data?.times;

    if (!times) {
      return res.status(404).json({
        success: false,
        error: 'No times available',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      times: times,
      date: dateOnly,
      serviceId: serviceId,
      workerId: workerId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching allowed times:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
